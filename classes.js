import { v4 as uuidv4 } from "uuid";
import { state } from "./logic.js";
import * as tf from "@tensorflow/tfjs";

// Clase para el agente DQN
class DQNAgent {
  constructor(stateSize, actionSize) {
    this.stateSize = stateSize;
    this.actionSize = actionSize;
    this.memory = [];
    this.gamma = 0.95; // Descuento de la recompensa
    this.epsilon = 1.0; // Parámetro de exploración
    this.epsilonMin = 0.01;
    this.epsilonDecay = 0.995;
    this.learningRate = 0.001;
    this.batchSize = 64; // Aumentar el batch size
    this.model = this.buildModel();
    this.trainingQueue = [];
    this.isTraining = false; // Bandera de entrenamiento
    this.memoryLimit = 5000; // Limitar la memoria a 5000 experiencias
  }

  remember(state, action, reward, nextState, done) {
    this.memory.push({ state, action, reward, nextState, done });
    if (this.memory.length > this.memoryLimit) {
      this.memory.shift(); // Eliminar la experiencia más antigua
    }
  }

  buildModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 16, inputShape: [this.stateSize], activation: "relu" }));
    model.add(tf.layers.dense({ units: 8, activation: "relu" }));
    model.add(tf.layers.dense({ units: this.actionSize, activation: "linear" }));
    model.compile({ optimizer: tf.train.adam(this.learningRate), loss: "meanSquaredError" });
    return model;
  }

  remember(state, action, reward, nextState, done) {
    this.memory.push({ state, action, reward, nextState, done });
  }

  act(state) {
    if (Math.random() <= this.epsilon) {
      return Math.floor(Math.random() * this.actionSize);
    }
    const qValues = this.model.predict(tf.tensor2d([state], [1, this.stateSize]));
    const action = qValues.argMax(1).dataSync()[0];
    qValues.dispose(); // Liberar tensor
    return action;
  }

  async replay() {
    if (this.memory.length < this.batchSize || this.isTraining) {
      return;
    }

    this.isTraining = true; // Establecer bandera de entrenamiento

    const minibatch = this.memory.slice(-this.batchSize);
    const promises = minibatch.map(async ({ state, action, reward, nextState, done }) => {
      let target = reward;
      if (!done) {
        const qValuesNext = this.model.predict(tf.tensor2d([nextState], [1, this.stateSize]));
        target += this.gamma * qValuesNext.max(1).dataSync()[0];
      }
      const qValues = this.model.predict(tf.tensor2d([state], [1, this.stateSize]));
      const targetF = qValues.dataSync();
      const targetArray = Array.from(targetF);
      targetArray[action] = target;
      this.trainingQueue.push(async () => {
        await this.model.fit(
          tf.tensor2d([state], [1, this.stateSize]),
          tf.tensor2d([targetArray], [1, this.actionSize]),
          { epochs: 1, verbose: 0 }
        );
      });
      if (qValuesNext) qValuesNext.dispose(); // Liberar tensor
      qValues.dispose(); // Liberar tensor
    });

    await Promise.all(promises);
    await this.processTrainingQueue();

    this.isTraining = false; // Restablecer bandera de entrenamiento

    if (this.epsilon > this.epsilonMin) {
      this.epsilon *= this.epsilonDecay;
    }
  }

  async processTrainingQueue() {
    while (this.trainingQueue.length > 0) {
      const trainFunc = this.trainingQueue.shift();
      await trainFunc();
    }
  }
}




export class Food {
  constructor() {
    this.id = uuidv4();
    this.pos = { x: Math.random() * 1900, y: Math.random() * 800 };
    this.type = Math.random() < 0.5 ? "normal" : "growth";
    this.vel = {
      x: (Math.random() - 0.5) * 0.25,
      y: (Math.random() - 0.5) * 0.25,
    };
    this.lifeTime = 3600; // Vida de 1 minuto (60 FPS * 60 segundos)
  }

