// ---------- WebSockets ---------- //
const ws = new WebSocket(`ws://${location.host}/`);

ws.onmessage = async (event) => {
    console.log('ws.onmessage:', await event.data.text());
};

function sendMessage(message) {
    console.log('sendMessage: ', message);
    ws.send(message);
}
// ---------- WebSockets ---------- //

// ---------- Page ---------- //
document.querySelector('#button_SendMessage')
    .addEventListener('click', () => { sendMessage("Test1"); });
// ---------- Page ---------- //