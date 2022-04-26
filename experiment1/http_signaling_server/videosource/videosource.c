#include <glib.h>
#include <glib-unix.h>
#include <libsoup/soup.h>
#include <gst/gst.h>
#include <json-glib/json-glib.h>
#define GST_USE_UNSTABLE_API
#include <gst/webrtc/webrtc.h>

static gchar *ws_server_addr = "192.168.2.181";
static gint ws_server_port = 8080;
static gboolean is_wss = FALSE;
static GMainLoop *main_loop;

SoupWebsocketConnection *connection;
GstElement *webrtcbin;
GstElement *pipeline;

static GOptionEntry opt_entries[] = {
    {"address", 'a', 0, G_OPTION_ARG_STRING, &ws_server_addr, "Websocket server address (default: echo.websocket.org)", NULL},
    {"port", 'p', 0, G_OPTION_ARG_INT, &ws_server_port, "Websocket server port (default: 80)", NULL},
    {"is_wss", 's', 0, G_OPTION_ARG_NONE, &is_wss, "Enable wss connection (default: disabled)", NULL},
    {NULL},

};

static gboolean sig_handler(gpointer data)
{
    g_main_loop_quit(main_loop);
    return G_SOURCE_REMOVE;
}

// static void on_message(SoupWebsocketConnection *conn, gint type, GBytes *message, gpointer data)
// {
//     if (type == SOUP_WEBSOCKET_DATA_TEXT)
//     {
//         gsize sz;
//         const gchar *ptr;

//         ptr = g_bytes_get_data(message, &sz);
//         g_print("Received: %s\n", ptr);

//         soup_websocket_connection_send_text(conn, "{\"src\":\"videosource\", \"dst\":\"videoclient\", \"type\":\"info\", \"data\":\"Hello from Video Source\"}");
//     }
//     else if (type == SOUP_WEBSOCKET_DATA_BINARY)
//     {
//         g_print("Received binary data (not shown)\n");
//     }
//     else
//     {
//         g_print("Invalid data type: %d\n", type);
//     }
// }

