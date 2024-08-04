import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { Worker } from 'worker_threads';
import zlib from 'zlib';
import { prepareStateForClient } from './logic.js';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

const wss = new WebSocketServer({ server });
const connections = new Set();
const worker = new Worker('./worker.js');

worker.on('message', (message) => {
  if (message.error) {
    console.error('Worker error:', message.error);
  } else {
    zlib.deflate(message, (err, buffer) => {
      if (!err) {
        connections.forEach(ws => {
          if (ws.readyState === ws.OPEN) {
            ws.send(buffer);
          }
        });
      } else {
        console.error('Error compressing message:', err);
      }
    });
  }
});

worker.on('error', (error) => console.error('Worker error:', error));

worker.postMessage({ action: 'start' });

wss.on('connection', ws => {
  zlib.deflate(prepareStateForClient(), (err, buffer) => {
    if (!err) {
      ws.send(buffer);
    } else {
      console.error('Error compressing initial state:', err);
    }
  });
  connections.add(ws);

  ws.on('close', () => connections.delete(ws));
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connections.delete(ws);
  });
});
