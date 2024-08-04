import { v4 as uuidv4 } from "uuid";
import { Food, Creature, NeuralNetwork } from "./classes.js";
import * as tf from "@tensorflow/tfjs";

export const state = {
  currentMutationColor: null,
  mutationCount: 0,
  frameRateMultiplier: 1.5,
  season: "spring",
  food: [],
  creatures: [],
  colorTraits: {},
  longestLivingCreatures: [],
  longestLivingDuration: 0,
  creatureIDCounter: 0,
  totalDays: 0,
  foodRespawnTime: 50,
  foodRespawnCounter: 0,
  seasonCounter: 0,
  seasonDuration: 3600,
  yearDuration: 3600 * 4,
  timeCounter: 0,
  bestCreatureBrainWeights: null,
  bestCreatureScore: 0,
  generation: 1,
  historicalBestCreatureBrainWeights: null,
  historicalBestCreatureScore: 0,
  experienceBuffer: [],
  trainingIndex: 0,
};

function initializeCreaturesAndFood() {
  for (let i = 0; i < 20; i++) {
    state.creatures.push(new Creature(11, undefined, undefined, 1.0, uuidv4()));
  }
  for (let i = 0; i < 50; i++) {
    state.food.push(new Food());
  }
}

initializeCreaturesAndFood();

export async function updateState() {
  state.timeCounter++;
  handleFoodRespawn();
  handleSeasonChange();
  updateTotalDays();
  updateAndDisplayFood();
  updateAndDisplayCreatures();

  if (state.creatures.length === 0) {
    restartSimulationWithBestCreature();
  }
}

function handleFoodRespawn() {
  if (++state.foodRespawnCounter >= state.foodRespawnTime) {
    state.food.push(new Food());
    state.foodRespawnCounter = 0;
  }
}

function handleSeasonChange() {
  if (++state.seasonCounter >= state.seasonDuration) {
    state.seasonCounter = 0;
    changeSeason();
  }
}

function changeSeason() {
  const seasons = ["spring", "summer", "autumn", "winter"];
  state.season = seasons[(seasons.indexOf(state.season) + 1) % seasons.length];
  adjustFoodRespawnTimeBySeason();
}

function adjustFoodRespawnTimeBySeason() {
  switch (state.season) {
    case "spring":
      state.foodRespawnTime = 10;
      break;
    case "summer":
      state.foodRespawnTime = 50;
      break;
    case "autumn":
      state.foodRespawnTime = 100;
      break;
    case "winter":
      state.foodRespawnTime = 200;
      break;
  }
}

function updateTotalDays() {
  state.totalDays = Math.floor(state.timeCounter / (state.yearDuration / 365));
}

function updateAndDisplayFood() {
  for (let i = state.food.length - 1; i >= 0; i--) {
    let f = state.food[i];
    f.move();
    if (f.age()) {
      state.food.splice(i, 1);
    }
  }
}

function updateAndDisplayCreatures() {
  let colorCounts = countColors(state.creatures);

  for (let i = state.creatures.length - 1; i >= 0; i--) {
    let c = state.creatures[i];
    c.act(state.food, state.creatures);
    c.updateVelocityAndPosition();
    c.handleBorders();
    c.reduceEnergy();
    c.eat(state.food);
    c.age();
    c.checkMitosis(colorCounts);

    if (c.brain && c.brain.model) {
      let creatureScore = c.getScore();
      if (creatureScore > state.bestCreatureScore) {
        state.bestCreatureScore = creatureScore;
        state.bestCreatureBrainWeights = c.brain.model.getWeights().map(tensor => tensor.arraySync());
      }
      if (creatureScore > state.historicalBestCreatureScore) {
        state.historicalBestCreatureScore = creatureScore;
        state.historicalBestCreatureBrainWeights = c.brain.model.getWeights().map(tensor => tensor.arraySync());
      }
    }

    if (c.size <= c.minSize) {
      state.creatures.splice(i, 1);
      continue;
    }

    for (let j = state.creatures.length - 1; j >= 0; j--) {
      if (i !== j && c.eatCreature(state.creatures[j])) {
        state.creatures.splice(j, 1);
        break;
      }
    }
  }
}

function countColors(creatures) {
  let colorCounts = {};
  for (let creature of creatures) {
    if (!colorCounts[creature.color]) {
      colorCounts[creature.color] = 0;
    }
    colorCounts[creature.color]++;
  }
  return colorCounts;
}

export function updateMutationColorAndCount(newColor) {
  state.currentMutationColor = newColor;
  state.mutationCount = 0;
}

export function prepareStateForClient() {
  const cleanState = {
    ...state,
    creatures: state.creatures.map(creature => ({
      id: creature.id,
      pos: creature.pos,
      size: creature.size,
      color: creature.color,
      energy: creature.energy,
      foodEaten: creature.foodEaten,
      preyEaten: creature.preyEaten,
      ageCounter: creature.ageCounter,
    })),
    food: state.food.map(foodItem => ({
      id: foodItem.id,
      pos: foodItem.pos,
      type: foodItem.type,
    })),
  };

  return JSON.stringify(cleanState);
}

async function restartSimulationWithBestCreature() {
  state.generation++;
  state.creatures = [];
  state.food = [];
  state.timeCounter = 0;

  const bestCreatureWeights = state.historicalBestCreatureBrainWeights;
  console.log(`Generation ${state.generation} ended. Total days: ${state.totalDays}. Best creature score: ${state.bestCreatureScore}. Historical best score: ${state.historicalBestCreatureScore}.`);

  state.bestCreatureScore = 0;

  if (bestCreatureWeights) {
    const brainId = uuidv4();
    for (let i = 0; i < 20; i++) {
      let newCreature = new Creature(11, undefined, undefined, 1.0, uuidv4());
      await newCreature.initializeBrainWithWeights(bestCreatureWeights, brainId);
      try {
        await newCreature.brain.mutate(Math.random() * 0.1 + 0.05);
      } catch (error) {
        console.error("Error mutating creature brain:", error);
      }
      state.creatures.push(newCreature);
    }
  } else {
    console.log('SISTEMA REINICIADO DESDE 0');
    initializeCreaturesAndFood();
  }
}

Creature.prototype.getScore = function() {
  return this.ageCounter * (this.foodEaten + this.preyEaten * 2) * (1 + this.energy / 100);
};

export async function handleSteppedTraining() {
  const experiences = state.experienceBuffer;
  if (experiences.length === 0) return;

  const inputs = experiences.map(exp => exp.inputs);
  const targets = experiences.map(exp => [exp.reward + exp.newState[0], exp.reward + exp.newState[1]]);

  if (state.creatures.length === 0) return;

  const creatureIndex = state.trainingIndex % state.creatures.length;
  const creature = state.creatures[creatureIndex];

  if (creature.brain && creature.brain.model) {
    await creature.brain.train(inputs, targets);
  }

  state.trainingIndex++;
  state.experienceBuffer = [];
}
