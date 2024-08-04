import { v4 as uuidv4 } from "uuid";
import { state } from "./logic.js";
import * as tf from "@tensorflow/tfjs";

const MAX_SIZE = 37.5;
const BATCH_SIZE = 32; // Tamaño del lote para el entrenamiento continuo

class NeuralNetwork {
  constructor(inputSize, outputSize, existingModel) {
    this.model = null;
    this.id = null;
    this.isTraining = false;

    this.initialize(inputSize, outputSize, existingModel);
  }

  async initialize(inputSize, outputSize, existingModel = null) {
    this.model = tf.sequential();
    this.model.add(
      tf.layers.dense({
        units: 32,
        inputShape: [inputSize],
        activation: "relu",
        dtype: "float32",
      })
    );
    this.model.add(
      tf.layers.dense({ units: 16, activation: "relu", dtype: "float32" })
    );
    this.model.add(
      tf.layers.dense({ units: 8, activation: "relu", dtype: "float32" })
    );
    this.model.add(
      tf.layers.dense({
        units: outputSize,
        activation: "tanh",
        dtype: "float32",
      })
    );
    this.model.compile({ optimizer: "adam", loss: "meanSquaredError" });

    if (existingModel && existingModel.layers && existingModel.layers.length > 0) {
      const weightTensors = existingModel.getWeights();
      this.model.setWeights(weightTensors);
    }
    this.id = uuidv4();
  }

  async initializeWithWeights(inputSize, outputSize, weights = null) {
    this.model = tf.sequential();
    this.model.add(
      tf.layers.dense({
        units: 32,
        inputShape: [inputSize],
        activation: "relu",
        dtype: "float32",
      })
    );
    this.model.add(
      tf.layers.dense({ units: 16, activation: "relu", dtype: "float32" })
    );
    this.model.add(
      tf.layers.dense({ units: 8, activation: "relu", dtype: "float32" })
    );
    this.model.add(
      tf.layers.dense({
        units: outputSize,
        activation: "tanh",
        dtype: "float32",
      })
    );
    this.model.compile({ optimizer: "adam", loss: "meanSquaredError" });

    if (weights) {
      const weightTensors = weights.map(w => tf.tensor(w));
      this.model.setWeights(weightTensors);
    }

    this.id = uuidv4();
  }

  async mutate(rate) {
    try {
      for (let layer of this.model.layers) {
        const weights = layer.getWeights();
        const newWeights = [];
        for (let tensor of weights) {
          let values = await tensor.data();
          for (let i = 0; i < values.length; i++) {
            if (Math.random() < rate) {
              values[i] += Math.random() * 2 - 1;
            }
          }
          const newTensor = tf.tensor(values, tensor.shape, "float32");
          newWeights.push(newTensor);
        }
        layer.setWeights(newWeights);
      }
    } catch (error) {
      console.error("Error mutating model:", error);
    }
  }

  async train(inputs, targets) {
    if (inputs.length === 0 || targets.length === 0) {
      console.error("Empty inputs or targets array in train method");
      return;
    }
    if (this.isTraining) {
      console.warn("Training is already in progress");
      return;
    }
    this.isTraining = true; // Establecer el estado de entrenamiento en verdadero

    const inputTensor = tf.tensor2d(inputs, [inputs.length, inputs[0].length], "float32");
    const targetTensor = tf.tensor2d(targets, [targets.length, targets[0].length], "float32");

    try {
      await this.model.fit(inputTensor, targetTensor, { epochs: 1 });
    } catch (error) {
      console.error("Error during training:", error);
    } finally {
      inputTensor.dispose();
      targetTensor.dispose();
      this.isTraining = false; // Restablecer el estado de entrenamiento en falso
    }
  }

