import { parentPort } from 'worker_threads';
import { updateState, prepareStateForClient, handleSteppedTraining } from './logic.js';

let intervalId;

parentPort.on('message', ({ action }) => {
  if (action === 'start' && !intervalId) {
    intervalId = setInterval(() => {
      try {
        updateState();
        parentPort.postMessage(prepareStateForClient());
      } catch (error) {
        parentPort.postMessage({ error: error.message });
      }
    }, 15);
    scheduleTraining();
  } else if (action === 'stop' && intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
});

function scheduleTraining() {
  setTimeout(async () => {
    try {
      await handleSteppedTraining();
    } catch (error) {
      parentPort.postMessage({ error: error.message });
    }
    if (intervalId) scheduleTraining();
  }, 1000);
}
