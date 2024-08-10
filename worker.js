import { parentPort } from 'worker_threads';
import { updateState, state } from './logic.js';

let intervalId;

parentPort.on('message', (message) => {
    if (message.action === 'start') {
        if (!intervalId) {
            intervalId = setInterval(() => {
                updateState();
                parentPort.postMessage(state);
            }, 10);
        }
    } else if (message.action === 'stop') {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }
});
