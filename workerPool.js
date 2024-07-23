import { Worker } from 'worker_threads';

class WorkerPool {
    constructor(workerPath, numWorkers) {
        this.workerPath = workerPath;
        this.workers = [];
        this.tasks = [];
        this.idleWorkers = [];

        for (let i = 0; i < numWorkers; i++) {
            const worker = new Worker(workerPath);
            worker.on('message', (result) => {
                const { resolve } = worker.currentTask;
                resolve(result);
                worker.currentTask = null;
                this.idleWorkers.push(worker);
                this.runNextTask();
            });
            worker.on('error', (err) => {
                const { reject } = worker.currentTask;
                reject(err);
                worker.currentTask = null;
                this.idleWorkers.push(worker);
                this.runNextTask();
            });
            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`Worker stopped with exit code ${code}`);
                }
            });
            this.workers.push(worker);
            this.idleWorkers.push(worker);
        }
    }

    runTask(task) {
        return new Promise((resolve, reject) => {
            this.tasks.push({ task, resolve, reject });
            this.runNextTask();
        });
    }

    runNextTask() {
        if (this.idleWorkers.length === 0 || this.tasks.length === 0) {
            return;
        }
        const worker = this.idleWorkers.pop();
        const { task, resolve, reject } = this.tasks.shift();
        worker.currentTask = { resolve, reject };
        worker.postMessage(task);
    }

    close() {
        for (const worker of this.workers) {
            worker.terminate();
        }
    }
}

export default WorkerPool;
