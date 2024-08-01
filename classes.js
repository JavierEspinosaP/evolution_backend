import { v4 as uuidv4 } from 'uuid';
import { state } from './logic.js';
import * as tf from '@tensorflow/tfjs';


class NeuralNetwork {
  constructor(inputSize, outputSize) {
      this.model = tf.sequential();
      this.model.add(tf.layers.dense({units: 16, inputShape: [inputSize], activation: 'relu'}));
      this.model.add(tf.layers.dense({units: outputSize, activation: 'tanh'}));
      this.model.compile({optimizer: 'sgd', loss: 'meanSquaredError'});
  }

  predict(inputs) {
      return tf.tidy(() => {
          const inputTensor = tf.tensor2d([inputs], [1, inputs.length]);
          const outputTensor = this.model.predict(inputTensor);
          const outputs = outputTensor.dataSync();
          return outputs;
      });
  }

  async mutate(rate) {
      const weights = this.model.getWeights();
      const newWeights = [];
      for (let tensor of weights) {
          let values = await tensor.data();
          for (let i = 0; i < values.length; i++) {
              if (Math.random() < rate) {
                  values[i] += Math.random() * 2 - 1;
              }
          }
          const newTensor = tf.tensor(values, tensor.shape);
          newWeights.push(newTensor);
      }
      this.model.setWeights(newWeights);
  }

  crossover(partner) {
      const weightsA = this.model.getWeights();
      const weightsB = partner.model.getWeights();
      const newWeights = [];
      for (let i = 0; i < weightsA.length; i++) {
          const shape = weightsA[i].shape;
          const valuesA = weightsA[i].dataSync();
          const valuesB = weightsB[i].dataSync();
          const newValues = [];
          for (let j = 0; j < valuesA.length; j++) {
              newValues[j] = Math.random() < 0.5 ? valuesA[j] : valuesB[j];
          }
          newWeights.push(tf.tensor(newValues, shape));
      }
      const child = new NeuralNetwork(weightsA[0].shape[0], weightsA[weightsA.length - 1].shape[0]);
      child.model.setWeights(newWeights);
      return child;
  }

  train(inputs, targets) {
    if (inputs.length === 0 || targets.length === 0) {
        console.error('Empty inputs or targets array in train method');
        return;
    }
    const inputTensor = tf.tensor2d(inputs, [inputs.length, inputs[0].length]);
    const targetTensor = tf.tensor2d(targets, [targets.length, targets[0].length]);
    return this.model.fit(inputTensor, targetTensor, {epochs: 1})
        .then(history => {
            inputTensor.dispose();
            targetTensor.dispose();
            return history;
        })
        .catch(error => {
            inputTensor.dispose();
            targetTensor.dispose();
            console.error('Error during training:', error);
        });
}

}

