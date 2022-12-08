// A list of available STUN servers.
// stun.l.google.com:19302
// stun1.l.google.com:19302
// stun2.l.google.com:19302
// stun3.l.google.com:19302
// stun4.l.google.com:19302
// stun01.sipphone.com
// stun.ekiga.net
// stun.fwdnet.net
// stun.ideasip.com
// stun.iptel.org
// stun.rixtelecom.se
// stun.schlund.de
// stunserver.org
// stun.softjoys.com
// stun.voiparound.com
// stun.voipbuster.com
// stun.voipstunt.com
// stun.voxgratia.org
// stun.xten.com
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
//const configuration = { iceServers: [] };
let pc = null;

// ---------- WebRTC ---------- //

async function openPeerConnection() {
    try {
        if (!pc) {
            pc = new RTCPeerConnection(configuration);
            addEventHandlers(pc);
        }
        const init = { direction: 'recvonly' };
        pc.addTransceiver('video', init);
        // pc.addTransceiver('audio', init);

        // Version 1.
        // const offer = await pc.createOffer();
        // await pc.setLocalDescription(offer);
        // Version 2.
        await pc.setLocalDescription();

        console.log('localDescription:', pc.localDescription);

        sendMessage('sdp', pc.localDescription);
    }
    catch (error) {
        console.log('openPeerConnection:', error);
    }
}

function closePeerConnection() {
    pc.close();
    console.log('pc.connectionState: ', pc.connectionState);
    pc = null;
}

function addEventHandlers(pc) {
    // Sent when the overall connectivity status of the RTCPeerConnection changes.
    pc.onconnectionstatechange = (event) => {
        console.log('pc.onconnectionstatechange', event);
    }

    // Sent when the remote peer adds an RTCDataChannel to the connection.
    pc.ondatachannel = (event) => {
        console.log('pc.ondatachannel', event);
    }

    // Sent to request that the specified candidate be transmitted to the remote peer.
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('pc.onicecandidate', event);
            sendMessage('ice', event.candidate)
        }
        else {
            console.log('pc.onicecandidate: No further candidates to come.');
            console.log('pc.localDescription:', pc.localDescription);
        }
    }

    // Sent to the connection if an error occurred during ICE candidate gathering. The event describes the error.
    pc.onicecandidateerror = (event) => {
        console.log('pc.onicecandidateerror', event);
    }

    // Sent when the state of the ICE connection changes, such as when it disconnects.
    pc.oniceconnectionstatechange = (event) => {
        console.log('pc.oniceconnectionstatechange', event);
    }

    // Sent when the ICE layer's gathering state, reflected by iceGatheringState, changes.
    pc.onicegatheringstatechange = (event) => {
        console.log('pc.onicegatheringstatechange', event);
    }

    // Sent when negotiation or renegotiation of the ICE connection needs to be performed.
    // This can happen both when first opening a connection as well as when it is necessary
    // to adapt to changing network conditions.
    // The receiver should respond by creating an offer and sending it to the other peer.
    pc.onnegotiationneeded = (event) => {
        console.log('pc.onnegotiationneeded', event);
    }

    // Sent when the connection's ICE signaling state changes.
    pc.onsignalingstatechange = (event) => {
        console.log('pc.onsignalingstatechange', event);
    }

    // Sent after a new track has been added to one of the RTCRtpReceiver instances which comprise the connection.
    pc.ontrack = (event) => {
        console.log('pc.ontrack', event);
        const videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.srcObject = new MediaStream([event.track]);
        videoElement.play();
        const videoPanel = document.querySelector('#video_panel');
        videoPanel.appendChild(videoElement);
        // const videoElement = document.querySelector("#video_main");
        // videoElement.srcObject = new MediaStream([event.track]);
        // videoElement.play();
    }
}

// ---------- WebRTC ---------- //

// ---------- WebSockets ---------- //
//GK const ws = new WebSocket(`wss://${location.host}/videoclient`);
const ws = new WebSocket(`ws://${location.host}/ws`);

// ws.onmessage = async (event) => {
//     const message = JSON.parse(event.data);
//     console.log('ws.onmessage:', message);
//     switch (message.type) {
//         case 'ice':
//             await pc.addIceCandidate(message.data);
//             break;
//         case 'sdp':
//             if (message.data.type === 'offer') {
//                 if (!pc) {
//                     pc = new RTCPeerConnection(configuration);
//                     addEventHandlers(pc);
//                 }

//                 const remoteDescription = message.data;
//                 await pc.setRemoteDescription(remoteDescription);
//                 console.log('remoteDescription:', pc.remoteDescription);

//                 const localDescription = await pc.createAnswer();
//                 await pc.setLocalDescription(localDescription);
//                 sendMessage('sdp', localDescription);
//                 console.log('localDescription:', pc.localDescription);
//             }
//             else if (message.data.type === 'answer') {
//                 const remoteDescription = message.data;
//                 await pc.setRemoteDescription(remoteDescription);
//                 console.log('remoteDescription:', pc.remoteDescription);
//             }
//             break;
//     }
// };
ws.onmessage = async (event) => {
    //const message = JSON.parse(event.data);
    console.log("ws.onmessage:", event.data);
}

