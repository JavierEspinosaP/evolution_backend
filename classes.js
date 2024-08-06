import { v4 as uuidv4 } from "uuid";
import { state } from "./logic.js";
import * as tf from "@tensorflow/tfjs";

const ACTIONS = ['flee', 'pursue', 'seekFood', 'wander'];

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
        units: ACTIONS.length,
        activation: "softmax",
        dtype: "float32",
      })
    );
    this.model.compile({ optimizer: "adam", loss: "categoricalCrossentropy" });
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
        units: ACTIONS.length,
        activation: "softmax",
        dtype: "float32",
      })
    );
    this.model.compile({ optimizer: "adam", loss: "categoricalCrossentropy" });

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

  predict(inputs) {
    return tf.tidy(() => {
      const inputTensor = tf.tensor2d([inputs], [1, inputs.length], "float32");
      const outputTensor = this.model.predict(inputTensor);
      const probabilities = outputTensor.dataSync();
      inputTensor.dispose();
      outputTensor.dispose();
      // Get the action with the highest probability
      const maxProbIndex = probabilities.indexOf(Math.max(...probabilities));
      return ACTIONS[maxProbIndex];
    });
  }
}

export class Food {
  constructor() {
    this.id = uuidv4();
    this.pos = { x: Math.random() * 1900, y: Math.random() * 800 };
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
    this.brain = new NeuralNetwork(15, 5, existingModel);
    if (!this.brain) {
      console.error("Error initializing brain for creature:", this.id);
    }
    this.reward = 0;
    this.experienceBuffer = [];
    this.eatenFood = false;
    this.eatenPrey = false;
    this.energyLost = 0;
  }

  async initializeBrainWithWeights(weights, brainId) {
    this.brain = new NeuralNetwork(13, 5);
    await this.brain.initializeWithWeights(9, 5, weights);
    this.brain.id = brainId;
  }

  act(food, creatures) {
    const closestFood = this.findClosest(food);
    const closestPrey = this.findClosestPrey(creatures);
    const closestPredator = this.findClosestPredator(creatures);

    const inputs = [
        this.pos.x / 1900,
        this.pos.y / 800,
        closestFood ? closestFood.pos.x / 1900 : 0,
        closestFood ? closestFood.pos.y / 800 : 0,
        closestPrey ? closestPrey.pos.x / 1900 : 0,
        closestPrey ? closestPrey.pos.y / 800 : 0,
        closestPredator ? closestPredator.pos.x / 1900 : 0,
        closestPredator ? closestPredator.pos.y / 800 : 0,
        this.energy / 100
    ];

    const action = this.brain.predict(inputs);
    switch (action) {
        case 'flee':
            this.flee(closestPredator, this.speedMultiplier, closestFood);
            break;
        case 'pursue':
            this.pursue(closestPrey, this.speedMultiplier, closestFood);
            break;
        case 'seekFood':
            this.seekFood(closestFood, this.speedMultiplier);
            break;
        case 'wander':
        default:
            this.wander();
            break;
    }

    // Calcular la recompensa
    const reward = this.calculateReward(closestFood, closestPrey, closestPredator);

    // Recolectar experiencia
    const newState = this.getState();
    this.experienceBuffer.push({ inputs, action, reward, newState });

    // Entrenar la red neuronal si hay suficiente experiencia
    if (this.experienceBuffer.length >= BATCH_SIZE) {
        this.trainNetwork();
        this.experienceBuffer = [];
    }

    // Actualizar las distancias anteriores
    if (closestFood) {
        this.lastFoodDistance = this.dist(this.pos, closestFood.pos);
    }
    if (closestPrey) {
        this.lastPreyDistance = this.dist(this.pos, closestPrey.pos);
    }
  }

  applyForce(force) {
    this.acc.x += force.x;
    this.acc.y += force.y;
  }

  move(food, creatures) {
    this.ageCounter++;
    let { closestFood, closestPrey, closestPredator } =
      this.findClosestEntities(food, creatures);
    let { speed, action } = this.determineAction(
      closestFood,
      closestPrey,
      closestPredator
    );

    this.performAction(
      action,
      closestFood,
      closestPrey,
      closestPredator,
      speed
    );
    this.updateVelocityAndPosition();
    this.reduceEnergy();
    this.checkEnergy();
  }

