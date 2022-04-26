const express = require('express');
const http = require('http');
const https = require('https');
const { readFileSync } = require('fs');
const WebSocket = require('ws');
const { parse } = require('url');

const key = readFileSync(__dirname + '/ssl/server.key');
const cert = readFileSync(__dirname + '/ssl/server.crt');
const options = { key, cert };

const app = express();

app.use(express.static(__dirname));

const httpServer = http.createServer(app);
const httpsServer = https.createServer(options, app);
const videoClientWebSocketServer = new WebSocket.Server({ noServer: true });
const videoSourceWebSocketServer = new WebSocket.Server({ noServer: true });

videoClientWebSocketServer.on('connection', function connection(ws) {
  ws.on('message', (message, isBinary) => {
    forward(videoSourceWebSocketServer, message, isBinary);
  });

  // TBD sendMessage
  // TBD Temporaryli disabled, different message format expected in videosource.c
  // const respmsg = { src: 'signaling', dst: 'videoclient', type: 'info', data: '{"msg": "connected"}' };
  // ws.send(JSON.stringify(respmsg));
});

videoSourceWebSocketServer.on('connection', function connection(ws) {
  ws.on('message', (message, isBinary) => {
    forward(videoClientWebSocketServer, message, isBinary);
  });

  // TBD sendMessage
  // TBD Temporaryli disabled, different message format expected in videosource.c
  // const respmsg = { src: 'signaling', dst: 'videosource', type: 'info', data: '{"msg": "connected"}' };
  // ws.send(JSON.stringify(respmsg));
});

httpServer.on('upgrade', function upgrade(request, socket, head) {
  const { pathname } = parse(request.url);

  if (pathname === '/videoclient') {
    videoClientWebSocketServer.handleUpgrade(request, socket, head, function done(ws) {
      videoClientWebSocketServer.emit('connection', ws, request);
    });
  } else if (pathname === '/videosource') {
    videoSourceWebSocketServer.handleUpgrade(request, socket, head, function done(ws) {
      videoSourceWebSocketServer.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

httpsServer.on('upgrade', function upgrade(request, socket, head) {
  const { pathname } = parse(request.url);

  if (pathname === '/videoclient') {
    videoClientWebSocketServer.handleUpgrade(request, socket, head, function done(ws) {
      videoClientWebSocketServer.emit('connection', ws, request);
    });
  } else if (pathname === '/videosource') {
    videoSourceWebSocketServer.handleUpgrade(request, socket, head, function done(ws) {
      videoSourceWebSocketServer.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

function forward(wss, message, isBinary) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message, { binary: isBinary });
    }
  });
}

httpServer.listen(8080);
httpsServer.listen(8443);