void
on_message (G_GNUC_UNUSED SoupWebsocketConnection * connection,
    SoupWebsocketDataType data_type, GBytes * message, gpointer user_data)
{
  gsize size;
  gchar *data;
  gchar *data_string;
  const gchar *type_string;
  JsonNode *root_json;
  JsonObject *root_json_object;
  JsonObject *data_json_object;
  JsonParser *json_parser = NULL;
  //ReceiverEntry *receiver_entry = (ReceiverEntry *) user_data;

  switch (data_type) {
    case SOUP_WEBSOCKET_DATA_BINARY:
      g_error ("Received unknown binary message, ignoring\n");
      g_bytes_unref (message);
      return;

    case SOUP_WEBSOCKET_DATA_TEXT:
      data = g_bytes_unref_to_data (message, &size);
      /* Convert to NULL-terminated string */
      data_string = g_strndup (data, size);
      g_free (data);
      break;

    default:
      g_assert_not_reached ();
  }

  json_parser = json_parser_new ();
  if (!json_parser_load_from_data (json_parser, data_string, -1, NULL))
    goto unknown_message;

  root_json = json_parser_get_root (json_parser);
  if (!JSON_NODE_HOLDS_OBJECT (root_json))
    goto unknown_message;

  root_json_object = json_node_get_object (root_json);

  if (!json_object_has_member (root_json_object, "type")) {
    g_error ("Received message without type field\n");
    goto cleanup;
  }
  type_string = json_object_get_string_member (root_json_object, "type");

  if (!json_object_has_member (root_json_object, "data")) {
    g_error ("Received message without data field\n");
    goto cleanup;
  }
  data_json_object = json_object_get_object_member (root_json_object, "data");

  if (g_strcmp0 (type_string, "sdp") == 0) {
    const gchar *sdp_type_string;
    const gchar *sdp_string;
    GstPromise *promise;
    GstSDPMessage *sdp;
    GstWebRTCSessionDescription *answer;
    int ret;

    if (!json_object_has_member (data_json_object, "type")) {
      g_error ("Received SDP message without type field\n");
      goto cleanup;
    }
    sdp_type_string = json_object_get_string_member (data_json_object, "type");

    if (g_strcmp0 (sdp_type_string, "answer") != 0) {
      g_error ("Expected SDP message type \"answer\", got \"%s\"\n",
          sdp_type_string);
      goto cleanup;
    }

    if (!json_object_has_member (data_json_object, "sdp")) {
      g_error ("Received SDP message without SDP string\n");
      goto cleanup;
    }
    sdp_string = json_object_get_string_member (data_json_object, "sdp");

    gst_print ("Received SDP:\n%s\n", sdp_string);

    ret = gst_sdp_message_new (&sdp);
    g_assert_cmphex (ret, ==, GST_SDP_OK);

    ret =
        gst_sdp_message_parse_buffer ((guint8 *) sdp_string,
        strlen (sdp_string), sdp);
    if (ret != GST_SDP_OK) {
      g_error ("Could not parse SDP string\n");
      goto cleanup;
    }

    answer = gst_webrtc_session_description_new (GST_WEBRTC_SDP_TYPE_ANSWER,
        sdp);
    g_assert_nonnull (answer);

    promise = gst_promise_new ();
    g_signal_emit_by_name (webrtcbin, "set-remote-description",
        answer, promise);
    gst_promise_interrupt (promise);
    gst_promise_unref (promise);
    gst_webrtc_session_description_free (answer);
  } else if (g_strcmp0 (type_string, "ice") == 0) {
    guint mline_index;
    const gchar *candidate_string;

    if (!json_object_has_member (data_json_object, "sdpMLineIndex")) {
      g_error ("Received ICE message without mline index\n");
      goto cleanup;
    }
    mline_index =
        json_object_get_int_member (data_json_object, "sdpMLineIndex");

    if (!json_object_has_member (data_json_object, "candidate")) {
      g_error ("Received ICE message without ICE candidate string\n");
      goto cleanup;
    }
    candidate_string = json_object_get_string_member (data_json_object,
        "candidate");

    gst_print ("Received ICE candidate with mline index %u; candidate: %s\n",
        mline_index, candidate_string);

    g_signal_emit_by_name (webrtcbin, "add-ice-candidate",
        mline_index, candidate_string);
  } else
    goto unknown_message;

    cleanup:
  if (json_parser != NULL)
    g_object_unref (G_OBJECT (json_parser));
  g_free (data_string);
  return;

unknown_message:
  g_error ("Unknown message \"%s\", ignoring", data_string);
  goto cleanup;
}


static void on_close(SoupWebsocketConnection *conn, gpointer data)
{
    soup_websocket_connection_close(conn, SOUP_WEBSOCKET_CLOSE_NORMAL, NULL);
    g_print("WebSocket connection closed\n");
}

static gchar *
get_string_from_json_object (JsonObject * object)
{
  JsonNode *root;
  JsonGenerator *generator;
  gchar *text;

  /* Make it the root node */
  root = json_node_init_object (json_node_alloc (), object);
  generator = json_generator_new ();
  json_generator_set_root (generator, root);
  text = json_generator_to_data (generator, NULL);

  /* Release everything */
  g_object_unref (generator);
  json_node_free (root);
  return text;
}

