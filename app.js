// app.js
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { WebSocketServer } from 'ws';
import { Worker } from 'node:worker_threads';
import { state } from './logic.js';

export const createServer = () => {
    const fastify = Fastify();
    const port = 3000;

    fastify.register(cors, { origin: '*' });

    fastify.listen(port, (err, address) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        console.log(`Server running at ${address}`);
    });

    const server = fastify.server;
    const wss = new WebSocketServer({ server });

    const connections = [];

    // Crear un único worker para manejar la actualización de estado
    const stateWorker = new Worker('./worker.js', { workerData: { task: 'updateState' } });

    stateWorker.on('message', (updatedState) => {
        // Enviar el estado actualizado a todas las conexiones activas
        connections.forEach(ws => {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify(updatedState));
            }
        });
    });

    // Iniciar el worker
    stateWorker.postMessage({ action: 'start' });

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
};
