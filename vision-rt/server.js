const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'vision-rt', time: new Date().toISOString() });
});

io.on('connection', (socket) => {
  socket.on('state_update', (payload) => {
    const envelope = {
      source: socket.id,
      timestamp: new Date().toISOString(),
      ...payload
    };
    io.emit('state_update', envelope);
  });

  socket.on('objects_update', (payload) => {
    const envelope = {
      source: socket.id,
      timestamp: new Date().toISOString(),
      ...payload
    };
    io.emit('objects_update', envelope);
  });
});

server.listen(PORT, () => {
  console.log(`[vision-rt] listening on http://localhost:${PORT}`);
});