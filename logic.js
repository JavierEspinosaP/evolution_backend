import { v4 as uuidv4 } from "uuid";
import { Food, Creature, NeuralNetwork } from "./classes.js";
import { Log } from "@tensorflow/tfjs";

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
  seasonDuration: 3600, // 1 minuto en frames (60 FPS)
  yearDuration: 3600 * 4, // 4 estaciones
  timeCounter: 0, // Nuevo contador de tiempo
  bestCreatureBrainWeights: null, // Pesos de la red neuronal de la mejor criatura
  bestCreatureScore: 0, // Puntaje de la mejor criatura
  generation: 1, // Contador de generaciones
  historicalBestCreatureBrainWeights: null, // Pesos de la red neuronal de la mejor criatura histórica
  historicalBestCreatureScore: 0, // Puntaje de la mejor criatura histórica
};

// Inicializa las criaturas y la comida
function initializeCreaturesAndFood() {
  for (let i = 0; i < 50; i++) {
    state.creatures.push(new Creature(11, undefined, undefined, 1.0, uuidv4())); // Aumentar tamaño inicial en un 10%
  }
  for (let i = 0; i < 50; i++) {
    state.food.push(new Food());
  }
}

// Llama a la función de inicialización al comienzo
initializeCreaturesAndFood();

export async function updateState() {
  state.timeCounter++; // Incrementa el contador de tiempo
  handleFoodRespawn();
  handleSeasonChange();
  updateTotalDays();
  updateAndDisplayFood();
  updateAndDisplayCreatures();

  // Check if all creatures are dead
  if (state.creatures.length === 0) {
    // console.log(`Generation ${state.generation} ended. Restarting with best creature.`);
    restartSimulationWithBestCreature();
  }
}

function handleFoodRespawn() {
  state.foodRespawnCounter++;
  if (state.foodRespawnCounter >= state.foodRespawnTime) {
    state.food.push(new Food());
    state.foodRespawnCounter = 0;
  }
}

function handleSeasonChange() {
  state.seasonCounter++;
  if (state.seasonCounter >= state.seasonDuration) {
    state.seasonCounter = 0;
    changeSeason();
  }
}

function changeSeason() {
  const seasons = ["spring", "summer", "autumn", "winter"];
  let currentSeasonIndex = seasons.indexOf(state.season);
  state.season = seasons[(currentSeasonIndex + 1) % seasons.length];
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
      state.food.splice(i, 1); // Eliminar comida caducada
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
  
      if (c.brain && c.brain.model) { // Verificar que c.brain no sea null
        let creatureScore = c.ageCounter * (c.foodEaten + 2 * c.preyEaten) * (1 + c.energy / 100);
        
        if (creatureScore > state.bestCreatureScore) {
            state.bestCreatureScore = creatureScore;
            state.bestCreatureBrainWeights = c.brain.model.getWeights().map(tensor => tensor.arraySync());
          }
          
          // Actualizar los mejores pesos históricos si es necesario
          if (creatureScore > state.historicalBestCreatureScore) {
            state.historicalBestCreatureScore = creatureScore;
            state.historicalBestCreatureBrainWeights = c.brain.model.getWeights().map(tensor => tensor.arraySync());
          }
      }
  
      if (c.size <= c.minSize) {
        state.creatures.splice(i, 1); // Eliminar criaturas muertas
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
    creatures: state.creatures.map((creature) => ({
      id: creature.id,
      pos: {
        x: creature.pos.x || 0,
        y: creature.pos.y || 0,
      },
      size: creature.size,
      color: creature.color,
      energy: creature.energy,
      foodEaten: creature.foodEaten,
      preyEaten: creature.preyEaten,
      ageCounter: creature.ageCounter,
    })),
    food: state.food.map((foodItem) => ({
      id: foodItem.id,
      pos: {
        x: foodItem.pos.x || 0,
        y: foodItem.pos.y || 0,
      },
      type: foodItem.type,
    })),
  };

  // Usar JSON.stringify en lugar de Flatted.stringify
  return JSON.stringify(cleanState);
}

async function restartSimulationWithBestCreature() {
    state.generation++;
    state.creatures = [];
    state.food = [];
    state.timeCounter = 0;
  
    const bestCreatureWeights = state.historicalBestCreatureBrainWeights; // Usar los pesos históricos
     state.historicalBestCreatureBrainWeights
    console.log(`Generation ${state.generation} ended. Total days: ${state.totalDays}. Best creature score: ${state.bestCreatureScore}. Historical best score: ${state.historicalBestCreatureScore}.`);
  
    state.bestCreatureScore = 0;
  
    if (bestCreatureWeights) {
      const brainId = uuidv4();
      for (let i = 0; i < 40; i++) {
        let newCreature = new Creature(11, undefined, undefined, 1.0, uuidv4());
        await newCreature.initializeBrainWithWeights(bestCreatureWeights, brainId); // Inicializa con pesos
        try {
          await newCreature.brain.mutate(Math.random() * 0.05 + 0.01);
        } catch (error) {
          console.error("Error mutating creature brain:", error);
        }
        state.creatures.push(newCreature);
      }
      for (let i = 0; i < 10; i++) {
        let newCreature = new Creature(11, undefined, undefined, 1.0, uuidv4());
        await newCreature.initializeBrainWithWeights(bestCreatureWeights, brainId); // Inicializa con pesos
        try {
          await newCreature.brain.mutate(Math.random() * 0.15 + 0.1);
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
  
  