  move() {
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.vel.x += (Math.random() - 0.5) * 0.025;
    this.vel.y += (Math.random() - 0.5) * 0.025;
    this.vel.x = Math.min(Math.max(this.vel.x, -0.125), 0.125);
    this.vel.y = Math.min(Math.max(this.vel.y, -0.125), 0.125);
    this.checkBorders();
  }

  checkBorders() {
    if (this.pos.x < 0 || this.pos.x > 1900) this.vel.x *= -1;
    if (this.pos.y < 0 || this.pos.y > 800) this.vel.y *= -1;
  }

  age() {
    this.lifeTime--;
    return this.lifeTime <= 0;
  }
}

class Creature {
  constructor(
    size = 11,
    pos = { x: Math.random() * 1900, y: Math.random() * 800 },
    color = getInitialColor(),
    speedMultiplier = 1.0,
    id = uuidv4(),
    existingModel = null
  ) {
    this.id = id;
    this.pos = pos;
    this.vel = { x: 0, y: 0 };
    this.acc = { x: 0, y: 0 };
    this.size = size;
    this.color = color;
    this.minSize = 5;
    this.lifeSpan = 10000;
    this.timeSinceLastMeal = 0;
    this.speedMultiplier = speedMultiplier;
    this.energy = 100;
    this.olfatoRange = map(this.size, this.minSize, 100, 75, 250);
    this.lastDirection = { x: 0, y: 0 };
    this.foodEaten = 0;
    this.preyEaten = 0;
    this.reproduced = false;
    this.ageCounter = 0;
    this.reproductions = 0;
    this.borderRepulsionAccum = { x: 0, y: 0 };
    this.agent = new DQNAgent(12, 4); // Cambiar el tamaño de acción a 4 para 4 direcciones
    this.reward = 0;
    this.cornerTimer = 0;
    this.immobileTimer = 0;
    this.borderTimer = 0;
    this.trainingCounter = 0; // Contador de entrenamientos
  }

  // Método para actualizar el estado y tomar una acción
  async updateState(state) {
    const action = this.agent.act(state);
    // Convertir la acción a un movimiento
    this.performAction(action);
    // Obtener la recompensa y el siguiente estado
    const { reward, nextState, done } = this.getEnvironmentFeedback();
    // Recordar la experiencia
    this.agent.remember(state, action, reward, nextState, done);
    if (done) {
      // Reiniciar la criatura o tomar otra acción apropiada
      await this.die();
    }
    // Entrenar la red Q con experiencias pasadas
    this.trainingCounter++;
    if (this.trainingCounter >= 10) { // Entrenar cada 10 ciclos
      await this.agent.replay();
      this.trainingCounter = 0;
    }
  }

  performAction(action) {
    // Implementar la lógica para mover la criatura según la acción tomada
    const force = { x: 0, y: 0 };
    switch (action) {
      case 0:
        force.x = 1;
        break;
      case 1:
        force.x = -1;
        break;
      case 2:
        force.y = 1;
        break;
      case 3:
        force.y = -1;
        break;
      default:
        break;
    }
    this.applyForce(force);
  }

  getEnvironmentFeedback() {
    // Implementar la lógica para obtener la recompensa y el siguiente estado
    const nextState = this.getState();
    const reward = this.calculateReward();
    const done = this.size <= this.minSize;
    return { reward, nextState, done };
  }

  getState() {
    const closestFood = this.findClosest(state.food);
    const closestPrey = this.findClosestPrey(state.creatures);
    const closestPredator = this.findClosestPredator(state.creatures);
    const distanceToLeft = this.pos.x;
    const distanceToRight = 1900 - this.pos.x;
    const distanceToTop = this.pos.y;
    const distanceToBottom = 800 - this.pos.y;

    const foodDistX = closestFood ? closestFood.pos.x - this.pos.x : 0;
    const foodDistY = closestFood ? closestFood.pos.y - this.pos.y : 0;
    const preyDistX = closestPrey ? closestPrey.pos.x - this.pos.x : 0;
    const preyDistY = closestPrey ? closestPrey.pos.y - this.pos.y : 0;
    const predatorDistX = closestPredator ? closestPredator.pos.x - this.pos.x : 0;
    const predatorDistY = closestPredator ? closestPredator.pos.y - this.pos.y : 0;

    return [
      foodDistX,
      foodDistY,
      preyDistX,
      preyDistY,
      predatorDistX,
      predatorDistY,
      this.size,
      this.energy,
      distanceToLeft,
      distanceToRight,
      distanceToTop,
      distanceToBottom,
    ];
  }

