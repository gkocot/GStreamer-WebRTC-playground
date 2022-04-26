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

// No internet access, experimenting.
// Removed STUN servers so the ICE doesn't error.
// Cannot get video in Chrome, Firefox works?!
//const configuration = { iceServers: [] };

let pc = null;
const mediaStreams = [null, null, null, null];
let mediaIndex = 0;
let currentMediaIndex = 0;
let sender = null;

const mediaStreamMain = new MediaStream();

// ---------- WebRTC ---------- //

async function openPeerConnection() {
    try {
        if (!pc) {
            pc = new RTCPeerConnection(configuration);
            addEventHandlers(pc);

            const init = { direction: 'sendonly' };
            pc.addTransceiver('video', init);

            if (mediaStreams[currentMediaIndex]) {
                sender = pc.addTrack(mediaStreams[currentMediaIndex].getTracks()[0]);
            }
        }

        // Version 1
        // const offer = await pc.createOffer();
        // await pc.setLocalDescription(offer);
        // Version 2
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
    pc.onnegotiationneeded = async (event) => {
        console.log('pc.onnegotiationneeded', event);

        const localDescription = await pc.createOffer();
        await pc.setLocalDescription(localDescription);
        sendMessage('sdp', localDescription);
        console.log('localDescription:', pc.localDescription);
    }

    // Sent when the connection's ICE signaling state changes.
    pc.onsignalingstatechange = (event) => {
        console.log('pc.onsignalingstatechange', event);
    }

    // Sent after a new track has been added to one of the RTCRtpReceiver instances which comprise the connection.
    pc.ontrack = (event) => {
        console.log('pc.ontrack', event);
    }
}

// ---------- WebRTC ---------- //

// ---------- WebSockets ---------- //
const ws = new WebSocket(`wss://${location.host}/videosource`);

ws.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    console.log('ws.onmessage:', message);
    switch (message.type) {
        case 'ice':
            await pc.addIceCandidate(message.data);
            break;
        case 'sdp':
            if (message.data.type === 'offer') {
                if (!pc) {
                    pc = new RTCPeerConnection(configuration);
                    addEventHandlers(pc);

                    if (mediaStreams[currentMediaIndex]) {
                        sender = pc.addTrack(mediaStreams[currentMediaIndex].getTracks()[0]);
                    }
                }

                const remoteDescription = message.data;
                await pc.setRemoteDescription(remoteDescription);
                console.log('remoteDescription:', pc.remoteDescription);

                // Version 1
                // const localDescription = await pc.createAnswer();
                // Version 2
                await pc.setLocalDescription();
                sendMessage('sdp', pc.localDescription);
                console.log('localDescription:', pc.localDescription);
            }
            else if (message.data.type === 'answer') {
                const remoteDescription = message.data;
                await pc.setRemoteDescription(remoteDescription);
                console.log('remoteDescription:', pc.remoteDescription);
            }
            break;
    }
};

function sendMessage(type, data) {
    const message = { src: 'videosource', dst: 'videoclient', type, data };
    ws.send(JSON.stringify(message));
    console.log('sendMessage: ', message);
}

// ---------- WebSockets ---------- //

// ---------- Video Source Page ---------- //
document.querySelector('#button_open')
    .addEventListener('click', openPeerConnection);

document.querySelector('#button_close')
    .addEventListener('click', closePeerConnection);

document.querySelector('#button_state')
    .addEventListener('click', () => {
        if (pc) {
            console.log(pc.connectionState);
            console.log(pc.getTransceivers());
        }
        else {
            console.log('null');
        }
    });

document.querySelector('#button_message')
    .addEventListener('click', () => { sendMessage('info', 'Hello from Video Source'); });

document.querySelector("#button_add_media")
    .addEventListener('click', addMedia);

document.querySelector("#video0")
    .addEventListener('click', () => { streamMedia(0); });

document.querySelector("#video1")
    .addEventListener('click', () => { streamMedia(1); });

document.querySelector("#video2")
    .addEventListener('click', () => { streamMedia(2); });

document.querySelector("#video3")
    .addEventListener('click', () => { streamMedia(3); });

async function addMedia() {
    mediaStreams[mediaIndex] = await navigator.mediaDevices.getDisplayMedia();

    const videoElement = document.querySelector(`#video${mediaIndex}`);
    videoElement.srcObject = mediaStreams[mediaIndex];
    videoElement.play();

    await streamMedia(mediaIndex);

    mediaIndex = (mediaIndex + 1) % 4;
}

async function streamMedia(index) {
    if (mediaStreams[index]) {
        currentMediaIndex = index;

        // Preview.
        const videoMainElement = document.querySelector('#video_main');
        videoMainElement.srcObject = new MediaStream([mediaStreams[currentMediaIndex].getTracks()[0]]);
        videoMainElement.play();

        if (pc) {
            if (sender) {
                await sender.replaceTrack(mediaStreams[currentMediaIndex].getTracks()[0]);
            }
            else {
                sender = pc.addTrack(mediaStreams[currentMediaIndex].getTracks()[0]);
            }
        }
    }
}

// ---------- Video Source Page ---------- //