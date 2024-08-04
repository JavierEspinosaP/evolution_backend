import { parentPort } from 'worker_threads';
import { updateState, prepareStateForClient, handleSteppedTraining } from './logic.js';

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
      }, 15);  // Ajuste del intervalo para reducir la carga de procesamiento
      scheduleTraining();
    }
  } else if (message.action === 'stop') {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
});

function scheduleTraining() {
  setTimeout(async () => {
    try {
      await handleSteppedTraining();
    } catch (error) {
      parentPort.postMessage({ error: error.message });
    }
    if (intervalId) {
      scheduleTraining();
    }
  }, 1000);  // Ajuste del tiempo de espera para optimizar el procesamiento
}