void
on_offer_created_cb (GstPromise * promise, gpointer user_data)
{
  gchar *sdp_string;
  gchar *json_string;
  JsonObject *sdp_json;
  JsonObject *sdp_data_json;
  GstStructure const *reply;
  GstPromise *local_desc_promise;
  GstWebRTCSessionDescription *offer = NULL;
  //GK ReceiverEntry *receiver_entry = (ReceiverEntry *) user_data;

  reply = gst_promise_get_reply (promise);
  gst_structure_get (reply, "offer", GST_TYPE_WEBRTC_SESSION_DESCRIPTION, &offer, NULL);
  gst_promise_unref (promise);

  local_desc_promise = gst_promise_new ();
  g_signal_emit_by_name (webrtcbin, "set-local-description", offer, local_desc_promise);
  gst_promise_interrupt (local_desc_promise);
  gst_promise_unref (local_desc_promise);

  sdp_string = gst_sdp_message_as_text (offer->sdp);
  gst_print ("Negotiation offer created:\n%s\n", sdp_string);

  sdp_json = json_object_new ();
  json_object_set_string_member (sdp_json, "type", "sdp");

  sdp_data_json = json_object_new ();
  json_object_set_string_member (sdp_data_json, "type", "offer");
  json_object_set_string_member (sdp_data_json, "sdp", sdp_string);
  json_object_set_object_member (sdp_json, "data", sdp_data_json);

  json_string = get_string_from_json_object (sdp_json);
  json_object_unref (sdp_json);

  soup_websocket_connection_send_text (connection, json_string);
  g_free (json_string);
  g_free (sdp_string);

  gst_webrtc_session_description_free (offer);
}


void
on_negotiation_needed_cb (GstElement * webrtcbin, gpointer user_data)
{
    GstPromise *promise;

    g_print ("on_negotiation_needed_cb, start creating offer\n");
    promise = gst_promise_new_with_change_func (on_offer_created_cb, NULL, NULL);
    g_signal_emit_by_name (G_OBJECT (webrtcbin), "create-offer", NULL, promise);
}


void
on_ice_candidate_cb (G_GNUC_UNUSED GstElement * webrtcbin, guint mline_index,
    gchar * candidate, gpointer user_data)
{
    //g_print ("on_ice_candidate_cb\n");

    JsonObject *ice_json;
    JsonObject *ice_data_json;
    gchar *json_string;

    ice_json = json_object_new ();
    json_object_set_string_member (ice_json, "type", "ice");

    ice_data_json = json_object_new ();
    json_object_set_int_member (ice_data_json, "sdpMLineIndex", mline_index);
    json_object_set_string_member (ice_data_json, "candidate", candidate);
    json_object_set_object_member (ice_json, "data", ice_data_json);

    json_string = get_string_from_json_object (ice_json);
    json_object_unref (ice_json);

    soup_websocket_connection_send_text (connection, json_string);
    g_free (json_string);
}


