import { parentPort } from 'worker_threads';
import { updateState, prepareStateForClient } from './logic.js';

let intervalId;

parentPort.on('message', (message) => {
    if (message.action === 'start') {
        if (!intervalId) {
            intervalId = setInterval(() => {
                try {
                    updateState();
                    const cleanState = prepareStateForClient();
                    parentPort.postMessage(cleanState);
                } catch (error) {
                    parentPort.postMessage({ error: error.message });
                }
            }, 15);
        }
    } else if (message.action === 'stop') {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }
});
