# GStreamer-WebRTC-playground

Playground for experimenting with GStreamer and WebRTC

# Building on Ubuntu 20.04

At the time of writing this instruction GStreamer sources moved to common source tree (mono tree)
https://gitlab.freedesktop.org/gstreamer/gstreamer and the most recent version was 1.20.1
The README.md is a good starting point but I was not able to successfully build and install GStreamer using only these instructions.

To build and install GStreamer from sources you will need Meson and ninja.
Remove the Meson version that comes with Ubuntu 20.04, it is too old for building GStreamer 1.20.1

```
sudo apt remove --purge Meson (or something like that)
```

Install Meson with pip3 https://mesonbuild.com/Getting-meson.html
Make sure to install Meson as root, without this you won't be able to install GStreamer into system directories.

```
sudo pip3 install meson
```

Get the sources, compile, test and install.
Good hints for compiling found at https://www.linuxfromscratch.org/blfs/view/svn/multimedia/gstreamer10.html

```
git clone https://gitlab.freedesktop.org/gstreamer/gstreamer
cd ./gstreamer/subprojects/gstreamer
mkdir build
cd build
meson --prefix=/usr --buildtype=release -Dgst_debug=false -Dpackage-origin=https://gitlab.freedesktop.org/gstreamer/gstreamer -Dpackage-name="GStreamer 1.20.1" && ninja
ninja test
sudo ninja install
```

Compiling GStreamer plugins should be a similar process to the one described above.
I haven't tried it yet.

# Building in Docker

```
docker build -t ubuntu-dev-gstreamer - < Dockerfile
docker run -dit -v $(pwd)/tutorials:/tutorials --network host --name mydev ubuntu-dev-gstreamer
```

# GSTreamer RTSP server, RTSP client

./test-launch "videotestsrc ! x264enc ! rtph264pay name=pay0 pt=96"
./test-launch "videotestsrc ! vp8enc ! rtpvp8pay name=pay0 pt=96"
gst-launch-1.0 rtspsrc location="rtsp://127.0.0.1:8554/test" ! decodebin ! autovideosink
gst-launch-1.0 rtspsrc location="rtsp://127.0.0.1:8554/test" ! rtph264depay ! h264parse ! avdec_h264 ! autovideosink
gst-launch-1.0 rtspsrc location="rtsp://127.0.0.1:8554/test" ! rtph264depay ! avdec_h264 ! autovideosink
gst-launch-1.0 rtspsrc location="rtsp://127.0.0.1:8554/test" ! rtpvp8depay ! vp8dec ! autovideosink

# GStreamer RTSP from IP camera (generate filter graph for debugging)

## Samsung doesn't work

GST_DEBUG_DUMP_DOT_DIR=`pwd` gst-launch-1.0 -v rtspsrc location=rtsp://admin:Visio#123@192.168.0.92:554/0/profile2/media.smp ! rtph264depay ! h264parse ! avdec_h264 ! autovideosin

## TruVision OK

GST_DEBUG_DUMP_DOT_DIR=`pwd` gst-launch-1.0 -v rtspsrc location="rtsp://admin:visio1234@192.168.5.104:554/Streaming/Channels/101?transportmode=unicast&profile=Profile_1" ! decodebin ! autovideosink
GST_DEBUG_DUMP_DOT_DIR=`pwd` gst-launch-1.0 -v rtspsrc location="rtsp://admin:visio1234@192.168.5.104:554/Streaming/Channels/101?transportmode=unicast&profile=Profile_1" ! rtph264depay ! h264parse ! avdec_h264 ! autovideosink

## Forwarding RTP packets (works with Samsung which has a problem with rtph264depay and VND.ONVOF.METADATA)

gst-launch-1.0 -v rtspsrc location=rtsp://admin:Visio#123@192.168.0.92:554/0/profile2/media.smp ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)98' ! udpsink host=192.168.2.183 port=5000

# Debugging

sudo apt install graphviz
dot -Tpng 0.00.00.018845094-gst-launch.READY_PAUSED.dot > 0.00.00.018845094-gst-launch.READY_PAUSED.png
eog 0.00.00.018845094-gst-launch.READY_PAUSED.png

GST_DEBUG_BIN_TO_DOT_FILE(receiver_entry->pipeline, GST_DEBUG_GRAPH_SHOW_ALL, "pipeline");
GST_DEBUG_DUMP_DOT_DIR=`pwd` ./webrtc-unidirectional-h264

# Experimenting

## Send/receive RTP

### Send test video

gst-launch-1.0 videotestsrc ! clockoverlay color=0 ! x264enc ! rtph264pay ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)96' ! udpsink host=192.168.2.183 port=5000

### Send RTP stream from camera

gst-launch-1.0 rtspsrc location=rtsp://admin:visio1234@192.168.5.13 ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)96' ! udpsink host=192.168.2.183 port=5000

### Multiple video sources

gst-launch-1.0 videotestsrc pattern=ball ! clockoverlay color=0 ! x264enc ! rtph264pay ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)96' ! udpsink host=192.168.2.183 port=5000 rtspsrc location=rtsp://admin:visio1234@192.168.5.13 ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)96' ! udpsink host=192.168.2.183 port=5001 videotestsrc pattern=smpte ! clockoverlay color=0 ! x264enc ! rtph264pay ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)96' ! udpsink host=192.168.2.183 port=5002 rtspsrc location=rtsp://admin:Visio#123@192.168.0.92:554/0/profile2/media.smp ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)98' ! udpsink host=192.168.2.183 port=5003

gst-launch-1.0 videotestsrc pattern=smpte ! clockoverlay color=0 ! x264enc intra-refresh=true key-int-max=10 ! rtph264pay mtu=1300 ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)96' ! udpsink host=192.168.2.183 port=10010

gst-launch-1.0 videotestsrc pattern=ball ! clockoverlay color=-1 ! x264enc intra-refresh=true key-int-max=10 ! rtph264pay mtu=1300 ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)96' ! udpsink host=192.168.2.183 port=10010

### Receive RTP stream

gst-launch-1.0 udpsrc caps="application/x-rtp,media=(string)video,clock-rate=(int)90000,encoding-name=(string)H264" port=5000 ! rtph264depay ! avdec_h264 ! fakesink dump=true

## Other

gst-launch-1.0 -v rtspsrc location=rtsp://admin:Visio#123@192.168.0.92:554/0/profile2/media.smp ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)98' ! udpsink host=192.168.2.183 port=5000

gst-launch-1.0 videotestsrc ! x264enc ! rtph264pay ! 'application/x-rtp,media=(string)video,encoding-name=(string)H264,payload=(int)98' ! udpsink host=192.168.2.183 port=5000
