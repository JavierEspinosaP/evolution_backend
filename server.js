// server.js
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { Worker } from 'node:worker_threads';
import { state } from './logic.js';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

const wss = new WebSocketServer({ server });

const connections = [];

// Crear un único worker para manejar la actualización de estado
const worker = new Worker('./worker.js');

worker.on('message', (updatedState) => {
    // Enviar el estado actualizado a todas las conexiones activas
    connections.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(updatedState));
        }
    });
});

// Iniciar el worker
worker.postMessage({ action: 'start' });

wss.on('connection', ws => {
    ws.send(JSON.stringify(state));
    connections.push(ws);

    ws.on('close', () => {
        const index = connections.indexOf(ws);
        if (index !== -1) {
            connections.splice(index, 1);
        }
    });
});
