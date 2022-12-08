const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();

app.use(express.static(__dirname));

const httpServer = http.createServer(app);
const webSocketServer = new WebSocket.Server({ noServer: true });

webSocketServer.on('connection', function connection(ws) {
  ws.on('message', (message, isBinary) => {
    console.log(message.toString('utf8'));
    ws.send(message);
  });
});

httpServer.on('upgrade', function upgrade(request, socket, head) {
    webSocketServer.handleUpgrade(request, socket, head, function done(ws) {
        webSocketServer.emit('connection', ws, request);
    });
});

console.log("Listening on port 8080")
httpServer.listen(8080);