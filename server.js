import { writeHeapSnapshot } from 'v8';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { Worker } from 'worker_threads';
import { state, updateState } from './logic.js';

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

    // Crear un snapshot de memoria cuando RSS es mayor a 500 MB (por ejemplo)
    if (memoryUsage.rss > 500 * 1024 * 1024) {
        const snapshot = writeHeapSnapshot();
        console.log(`Heap snapshot written to ${snapshot}`);
    }
}, 1000);

const wss = new WebSocketServer({ server });

const connections = new Set();

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
