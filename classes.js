import { v4 as uuidv4 } from "uuid";
import { state } from "./logic.js";
import * as tf from "@tensorflow/tfjs";

const ACTIONS = ['move_towards_food', 'move_towards_prey', 'move_away_from_predator', 'move_randomly', 'stay_in_place'];

class NeuralNetwork {
  constructor(inputSize, outputSize = ACTIONS.length) {
    this.model = tf.sequential();
    this.model.add(tf.layers.dense({ units: 64, inputShape: [inputSize], activation: "relu" }));
    this.model.add(tf.layers.dense({ units: 32, activation: "relu" }));
    this.model.add(tf.layers.dense({ units: 16, activation: "relu" }));
    this.model.add(tf.layers.dense({ units: outputSize, activation: "softmax" }));
    this.model.compile({ optimizer: "adam", loss: "categoricalCrossentropy" });
  }

  async train(inputs, targets) {
    const inputTensor = tf.tensor2d(inputs);
    const targetTensor = tf.tensor2d(targets);
    await this.model.fit(inputTensor, targetTensor, { epochs: 1 });
    inputTensor.dispose();
    targetTensor.dispose();
  }

  predict(inputs) {
    return tf.tidy(() => {
      const inputTensor = tf.tensor2d([inputs]);
      const outputTensor = this.model.predict(inputTensor);
      const outputs = outputTensor.dataSync();
      inputTensor.dispose();
      outputTensor.dispose();
      return outputs;
    });
  }
}

class Food {
  constructor() {
    this.id = uuidv4();
    this.pos = { x: Math.random() * 1900, y: Math.random() * 800 };
    this.type = Math.random() < 0.5 ? "normal" : "growth";
    this.vel = { x: (Math.random() - 0.5) * 0.25, y: (Math.random() - 0.5) * 0.25 };
    this.lifeTime = 3600;
  }

  move() {
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.vel.x += (Math.random() - 0.5) * 0.025;
    this.vel.y += (Math.random() - 0.5) * 0.025;
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
  constructor() {
    this.id = uuidv4();
    this.pos = { x: Math.random() * 1900, y: Math.random() * 800 };
    this.size = 11;
    this.color = ["red", "blue", "yellow", "green"][Math.floor(Math.random() * 4)];
    this.energy = 100;
    this.foodEaten = 0;
    this.preyEaten = 0;
    this.ageCounter = 0;
    this.brain = new NeuralNetwork(15, ACTIONS.length);
  }

  async initializeBrain(weights) {
    await this.brain.model.setWeights(weights.map(w => tf.tensor(w)));
  }

  move() {
    const closestFood = this.findClosest(state.food);
    const closestPrey = this.findClosestPrey(state.creatures);
    const closestPredator = this.findClosestPredator(state.creatures);
    const inputs = this.getInputs(closestFood, closestPrey, closestPredator);
    const action = ACTIONS[this.brain.predict(inputs).indexOf(Math.max(...this.brain.predict(inputs)))];

    switch (action) {
      case 'move_towards_food':
        if (closestFood) this.moveTo(closestFood.pos);
        break;
      case 'move_towards_prey':
        if (closestPrey) this.moveTo(closestPrey.pos);
        break;
      case 'move_away_from_predator':
        if (closestPredator) this.moveAwayFrom(closestPredator.pos);
        break;
      case 'move_randomly':
        this.moveRandomly();
        break;
      case 'stay_in_place':
        this.vel = { x: 0, y: 0 };
        break;
    }

    this.updatePosition();
    this.reduceEnergy();
  }

  handleCollisions() {
    // Check collisions with other creatures
    for (let other of state.creatures) {
      if (other !== this && this.isColliding(other)) {
        if (this.size > other.size) {
          this.consumeCreature(other);
          return true;
        }
      }
    }
    // Check collisions with borders
    if (this.pos.x < 0 || this.pos.x > 1900 || this.pos.y < 0 || this.pos.y > 800) {
      return true;
    }
    return false;
  }

  isColliding(other) {
    const dist = Math.sqrt(Math.pow(this.pos.x - other.pos.x, 2) + Math.pow(this.pos.y - other.pos.y, 2));
    return dist < this.size;
  }

  getInputs(closestFood, closestPrey, closestPredator) {
    return [
      this.pos.x / 1900,
      this.pos.y / 800,
      closestFood ? closestFood.pos.x / 1900 : 0,
      closestFood ? closestFood.pos.y / 800 : 0,
      closestPrey ? closestPrey.pos.x / 1900 : 0,
      closestPrey ? closestPrey.pos.y / 800 : 0,
      closestPredator ? closestPredator.pos.x / 1900 : 0,
      closestPredator ? closestPredator.pos.y / 800 : 0,
      this.size / 37.5,
      this.energy / 100,
      this.isNearBorder() ? 1 : 0,
      this.pos.x / 1900,
      (1900 - this.pos.x) / 1900,
      this.pos.y / 800,
      (800 - this.pos.y) / 800,
    ];
  }

  updatePosition() {
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.vel.x *= 0.9;
    this.vel.y *= 0.9;
  }

  moveTo(target) {
    this.vel.x = (target.x - this.pos.x) * 0.1;
    this.vel.y = (target.y - this.pos.y) * 0.1;
  }

  moveAwayFrom(target) {
    this.vel.x = (this.pos.x - target.x) * 0.1;
    this.vel.y = (this.pos.y - target.y) * 0.1;
  }

  moveRandomly() {
    this.vel.x = (Math.random() - 0.5) * 2;
    this.vel.y = (Math.random() - 0.5) * 2;
  }

  isNearBorder() {
    return this.pos.x < 50 || this.pos.x > 1850 || this.pos.y < 50 || this.pos.y > 750;
  }

  reduceEnergy() {
    this.energy -= Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y) * 0.1;
    if (this.energy <= 0) this.die();
  }

  die() {
    state.creatures = state.creatures.filter(c => c.id !== this.id);
  }

  findClosest(items) {
    return items.reduce((closest, item) => {
      const dist = Math.sqrt(Math.pow(this.pos.x - item.pos.x, 2) + Math.pow(this.pos.y - item.pos.y, 2));
      return dist < (closest.dist || Infinity) ? { item, dist } : closest;
    }, {}).item;
  }

  findClosestPrey(creatures) {
    return this.findClosest(creatures.filter(c => c.size < this.size && c.color !== this.color));
  }

  findClosestPredator(creatures) {
    return this.findClosest(creatures.filter(c => c.size > this.size && c.color !== this.color));
  }

  consumeCreature(other) {
    this.size += other.size / 2;
    this.energy += other.size * 50;
    state.creatures = state.creatures.filter(c => c.id !== other.id);
  }

  getScore() {
    return this.ageCounter * (this.foodEaten + this.preyEaten * 2) * (1 + this.energy / 100);
  }
}

export { NeuralNetwork, Food, Creature };