  calculateReward() {
    let reward = 0;
    if (this.foodEaten > 0) {
      reward += this.foodEaten;
    }
    if (this.preyEaten > 0) {
      reward += this.preyEaten * 2;
    }
    if (this.size > this.minSize) {
      reward += this.size * 0.1;
    }
    if (this.energy > 0) {
      reward += this.energy * 0.01;
    }
    return reward;
  }

  async die() {
    let creatureScore = this.ageCounter * (this.foodEaten + this.preyEaten);
    if (creatureScore > state.bestCreatureScore) {
      state.bestCreatureScore = creatureScore;
      state.bestCreatureBrainWeights = this.agent.model.getWeights().map(tensor => tensor.arraySync());
      console.log(`New best creature weights saved, Score: ${state.bestCreatureScore}`);
    }

    let index = state.creatures.indexOf(this);
    if (index > -1) {
      if (this.ageCounter > state.longestLivingDuration) {
        state.longestLivingDuration = this.ageCounter;
        state.longestLivingCreatures = [this];
      } else if (this.ageCounter === state.longestLivingDuration) {
        state.longestLivingCreatures.push(this);
      }
      state.creatures.splice(index, 1);
    }
    this.agent = null;
  }

  eat(foodArray) {
    for (let i = foodArray.length - 1; i >= 0; i--) {
      let food = foodArray[i];
      let d = this.dist(this.pos, food.pos);
      if (d < this.size) {
        this.consumeFood(food);
        foodArray.splice(i, 1);
        this.borderRepulsionAccum.x = 0;
        this.borderRepulsionAccum.y = 0;
        break;
      }
    }
  }

  async consumeFood(food) {
    if (food.type === "growth") {
      this.size += 4;
      this.energy += 200;
    } else {
      this.size += 2;
      this.energy += 100;
    }
    this.timeSinceLastMeal = 0;
    this.foodEaten++;
    this.reward += 1; // Recompensa por comer

    const distanceToLeft = this.pos.x;
    const distanceToRight = 1900 - this.pos.x;
    const distanceToTop = this.pos.y;
    const distanceToBottom = 800 - this.pos.y;

    const foodDistX = food.pos.x - this.pos.x;
    const foodDistY = food.pos.y - this.pos.y;

    if (this.agent) {
      this.agent.trainingQueue.push(async () => {
        await this.agent.model.fit(
          tf.tensor2d([[
            foodDistX,
            foodDistY,
            0,
            0,
            0,
            0,
            this.size,
            this.energy,
            distanceToLeft,
            distanceToRight,
            distanceToTop,
            distanceToBottom,
          ]]),
          tf.tensor2d([Array(this.agent.actionSize).fill(0).map((_, idx) => idx === 0 ? this.vel.x : this.vel.y)]), // Ajuste aquí
          { epochs: 1, verbose: 0 }
        );
      });
    }
  }

