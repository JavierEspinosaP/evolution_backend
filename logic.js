import { v4 as uuidv4 } from "uuid";
import { Food, Creature } from "./classes.js";
import * as tf from "@tensorflow/tfjs";

const state = {
  mutationColor: null,
  mutationCount: 0,
  frameRate: 1.5,
  season: "spring",
  food: [],
  creatures: [],
  bestBrainWeights: null,
  bestScore: 0,
  historicalBestScore: 0,
  totalDays: 0,
  timeCounter: 0,
  foodRespawnCounter: 0,
  seasonCounter: 0,
  generation: 1,
};

const seasons = ["spring", "summer", "autumn", "winter"];
const foodRespawnTimes = { spring: 10, summer: 50, autumn: 100, winter: 200 };

function initializeEntities() {
  for (let i = 0; i < 20; i++) state.creatures.push(new Creature());
  for (let i = 0; i < 50; i++) state.food.push(new Food());
}

function updateState() {
  state.timeCounter++;
  if (++state.foodRespawnCounter >= foodRespawnTimes[state.season]) {
    state.food.push(new Food());
    state.foodRespawnCounter = 0;
  }
  if (++state.seasonCounter >= 3600) {
    state.seasonCounter = 0;
    state.season = seasons[(seasons.indexOf(state.season) + 1) % seasons.length];
  }
  state.totalDays = Math.floor(state.timeCounter / 14400 * 365);
  updateEntities();
  if (state.creatures.length === 0) restartSimulation();
}

function updateEntities() {
  updateAndDisplay(state.food);
  updateAndDisplay(state.creatures, (c, i) => {
    if (c.size <= c.minSize || c.handleCollisions()) state.creatures.splice(i, 1);
    else if (c.getScore() > state.bestScore) {
      state.bestScore = c.getScore();
      state.bestBrainWeights = c.brain.model.getWeights().map(t => t.arraySync());
    }
    if (c.getScore() > state.historicalBestScore) state.historicalBestScore = c.getScore();
  });
}

function updateAndDisplay(entities, callback) {
  for (let i = entities.length - 1; i >= 0; i--) {
    let e = entities[i];
    e.move();
    if (e.age()) entities.splice(i, 1);
    if (callback) callback(e, i);
  }
}

function restartSimulation() {
  state.generation++;
  state.creatures = [];
  state.food = [];
  state.timeCounter = 0;
  const weights = state.bestBrainWeights;
  if (weights) {
    for (let i = 0; i < 20; i++) {
      let creature = new Creature();
      creature.initializeBrain(weights);
      state.creatures.push(creature);
    }
  } else initializeEntities();
}

function prepareStateForClient() {
  return JSON.stringify({
    ...state,
    creatures: state.creatures.map(c => ({
      id: c.id,
      pos: c.pos,
      size: c.size,
      color: c.color,
      energy: c.energy,
      foodEaten: c.foodEaten,
      preyEaten: c.preyEaten,
      ageCounter: c.ageCounter,
    })),
    food: state.food.map(f => ({
      id: f.id,
      pos: f.pos,
      type: f.type,
    })),
  });
}

initializeEntities();

export { state, updateState, prepareStateForClient };
