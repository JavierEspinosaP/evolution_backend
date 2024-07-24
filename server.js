// server.js
import { writeHeapSnapshot } from 'v8';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { Worker } from 'worker_threads';
import { state, updateState } from './logic.js';
import zlib from 'zlib';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

setInterval(() => {
    const memoryUsage = process.memoryUsage();
    console.log(`RSS: ${memoryUsage.rss / 1024 / 1024} MB`);
    console.log(`Heap Total: ${memoryUsage.heapTotal / 1024 / 1024} MB`);
    console.log(`Heap Used: ${memoryUsage.heapUsed / 1024 / 1024} MB`);
    console.log(`External: ${memoryUsage.external / 1024 / 1024} MB`);
}, 1000);

const wss = new WebSocketServer({ server });

const connections = new Set();

// Crear un único worker para manejar la actualización de estado
const worker = new Worker('./worker.js');

worker.on('message', (updatedState) => {
    const message = JSON.stringify(updatedState);
    // Comprimir el mensaje para reducir el uso de memoria y ancho de banda
    zlib.deflate(message, (err, buffer) => {
        if (!err) {
            // Enviar el estado actualizado a todas las conexiones activas
            connections.forEach(ws => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(buffer);
                }
            });
        } else {
            console.error('Error compressing message:', err);
        }
    });
});

// Iniciar el worker
worker.postMessage({ action: 'start' });

wss.on('connection', ws => {
    // Enviar estado inicial comprimido
    zlib.deflate(JSON.stringify(state), (err, buffer) => {
        if (!err) {
            ws.send(buffer);
        } else {
            console.error('Error compressing initial state:', err);
        }
    });
    connections.add(ws);

    ws.on('close', () => {
        connections.delete(ws);
        ws.terminate(); // Asegúrate de cerrar la conexión adecuadamente
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        connections.delete(ws);
        ws.terminate(); // Asegúrate de cerrar la conexión en caso de error
    });
});

// Actualizar el estado periódicamente
setInterval(() => {
    updateState();
    worker.postMessage({ action: 'update' });
}, 1000);