static void stream_video()
{
    GstWebRTCRTPTransceiver *trans;
    //GArray *transceivers;
    GError *error = NULL;

#if 0
    pipeline = gst_parse_launch (
        // DOESN'T WORK
        // ERROR:../ext/webrtc/webrtcsdp.c:500:_get_final_direction: code should not be reached
        // "webrtcbin bundle-policy=max-bundle name=webrtcbin "
        // " rtspsrc location=rtsp://admin:visio1234@192.168.5.13 ! queue ! application/x-rtp, media=video, encoding-name=H264, payload=96 ! webrtcbin. "

        // WORKS BUT WE DO TRANSCODE! WE WOULD LIKE TO JUST FORWARD RTP PACKETS FROM CAMERA!
        " webrtcbin name=webrtcbin "
        " rtspsrc location=rtsp://admin:visio1234@192.168.5.13 ! queue ! application/x-rtp, media=video, encoding-name=H264, payload=96 "
        " ! rtph264depay ! avdec_h264 "
        " ! queue max-size-buffers=1 "
        " ! x264enc bitrate=600 speed-preset=ultrafast tune=zerolatency key-int-max=15 ! video/x-h264,profile=constrained-baseline "
        " ! queue max-size-time=100000000 "
        " ! h264parse "
        " ! rtph264pay config-interval=-1 name=payloader aggregate-mode=zero-latency ! application/x-rtp,media=video,encoding-name=H264,payload=96 "
        " ! webrtcbin. "
        , &error);
#endif

#if 1
    // MULTIPLE TRACKS WORKS, but must send all 4 tracks to start WebRTC negotiation.
    //
    // VIDEO SOURCE COMMAND
    //
    // gst-launch-1.0
    // videotestsrc pattern=ball ! clockoverlay color=0 ! x264enc ! rtph264pay ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)96' ! udpsink host=192.168.2.183 port=5000
    // rtspsrc location=rtsp://admin:visio1234@192.168.5.13 ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)96' ! udpsink host=192.168.2.183 port=5001
    // videotestsrc pattern=smpte ! clockoverlay color=0 ! x264enc ! rtph264pay ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)96' ! udpsink host=192.168.2.183 port=5002
    // rtspsrc location=rtsp://admin:Visio#123@192.168.0.92:554/0/profile2/media.smp ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)98' ! udpsink host=192.168.2.183 port=5003
    pipeline = gst_parse_launch (
        " webrtcbin name=webrtcbin "
        " udpsrc port=5000 ! application/x-rtp,media=(string)video,clock-rate=(int)90000,encoding-name=(string)H264,payload=(int)96 "
        " ! webrtcbin. "
        " udpsrc port=5001 ! application/x-rtp,media=(string)video,clock-rate=(int)90000,encoding-name=(string)H264,payload=(int)96 "
        " ! webrtcbin. "
        " udpsrc port=5002 ! application/x-rtp,media=(string)video,clock-rate=(int)90000,encoding-name=(string)H264,payload=(int)96 "
        " ! webrtcbin. "
        " udpsrc port=5003 ! application/x-rtp,media=(string)video,clock-rate=(int)90000,encoding-name=(string)H264,payload=(int)98 "
        " ! webrtcbin. "
        , &error);
#endif

#if 0
    // WORKS, the source can be provided by testvideosrc or RTP stream from camera.
    // IMPORTANT! The payload number must match!
    // gst-launch-1.0 rtspsrc location=rtsp://admin:visio1234@192.168.5.13 ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)96' ! udpsink host=192.168.2.183 port=5000
    // gst-launch-1.0 videotestsrc ! x264enc ! rtph264pay ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)96' ! udpsink host=192.168.2.183 port=5000
    pipeline = gst_parse_launch (
        " webrtcbin name=webrtcbin "
        " udpsrc port=5000 ! application/x-rtp,media=(string)video,clock-rate=(int)90000,encoding-name=(string)H264,payload=(int)96 "
        " ! webrtcbin. "
        , &error);
#endif

#if 0
    // WORKS
    pipeline = gst_parse_launch (
        " webrtcbin name=webrtcbin "
        " videotestsrc ! clockoverlay color=0 "
        " ! videorate ! videoscale ! video/x-raw,width=640,height=360,framerate=15/1 ! videoconvert "
        " ! queue max-size-buffers=1 "
        " ! x264enc bitrate=600 speed-preset=ultrafast tune=zerolatency key-int-max=15 ! video/x-h264,profile=constrained-baseline "
        " ! queue max-size-time=100000000 "
        " ! h264parse "
        " ! rtph264pay config-interval=-1 name=payloader aggregate-mode=zero-latency ! application/x-rtp,media=video,encoding-name=H264,payload=96 "
        " ! webrtcbin. "
        , &error);
#endif

    if (error != NULL) {
        g_error ("Could not create WebRTC pipeline: %s\n", error->message);
        g_error_free (error);
        goto cleanup;
    }

    webrtcbin = gst_bin_get_by_name (GST_BIN (pipeline), "webrtcbin");
    g_assert (webrtcbin != NULL);

//   g_signal_emit_by_name (webrtcbin, "get-transceivers",
//       &transceivers);
  //GK DISABLE AUDIO  
  //g_assert (transceivers != NULL && transceivers->len > 1);
//   trans = g_array_index (transceivers, GstWebRTCRTPTransceiver *, 0);
//   g_object_set (trans, "direction",
//       GST_WEBRTC_RTP_TRANSCEIVER_DIRECTION_SENDONLY, NULL);
//   if (video_priority) {
//     GstWebRTCPriorityType priority;

//     priority = _priority_from_string (video_priority);
//     if (priority) {
//       GstWebRTCRTPSender *sender;

//       g_object_get (trans, "sender", &sender, NULL);
//       gst_webrtc_rtp_sender_set_priority (sender, priority);
//       g_object_unref (sender);
//     }
//   }
//   trans = g_array_index (transceivers, GstWebRTCRTPTransceiver *, 1);
//   g_object_set (trans, "direction",
//       GST_WEBRTC_RTP_TRANSCEIVER_DIRECTION_SENDONLY, NULL);
//   if (audio_priority) {
//     GstWebRTCPriorityType priority;

//     priority = _priority_from_string (audio_priority);
//     if (priority) {
//       GstWebRTCRTPSender *sender;

//       g_object_get (trans, "sender", &sender, NULL);
//       gst_webrtc_rtp_sender_set_priority (sender, priority);
//       g_object_unref (sender);
//     }
//   }
//   g_array_unref (transceivers);

    g_signal_connect (webrtcbin, "on-negotiation-needed",
        G_CALLBACK (on_negotiation_needed_cb), NULL);

    g_signal_connect (webrtcbin, "on-ice-candidate",
        G_CALLBACK (on_ice_candidate_cb), NULL);

    if (gst_element_set_state (pipeline, GST_STATE_PLAYING) == GST_STATE_CHANGE_FAILURE) {
        g_error ("Could not start pipeline");
    }

    g_print ("Pipeline started\n");
    return;

cleanup:
    return;
}