  findClosestEntities(food, creatures) {
    let closestFood = null,
        closestPrey = null,
        closestPredator = null;
    let closestFoodDist = Infinity,
        closestPreyDist = Infinity,
        closestPredatorDist = Infinity;

    for (let f of food) {
        let d = this.dist(this.pos, f.pos);
        if (d < closestFoodDist && d < this.olfatoRange) {
            closestFoodDist = d;
            closestFood = f;
        }
    }

    for (let other of creatures) {
        if (other.id !== this.id && other.color !== this.color) {
            let d = this.dist(this.pos, other.pos);
            if (d < this.olfatoRange) {
                if (other.size < this.size && d < closestPreyDist) {
                    closestPreyDist = d;
                    closestPrey = other;
                } else if (other.size > this.size && d < closestPredatorDist) {
                    closestPredatorDist = d;
                    closestPredator = other;
                }
            }
        }
    }

    return {
        closestFood,
        closestPrey,
        closestPredator,
    };
}

determineAction(closestFood, closestPrey, closestPredator) {
    let speed = 1.5 * this.speedMultiplier * state.frameRateMultiplier; // Velocidad constante

    let action = "wander";
    if (closestPredator) action = "flee";
    else if (closestPrey) action = "pursue";
    else if (closestFood) action = "seekFood";

    return { speed, action };
}

performAction(action, closestFood, closestPrey, closestPredator, speed) {
    switch (action) {
        case "flee":
            this.flee(closestPredator, speed, closestFood);
            break;
        case "pursue":
            this.pursue(closestPrey, speed, closestFood);
            break;
        case "seekFood":
            this.seekFood(closestFood, speed);
            break;
        default:
            this.wander();
            break;
    }
}

flee(predator, speed, closestFood) {
    if (predator) {
        let flee = { x: this.pos.x - predator.pos.x, y: predator.pos.y - this.pos.y };
        let mag = Math.sqrt(flee.x * flee.x + flee.y * flee.y);
        flee.x = (flee.x / mag) * speed;
        flee.y = (flee.y / mag) * speed;
        let fleeWithFoodAttraction = this.addFoodAttraction(flee, speed, closestFood);
        this.applyForce({ x: fleeWithFoodAttraction.x - this.vel.x, y: fleeWithFoodAttraction.y - this.vel.y });
    }
}

pursue(prey, speed, closestFood) {
    if (prey) {
        let pursue = { x: prey.pos.x - this.pos.x, y: prey.pos.y - this.pos.y };
        let mag = Math.sqrt(pursue.x * pursue.x + pursue.y * pursue.y);
        pursue.x = (pursue.x / mag) * speed;
        pursue.y = (pursue.y / mag) * speed;
        let pursueWithFoodAttraction = this.addFoodAttraction(pursue, speed, closestFood);
        this.applyForce({ x: pursueWithFoodAttraction.x - this.vel.x, y: pursueWithFoodAttraction.y - this.vel.y });
    }
}

seekFood(food, speed) {
    if (food) {
        let desired = { x: food.pos.x - this.pos.x, y: food.pos.y - this.pos.y };
        let mag = Math.sqrt(desired.x * desired.x + desired.y * desired.y);
        desired.x = (desired.x / mag) * speed;
        desired.y = (desired.y / mag) * speed;
        this.applyForce({ x: desired.x - this.vel.x, y: desired.y - this.vel.y });
    }
}

wander() {
    this.applyForce({ x: (Math.random() - 0.5) * 0.1, y: (Math.random() - 0.5) * 0.1 });
}

addFoodAttraction(direction, speed, closestFood) {
    let foodAttractionRange = 100;
    if (closestFood && this.dist(this.pos, closestFood.pos) < foodAttractionRange) {
        let towardsFood = { x: closestFood.pos.x - this.pos.x, y: closestFood.pos.y - this.pos.y };
        let mag = Math.sqrt(towardsFood.x * towardsFood.x + towardsFood.y * towardsFood.y);
        towardsFood.x = (towardsFood.x / mag) * speed * 1.2;
        towardsFood.y = (towardsFood.y / mag) * speed * 1.2;
        direction.x += towardsFood.x;
        direction.y += towardsFood.y;
    }
    return direction;
}

calculateReward(closestFood, closestPrey, closestPredator) {
    let reward = 0;

    // Recompensa por comer comida
    if (this.eatenFood) {
        reward += 10;
        this.eatenFood = false;
    }

    // Recompensa por comer otra criatura
    if (this.eatenPrey) {
        reward += 20;
        this.eatenPrey = false;
    }

    // Penalización por perder energía
    reward -= this.energyLost * 0.1;
    this.energyLost = 0;

    // Penalización por estar cerca de un depredador
    if (closestPredator && this.dist(this.pos, closestPredator.pos) < 100) {
        reward -= 5;
    }

    return Math.max(reward, 0); // La recompensa no puede ser menor que 0
}

reduceEnergy() {
    let distance = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
    this.energyLost += distance * 0.08;
    this.energy -= distance * 0.08;
}

checkEnergy() {
    if (this.energy <= 0) this.die();
}

updateVelocityAndPosition() {
    this.vel.x += this.acc.x;
    this.vel.y += this.acc.y;
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.acc.x = 0;
    this.acc.y = 0;
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
            this.eatenFood = true;
            break;
        }
    }
}

consumeFood(food) {
    this.size += 2;
    this.energy += 100;
    this.timeSinceLastMeal = 0;
    this.foodEaten++;
}

eatCreature(other) {
    let d = this.dist(this.pos, other.pos);
    if (d < this.size && this.size > other.size && this.color !== other.color) {
        if (state.creatures.includes(other)) {
            this.consumeCreature(other);
            this.eatenPrey = true;
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
    let numOffspring = 3; // Número fijo de descendientes
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

calculateScore() {
  return 0.5 * this.ageCounter + 0.2 * this.reproductions + 0.2 * this.preyEaten + 0.1 * this.foodEaten;
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
let newColor = `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(
Math.random() * 256
)}, ${Math.floor(Math.random() * 256)})`;
return newColor;
}

function map(value, start1, stop1, start2, stop2) {
return ((value - start1) / (stop1 - start1)) * (stop2 - stop2) + start2;
}