  async consumeCreature(other) {
    this.size += other.size / 2;
    this.timeSinceLastMeal = 0;
    this.energy += other.size * 50;
    this.preyEaten++;
    this.reward += 2; // Recompensa por comer otra criatura

    const distanceToLeft = this.pos.x;
    const distanceToRight = 1900 - this.pos.x;
    const distanceToTop = this.pos.y;
    const distanceToBottom = 800 - this.pos.y;

    const preyDistX = other.pos.x - this.pos.x;
    const preyDistY = other.pos.y - this.pos.y;

    if (this.agent) {
      this.agent.trainingQueue.push(async () => {
        const inputTensor = tf.tensor2d([[
          0,
          0,
          preyDistX,
          preyDistY,
          0,
          0,
          this.size,
          this.energy,
          distanceToLeft,
          distanceToRight,
          distanceToTop,
          distanceToBottom,
        ]]);
        const targetTensor = tf.tensor2d([Array(this.agent.actionSize).fill(0).map((_, idx) => idx === 0 ? this.vel.x : this.vel.y)]);
        await this.agent.model.fit(inputTensor, targetTensor, { epochs: 1, verbose: 0 });
        inputTensor.dispose(); // Liberar tensor
        targetTensor.dispose(); // Liberar tensor
      });
    }
  }

  eatCreature(creaturesArray) {
    for (let i = creaturesArray.length - 1; i >= 0; i--) {
      let creature = creaturesArray[i];
      let d = this.dist(this.pos, creature.pos);
      if (d < this.size && this.size > creature.size) {
        this.consumeCreature(creature);
        creaturesArray.splice(i, 1);
        break;
      }
    }
  }

  age() {
    this.ageCounter++; // Incrementa el contador de edad
    this.timeSinceLastMeal++;
    if (this.timeSinceLastMeal > 1000) {
      this.size -= 1;
      this.timeSinceLastMeal = 0;
      if (this.size < this.minSize) this.size = this.minSize;
    }
    if (this.size <= this.minSize) this.die();
  }

  checkMitosis(colorCounts) {
    if (this.size >= 37.5) this.reproduce(colorCounts);
  }

  async reproduce(colorCounts) {
    let numOffspring = this.calculateNumOffspring();
    let childSize = (this.size * 0.9) / numOffspring;
    let distance = this.size;

    for (let i = 0; i < numOffspring; i++) {
      let childColor = this.calculateChildColor(colorCounts);
      let childPos = this.generateChildPosition(distance);
      let child = new Creature(
        childSize,
        childPos,
        childColor,
        1.0,
        uuidv4(),
        this.agent.model // Pasar el modelo del agente a la criatura hija
      );

      if (child.agent && child.agent.model) {
        try {
          await child.agent.model.setWeights(this.agent.model.getWeights()); // Copiar los pesos
          await child.agent.model.mutate(Math.random() * 0.05 + 0.01); // Aplicar mutación
        } catch (error) {
          console.error("Error mutating child brain:", error);
        }
      } else {
        console.error("Child brain is null or invalid");
      }
      state.creatures.push(child);
    }

    this.size /= 3;
    if (this.size < this.minSize) this.size = this.minSize;
    this.reward += 3; // Recompensa por reproducirse
    this.reproductions++; // Incrementar el contador de reproducciones
  }

  calculateNumOffspring() {
    switch (state.season) {
      case "spring":
        return 5;
      case "summer":
        return 4;
      case "autumn":
        return Math.random() < 0.5 ? 4 : 3;
      case "winter":
        return 3;
      default:
        return 3;
    }
  }

  calculateChildColor(colorCounts) {
    let childColor = this.color;
    let mutationProbability = Math.min(0.1 * colorCounts[this.color], 0.9);

    if (Math.random() < mutationProbability) {
      if (state.currentMutationColor === null || state.mutationCount >= 10) {
        state.currentMutationColor = getRandomColor();
        state.mutationCount = 0;
      }
      childColor = state.currentMutationColor;
      state.mutationCount++;
    }
    return childColor;
  }

  generateChildPosition(distance) {
    let angle = Math.random() * Math.PI * 2;
    return {
      x: this.pos.x + Math.cos(angle) * distance,
      y: this.pos.y + Math.sin(angle) * distance,
    };
  }

  findClosest(food) {
    let closest = null;
    let closestDist = Infinity;
    for (let f of food) {
      let d = this.dist(this.pos, f.pos);
      if (d < closestDist) {
        closestDist = d;
        closest = f;
      }
    }
    return closest;
  }