static void on_connection(SoupSession *session, GAsyncResult *res, gpointer data)
{
    GError *error = NULL;

    connection = soup_session_websocket_connect_finish(session, res, &error);
    if (error)
    {
        g_print("Error: %s\n", error->message);
        g_error_free(error);
        g_main_loop_quit(main_loop);
        return;
    }

    g_signal_connect(connection, "message", G_CALLBACK(on_message), NULL);
    g_signal_connect(connection, "closed", G_CALLBACK(on_close), NULL);

    soup_websocket_connection_send_text(connection, "{\"src\":\"videosource\", \"dst\":\"videoclient\", \"type\":\"info\", \"data\":\"Hello from Video Source\"}");

    stream_video();
}

int main(int argc, char **argv)
{
    GError *error = NULL;
    GOptionContext *context;

    gst_init (&argc, &argv);

    context = g_option_context_new("- WebSocket testing client");
    g_option_context_add_main_entries(context, opt_entries, NULL);
    if (!g_option_context_parse(context, &argc, &argv, &error))
    {
        g_error_free(error);
        return 1;
    }

    main_loop = g_main_loop_new(NULL, FALSE);

    g_unix_signal_add(SIGINT, (GSourceFunc)sig_handler, NULL);

    SoupSession *session;
    SoupMessage *msg;

    // Create the soup session with WS or WSS
    gchar *uri = NULL;
    session = soup_session_new();
    if (is_wss)
    {
        // Trick to enable the wss support
        gchar *wss_aliases[] = {"wss", NULL};
        g_object_set(session, SOUP_SESSION_HTTPS_ALIASES, wss_aliases, NULL);
        uri = g_strdup_printf("%s://%s:%d/videosource", "wss", ws_server_addr, ws_server_port);
    }
    else
    {
        uri = g_strdup_printf("%s://%s:%d/videosource", "ws", ws_server_addr, ws_server_port);
    }

    g_print("Connecting to: %s\n", uri);

    msg = soup_message_new(SOUP_METHOD_GET, uri);
    g_free(uri);

    soup_session_websocket_connect_async(
        session,
        msg,
        NULL, NULL, NULL,
        (GAsyncReadyCallback)on_connection,
        NULL);

    g_print("start main loop\n");
    g_main_loop_run(main_loop);

    g_main_loop_unref(main_loop);
    return 0;
}