  calculateBorderProximityPenalty(input) {
    const borderThreshold = 100; // Distancia a la que empieza la penalización
    const maxPenalty = 5.0; // Penalización máxima

    const distanceToLeft = input[11];
    const distanceToRight = input[12];
    const distanceToTop = input[13];
    const distanceToBottom = input[14];

    let penalty = 0;
    if (distanceToLeft < borderThreshold) penalty += maxPenalty * (borderThreshold - distanceToLeft) / borderThreshold;
    if (distanceToRight < borderThreshold) penalty += maxPenalty * (borderThreshold - distanceToRight) / borderThreshold;
    if (distanceToTop < borderThreshold) penalty += maxPenalty * (borderThreshold - distanceToTop) / borderThreshold;
    if (distanceToBottom < borderThreshold) penalty += maxPenalty * (borderThreshold - distanceToBottom) / borderThreshold;

    return penalty;
  }
  
  predict(inputs) {
    return tf.tidy(() => {
      const inputTensor = tf.tensor2d([inputs], [1, inputs.length], "float32");
      const outputTensor = this.model.predict(inputTensor);
      const outputs = outputTensor.dataSync();
      inputTensor.dispose();
      outputTensor.dispose();
      return outputs;
    });
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

export class Creature {
  constructor(size = 11, pos = { x: Math.random() * 1900, y: Math.random() * 800 }, color = getInitialColor(), speedMultiplier = 1.0, id = uuidv4(), existingModel = null) {
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
    this.brain = new NeuralNetwork(15, 2, existingModel);
    if (!this.brain) {
      console.error("Error initializing brain for creature:", this.id);
    }
    this.reward = 0;
    this.touchingBorder = 0;
    this.borderTimer = 0;
    this.experienceBuffer = [];
    this.lastFoodDistance = null;
    this.lastPreyDistance = null;
  }

  async initializeBrainWithWeights(weights, brainId) {
    this.brain = new NeuralNetwork(15, 2);
    await this.brain.initializeWithWeights(15, 2, weights);
    this.brain.id = brainId;
  }

  applyForce(force) {
    const smoothingFactor = 0.2;
    this.acc.x += force.x * smoothingFactor;
    this.acc.y += force.y * smoothingFactor;
  }

  act(food, creatures) {
    const closestFood = this.findClosest(food);
    const closestPrey = this.findClosestPrey(creatures);
    const closestPredator = this.findClosestPredator(creatures);
    const distanceToLeft = this.pos.x;
    const distanceToRight = 1900 - this.pos.x;
    const distanceToTop = this.pos.y;
    const distanceToBottom = 800 - this.pos.y;

    const inputs = [
      this.pos.x / 1900,
      this.pos.y / 800,
      closestFood ? closestFood.pos.x / 1900 : 0,
      closestFood ? closestFood.pos.y / 800 : 0,
      closestPrey ? closestPrey.pos.x / 1900 : 0,
      closestPrey ? closestPrey.pos.y / 800 : 0,
      closestPredator ? closestPredator.pos.x / 1900 : 0,
      closestPredator ? closestPredator.pos.y / 800 : 0,
      this.size / MAX_SIZE,
      this.energy / 100,
      this.touchingBorder,
      distanceToLeft / 1900,
      distanceToRight / 1900,
      distanceToTop / 800,
      distanceToBottom / 800,
    ];
    const [dx, dy] = this.brain.predict(inputs);
    this.applyForce({ x: dx, y: dy });

    // Recolectar experiencia continuamente
    const reward = this.calculateReward(closestFood, closestPrey);
    const newState = this.getState();

    // Entrenar la red neuronal solo si se cumplen las condiciones especificadas
    if (closestFood || closestPrey || closestPredator || this.isNearBorder()) {
      this.experienceBuffer.push({ inputs, action: [dx, dy], reward, newState });

      if (this.experienceBuffer.length >= BATCH_SIZE) {
        this.trainNetwork();
        this.experienceBuffer = [];
      }
    }

    // Actualizar las distancias anteriores
    if (closestFood) {
      this.lastFoodDistance = this.dist(this.pos, closestFood.pos);
    }
    if (closestPrey) {
      this.lastPreyDistance = this.dist(this.pos, closestPrey.pos);
    }
  }

  isNearBorder() {
    const distanceToLeft = this.pos.x;
    const distanceToRight = 1900 - this.pos.x;
    const distanceToTop = this.pos.y;
    const distanceToBottom = 800 - this.pos.y;
    const borderThreshold = 50; // Umbral para considerar que está cerca del borde
    return (
      distanceToLeft < borderThreshold ||
      distanceToRight < borderThreshold ||
      distanceToTop < borderThreshold ||
      distanceToBottom < borderThreshold
    );
  }

  calculateReward(closestFood, closestPrey) {
    let reward = 0;
    reward += this.foodEaten * 1;
    reward += this.preyEaten * 2;
    reward -= this.calculateBorderProximityPenalty() * 10;

    // Recompensa o castigo basado en la distancia a la comida
    if (closestFood) {
      const currentFoodDistance = this.dist(this.pos, closestFood.pos);
      if (this.lastFoodDistance !== null) {
        if (currentFoodDistance < this.lastFoodDistance) {
          reward += 0.1; // Recompensa por acercarse a la comida
        } else {
          reward -= 0.1; // Castigo por alejarse de la comida
        }
      }
      this.lastFoodDistance = currentFoodDistance;
    }

    // Recompensa o castigo basado en la distancia a la presa
    if (closestPrey) {
      const currentPreyDistance = this.dist(this.pos, closestPrey.pos);
      if (this.lastPreyDistance !== null) {
        if (currentPreyDistance < this.lastPreyDistance) {
          reward += 0.2; // Recompensa por acercarse a la presa
        } else {
          reward -= 0.2; // Castigo por alejarse de la presa
        }
      }
      this.lastPreyDistance = currentPreyDistance;
    }

    return reward;
  }

  getState() {
    const closestFood = this.findClosest(state.food);
    const closestPrey = this.findClosestPrey(state.creatures);
    const closestPredator = this.findClosestPredator(state.creatures);
    const distanceToLeft = this.pos.x;
    const distanceToRight = 1900 - this.pos.x;
    const distanceToTop = this.pos.y;
    const distanceToBottom = 800 - this.pos.y;

    return [
      this.pos.x / 1900,
      this.pos.y / 800,
      closestFood ? closestFood.pos.x / 1900 : 0,
      closestFood ? closestFood.pos.y / 800 : 0,
      closestPrey ? closestPrey.pos.x / 1900 : 0,
      closestPrey ? closestPrey.pos.y / 800 : 0,
      closestPredator ? closestPredator.pos.x / 1900 : 0,
      closestPredator ? closestPredator.pos.y / 800 : 0,
      this.size / MAX_SIZE,
      this.energy / 100,
      this.touchingBorder,
      distanceToLeft / 1900,
      distanceToRight / 1900,
      distanceToTop / 800,
      distanceToBottom / 800,
    ];
  }

  async trainNetwork() {
    const batch = this.sampleExperiences(BATCH_SIZE);
    const inputs = batch.map(exp => exp.inputs);
    const targets = batch.map(exp => [exp.reward + this.brain.predict(exp.newState)[0], exp.reward + this.brain.predict(exp.newState)[1]]);
    await this.brain.train(inputs, targets);
  }

  sampleExperiences(size) {
    const sampled = [];
    for (let i = 0; i < size; i++) {
      sampled.push(this.experienceBuffer[Math.floor(Math.random() * this.experienceBuffer.length)]);
    }
    return sampled;
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

    if (this.touchingBorder) {
      this.borderTimer++;
    } else {
      this.borderTimer = 0;
    }

    if (this.borderTimer >= 600) {
      this.die();
    }
  }

  handleBorders() {
    if (this.pos.x < 0 || this.pos.x > 1900 || this.pos.y < 0 || this.pos.y > 800) {
      this.die();
    }
  }

  reduceEnergy() {
    let distance = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
    this.energy -= distance * 0.08;
    this.reward -= 0.01;
    const borderProximityPenalty = this.calculateBorderProximityPenalty();
    this.reward -= borderProximityPenalty * 10;
  }

  calculateBorderProximityPenalty() {
    const borderThreshold = 100;
    const maxPenalty = 5.0;

    const distanceToLeft = this.pos.x;
    const distanceToRight = 1900 - this.pos.x;
    const distanceToTop = this.pos.y;
    const distanceToBottom = 800 - this.pos.y;

    let penalty = 0;
    if (distanceToLeft < borderThreshold) penalty += maxPenalty * (borderThreshold - distanceToLeft) / borderThreshold;
    if (distanceToRight < borderThreshold) penalty += maxPenalty * (borderThreshold - distanceToRight) / borderThreshold;
    if (distanceToTop < borderThreshold) penalty += maxPenalty * (borderThreshold - distanceToTop) / borderThreshold;
    if (distanceToBottom < borderThreshold) penalty += maxPenalty * (borderThreshold - distanceToBottom) / borderThreshold;

    return penalty;
  }

  checkEnergy() {
    if (this.energy <= 0) this.die();
  }

  async die() {
    let creatureScore = this.ageCounter * (this.foodEaten + this.preyEaten);
    if (creatureScore > state.bestCreatureScore) {
      state.bestCreatureScore = creatureScore;
      state.bestCreatureBrainWeights = this.brain.model.getWeights().map(tensor => tensor.arraySync());
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
    this.brain = null;
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
    this.reward += 1;

    const distanceToLeft = this.pos.x;
    const distanceToRight = 1900 - this.pos.x;
    const distanceToTop = this.pos.y;
    const distanceToBottom = 800 - this.pos.y;

    if (this.brain) {
      await this.brain.train(
        [
          [
            this.pos.x / 1900,
            this.pos.y / 800,
            food.pos.x / 1900,
            food.pos.y / 800,
            0,
            0,
            0,
            0,
            this.size / MAX_SIZE,
            this.energy / 100,
            this.touchingBorder,
            distanceToLeft / 1900,
            distanceToRight / 1900,
            distanceToTop / 800,
            distanceToBottom / 800,
          ],
        ],
        [[this.vel.x, this.vel.y]]
      );
    }
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

  async consumeCreature(other) {
    this.size += other.size / 2;
    this.timeSinceLastMeal = 0;
    this.energy += other.size * 50;
    this.preyEaten++;
    this.reward += 2;

    const distanceToLeft = this.pos.x;
    const distanceToRight = 1900 - this.pos.x;
    const distanceToTop = this.pos.y;
    const distanceToBottom = 800 - this.pos.y;

    await this.brain.train(
      [
        [
          this.pos.x / 1900,
          this.pos.y / 800,
          other.pos.x / 1900,
          other.pos.y / 800,
          0,
          0,
          0,
          0,
          this.size / MAX_SIZE,
          this.energy / 100,
          this.touchingBorder,
          distanceToLeft / 1900,
          distanceToRight / 1900,
          distanceToTop / 800,
          distanceToBottom / 800,
        ],
      ],
      [[this.vel.x, this.vel.y]]
    );
  }

  age() {
    this.ageCounter++;
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
      let child = new Creature(childSize, childPos, childColor, 1.0, uuidv4(), this.brain);
      await child.initializeBrainWithWeights(this.brain.model.getWeights().map(tensor => tensor.arraySync()), this.brain.id);

      if (child.brain && child.brain.model) {
        try {
          await child.brain.mutate(Math.random() * 0.05 + 0.01);
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
    this.reward += 3;
    this.reproductions++;
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

export { NeuralNetwork };