  findClosestPrey(creatures) {
    let closest = null;
    let closestDist = Infinity;
    for (let c of creatures) {
      if (c.size < this.size && this.color !== c.color) {
        let d = this.dist(this.pos, c.pos);
        if (d < closestDist) {
          closestDist = d;
          closest = c;
        }
      }
    }
    return closest;
  }

  findClosestPredator(creatures) {
    let closest = null;
    let closestDist = Infinity;
    for (let c of creatures) {
      if (c.size > this.size && this.color !== c.color) {
        let d = this.dist(this.pos, c.pos);
        if (d < closestDist) {
          closestDist = d;
          closest = c;
        }
      }
    }
    return closest;
  }

  dist(pos1, pos2) {
    let dx = pos1.x - pos2.x;
    let dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  applyForce(force) {
    const smoothingFactor = 0.2;
    this.acc.x += force.x * smoothingFactor;
    this.acc.y += force.y * smoothingFactor;
  }

  updateVelocityAndPosition() {
    const previousPos = { ...this.pos };
    this.vel.x += this.acc.x;
    this.vel.y += this.acc.y;
    this.vel.x = Math.min(
      Math.max(this.vel.x, -this.speedMultiplier * state.frameRateMultiplier),
      this.speedMultiplier * state.frameRateMultiplier
    );
    this.vel.y = Math.min(
      Math.max(this.vel.y, -this.speedMultiplier * state.frameRateMultiplier),
      this.speedMultiplier * state.frameRateMultiplier
    );
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.acc.x = 0;
    this.acc.y = 0;

    this.handleBorders();

    if (this.isInCorner()) {
      this.cornerTimer++;
    } else {
      this.cornerTimer = 0;
    }

    if (this.isImmobile(previousPos)) {
      this.immobileTimer++;
    } else {
      this.immobileTimer = 0;
    }

    if (this.touchingBorder) {
      this.borderTimer++;
    } else {
      this.borderTimer = 0;
    }

    if (
      this.cornerTimer >= 180 ||
      this.immobileTimer >= 180 ||
      this.borderTimer >= 600
    ) {
      // 3 segundos para esquina/inmóvil, 10 segundos para borde
      this.die();
    }
  }

  isInCorner() {
    const cornerThreshold = 50;
    return (
      (this.pos.x <= cornerThreshold && this.pos.y <= cornerThreshold) ||
      (this.pos.x >= 1900 - cornerThreshold && this.pos.y <= cornerThreshold) ||
      (this.pos.x <= cornerThreshold && this.pos.y >= 800 - cornerThreshold) ||
      (this.pos.x >= 1900 - cornerThreshold &&
        this.pos.y >= 800 - cornerThreshold)
    );
  }

  isImmobile(previousPos) {
    const immobileThreshold = 1; // Threshold para considerar inmóvil
    const dx = this.pos.x - previousPos.x;
    const dy = this.pos.y - previousPos.y;
    return Math.abs(dx) < immobileThreshold && Math.abs(dy) < immobileThreshold;
  }

  handleBorders() {
    if (
      this.pos.x < 0 ||
      this.pos.x > 1900 ||
      this.pos.y < 0 ||
      this.pos.y > 800
    ) {
      this.die(); // Matar la criatura si toca el borde
    }
  }

  reduceEnergy() {
    let distance = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
    this.energy -= distance * 0.08;
    this.reward -= 0.01; // Penalización por moverse sin comer
  }

  checkEnergy() {
    if (this.energy <= 0) this.die();
  }
}

function getInitialColor() {
  const initialColors = ["red", "blue", "yellow", "green"];
  return initialColors[Math.floor(Math.random() * initialColors.length)];
}

function getRandomColor() {
  let newColor = `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
  return newColor;
}

function map(value, start1, stop1, start2, stop2) {
  return ((value - start1) / (stop1 - start1)) * (stop2 - stop2) + start2;
}

export { DQNAgent, Creature };