function sendMessage(type, data) {
    const message = { src: 'videoclient', dst: 'videosource', type, data };
    ws.send(JSON.stringify(message));
    console.log('sendMessage: ', message);
}

// ---------- WebSockets ---------- //

function OpenWebRtcChannel() {
    ws.send(JSON.stringify({functionName: "OpenWebRtcChannel", arguments: ["a", 1,]}));
}

// ---------- Video Client Page ---------- //
document.querySelector("#button_OpenWebRtcChannel")
  .addEventListener("click", OpenWebRtcChannel);

// document.querySelector('#button_open')
//     .addEventListener('click', openPeerConnection);

// document.querySelector('#button_close')
//     .addEventListener('click', closePeerConnection);

// document.querySelector('#button_state')
//     .addEventListener('click', () => {
//         if (pc) {
//             console.log(pc.connectionState);
//             console.log(pc.getTransceivers());
//         }
//         else {
//             console.log('null');
//         }
//     });

// document.querySelector('#button_message')
//     .addEventListener('click', () => { sendMessage('info', 'Hello from Video Client'); });

// document.querySelector('#button_experiment1')
//     .addEventListener('click', async () => {
//         const configuration = { iceServers: [] };
//         //const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
//         const init = { direction: 'sendrecv' };
//         const pc1 = new RTCPeerConnection(configuration);
//         pc1.addTransceiver('video', init);
//         const pc2 = new RTCPeerConnection(configuration);
//         pc2.addTransceiver('video', init);

//         pc1.onicecandidate = async (event) => {
//             console.log('pc1.onicecandidate', event.candidate);
//             await pc2.addIceCandidate(event.candidate);
//         };

//         pc1.onconnectionstatechange = (event) => {
//             console.log('pc1.onconnectionstatechange', event);
//         }

//         pc1.onicecandidateerror = (event) => {
//             console.log('pc1.onicecandidateerror', event);
//         }

//         pc1.oniceconnectionstatechange = (event) => {
//             console.log('pc1.oniceconnectionstatechange', event);
//         }

//         pc1.onicegatheringstatechange = (event) => {
//             console.log('pc1.onicegatheringstatechange', event);
//         }

//         pc1.onnegotiationneeded = (event) => {
//             console.log('pc1.onnegotiationneeded', event);
//         }

//         pc2.onicecandidate = async (event) => {
//             console.log('pc2.onicecandidate', event.candidate);
//             await pc1.addIceCandidate(event.candidate);
//         };

//         pc2.onconnectionstatechange = (event) => {
//             console.log('pc2.onconnectionstatechange', event);
//         }

//         pc2.onicecandidateerror = (event) => {
//             console.log('pc2.onicecandidateerror', event);
//         }

//         pc2.oniceconnectionstatechange = (event) => {
//             console.log('pc2.oniceconnectionstatechange', event);
//         }

//         pc2.onicegatheringstatechange = (event) => {
//             console.log('pc2.onicegatheringstatechange', event);
//         }

//         pc2.onnegotiationneeded = async (event) => {
//             console.log('pc2.onnegotiationneeded', event);
//             const pc2LocalDesc = await pc2.createOffer();
//             await pc2.setLocalDescription(pc2LocalDesc);
//             await pc1.setRemoteDescription(pc2LocalDesc);
//             // const pc2LocalDesc = await pc2.createAnswer();
//             // await pc2.setLocalDescription(pc2LocalDesc);
//             // await pc1.setRemoteDescription(pc2LocalDesc);
//         }

//         const pc1LocalDesc = await pc1.createOffer();
//         await pc1.setLocalDescription(pc1LocalDesc);
//         await pc2.setRemoteDescription(pc1LocalDesc);
//         const pc2LocalDesc = await pc2.createAnswer();
//         await pc2.setLocalDescription(pc2LocalDesc);
//         await pc1.setRemoteDescription(pc2LocalDesc);

//         console.log(pc1.connectionState);
//         console.log(pc2.connectionState);
//     });

// document.querySelector('#button_experiment2')
//     .addEventListener('click', async () => {
//         const pc1 = new RTCPeerConnection();
//         const pc2 = new RTCPeerConnection();

//         pc1.onicecandidate = e => { console.log('pc1.onicecandidate', e); pc2.addIceCandidate(e.candidate); };
//         pc2.onicecandidate = e => { console.log('pc2.onicecandidate', e); pc1.addIceCandidate(e.candidate); };

//         pc2.ontrack = e => {
//             console.log('pc2.ontrack', e);
//             console.log('pc2.connectionState', pc2.connectionState);

//             // No video in Chrome, works in Firefox?!
//             const videoElement = document.querySelector("#video_main");
//             videoElement.srcObject = new MediaStream([e.track]);
//             videoElement.play();
//         };

//         const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
//         stream.getTracks().forEach(t => pc1.addTrack(t, stream));

//         await pc1.setLocalDescription();
//         console.log('pc1.localDescription:', pc1.localDescription);
//         await pc2.setRemoteDescription(pc1.localDescription);
//         await pc2.setLocalDescription();
//         console.log('pc2.localDescription:', pc2.localDescription);
//         await pc1.setRemoteDescription(pc2.localDescription);
//     });

// ---------- Video Client Page ---------- //