export class Food {
    constructor() {
        this.id = uuidv4();
        this.pos = { x: Math.random() * 1900, y: Math.random() * 800 };
        this.type = Math.random() < 0.5 ? 'normal' : 'growth';
        this.vel = { x: (Math.random() - 0.5) * 0.25, y: (Math.random() - 0.5) * 0.25 };
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


export class Creature {
  constructor(size = 11, pos = { x: Math.random() * 1900, y: Math.random() * 800 }, color = getInitialColor(), speedMultiplier = 1.0, id = uuidv4()) {
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
      this.borderRepulsionAccum = { x: 0, y: 0 };
      this.brain = new NeuralNetwork(6, 2); // Ejemplo de una red con 6 entradas y 2 salidas
      this.reward = 0;
  }

  applyForce(force) {
      const smoothingFactor = 0.2;
      this.acc.x += force.x * smoothingFactor;
      this.acc.y += force.y * smoothingFactor;
  }

  act(food, creatures) {
      const closestFood = this.findClosest(food);
      if (closestFood) {
          const inputs = [this.pos.x, this.pos.y, closestFood.pos.x, closestFood.pos.y, this.size, this.energy];
          const [dx, dy] = this.brain.predict(inputs);
          this.applyForce({ x: dx, y: dy });
      }
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

  updateVelocityAndPosition() {
      this.vel.x += this.acc.x;
      this.vel.y += this.acc.y;
      this.vel.x = Math.min(Math.max(this.vel.x, -this.speedMultiplier * state.frameRateMultiplier), this.speedMultiplier * state.frameRateMultiplier);
      this.vel.y = Math.min(Math.max(this.vel.y, -this.speedMultiplier * state.frameRateMultiplier), this.speedMultiplier * state.frameRateMultiplier);
      this.pos.x += this.vel.x;
      this.pos.y += this.vel.y;
      this.acc.x = 0;
      this.acc.y = 0;
      this.handleBorders();
  }

  handleBorders() {
      if (this.pos.x < 0) this.pos.x = 0;
      if (this.pos.x > 1900) this.pos.x = 1900;
      if (this.pos.y < 0) this.pos.y = 0;
      if (this.pos.y > 800) this.pos.y = 800;

      let borderThreshold = 10;
      let borderRepulsionStrength = 0.1;

      if (this.pos.x < borderThreshold) this.applyForce({ x: borderRepulsionStrength, y: 0 });
      if (this.pos.x > 1900 - borderThreshold) this.applyForce({ x: -borderRepulsionStrength, y: 0 });
      if (this.pos.y < borderThreshold) this.applyForce({ x: 0, y: borderRepulsionStrength });
      if (this.pos.y > 800 - borderThreshold) this.applyForce({ x: 0, y: -borderRepulsionStrength });
  }

  reduceEnergy() {
      let distance = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
      this.energy -= distance * 0.08;
      this.reward -= 0.01; // Penalización por moverse sin comer
  }

  checkEnergy() {
      if (this.energy <= 0) this.die();
  }

  die() {
      let index = state.creatures.indexOf(this);
      if (index > -1) {
          if (this.ageCounter > state.longestLivingDuration) {
              state.longestLivingDuration = this.ageCounter;
              state.longestLivingCreatures = [this];
              console.log(`Nuevo récord de longevidad: ${this.ageCounter} ticks`);
          } else if (this.ageCounter === state.longestLivingDuration) {
              state.longestLivingCreatures.push(this);
          }
          state.creatures.splice(index, 1);
      }
  }

  eat(food) {
      for (let i = food.length - 1; i >= 0; i--) {
          let d = this.dist(this.pos, food[i].pos);
          if (d < this.size) {
              this.consumeFood(food[i]);
              food.splice(i, 1);
              this.borderRepulsionAccum.x = 0;
              this.borderRepulsionAccum.y = 0;
              break;
          }
      }
  }

  consumeFood(food) {
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
      this.brain.train([[this.pos.x, this.pos.y, food.pos.x, food.pos.y, this.size, this.energy]], [[this.vel.x, this.vel.y]]);
  }

  eatCreature(other) {
      let d = this.dist(this.pos, other.pos);
      if (d < this.size && this.size > other.size && this.color !== other.color) {
          if (state.creatures.includes(other)) {
              this.consumeCreature(other);
              return true;
          }
      }
      return false;
  }

  consumeCreature(other) {
      this.size += other.size / 2;
      this.timeSinceLastMeal = 0;
      this.energy += other.size * 50;
      this.preyEaten++;
      this.reward += 2; // Recompensa por comer otra criatura
      this.brain.train([[this.pos.x, this.pos.y, other.pos.x, other.pos.y, this.size, this.energy]], [[this.vel.x, this.vel.y]]);
  }

  age() {
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

  reproduce(colorCounts) {
      let numOffspring = this.calculateNumOffspring();
      let childSize = (this.size * 0.9) / numOffspring;
      let distance = this.size;

      for (let i = 0; i < numOffspring; i++) {
          let childColor = this.calculateChildColor(colorCounts);
          let childPos = this.generateChildPosition(distance);
          let child = new Creature(childSize, childPos, childColor);
          state.creatures.push(child);
      }

      this.size /= 3;
      if (this.size < this.minSize) this.size = this.minSize;
      this.reward += 3; // Recompensa por reproducirse
  }

  calculateNumOffspring() {
      switch (state.season) {
          case "spring": return 5;
          case "summer": return 4;
          case "autumn": return Math.random() < 0.5 ? 4 : 3;
          case "winter": return 3;
          default: return 3;
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
      return { x: this.pos.x + Math.cos(angle) * distance, y: this.pos.y + Math.sin(angle) * distance };
  }

  dist(pos1, pos2) {
      let dx = pos1.x - pos2.x;
      let dy = pos1.y - pos2.y;
      return Math.sqrt(dx * dx + dy * dy);
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