import { v4 as uuidv4 } from 'uuid';
import { Food, Creature } from './classes.js';

export const state = {
    currentMutationColor: null,
    mutationCount: 0,
    frameRateMultiplier: 1,
    food: [],
    creatures: [],
    longestLivingDuration: 0,
    totalDays: 0,
    foodRespawnTime: 50,
    foodRespawnCounter: 0,
    timeCounter: 0, // Nuevo contador de tiempo
    bestModelWeights: null, // Pesos del mejor modelo
    topCreatures: [] // Lista de las mejores criaturas
};

// Inicializa las criaturas y la comida
function initializeCreaturesAndFood(weights = null) {
    state.creatures = [];
    let totalCreatures = 20;
    let numBest = Math.ceil(0.5 * totalCreatures); // 50%
    let numSecondBest = Math.ceil(0.3 * totalCreatures); // 30%
    let numThirdBest = Math.ceil(0.15 * totalCreatures); // 15%
    let numFourthBest = Math.ceil(0.05 * totalCreatures); // 5%

    for (let i = 0; i < numBest; i++) {
        let creature = new Creature(11, undefined, undefined, 1.0, uuidv4());
        if (weights && weights.length > 0) {
            creature.brain.initializeWithWeights(creature.brain.model.inputShape[1], creature.brain.model.outputShape[1], weights[0]);
            creature.brain.mutate(0.01); // Aplicar una mutación del 1%
        }
        state.creatures.push(creature);
    }

    for (let i = 0; i < numSecondBest; i++) {
        let creature = new Creature(11, undefined, undefined, 1.0, uuidv4());
        if (weights && weights.length > 1) {
            creature.brain.initializeWithWeights(creature.brain.model.inputShape[1], creature.brain.model.outputShape[1], weights[1]);
            creature.brain.mutate(0.01); // Aplicar una mutación del 1%
        }
        state.creatures.push(creature);
    }

    for (let i = 0; i < numThirdBest; i++) {
        let creature = new Creature(11, undefined, undefined, 1.0, uuidv4());
        if (weights && weights.length > 2) {
            creature.brain.initializeWithWeights(creature.brain.model.inputShape[1], creature.brain.model.outputShape[1], weights[2]);
            creature.brain.mutate(0.01); // Aplicar una mutación del 1%
        }
        state.creatures.push(creature);
    }

    for (let i = 0; i < numFourthBest; i++) {
        let creature = new Creature(11, undefined, undefined, 1.0, uuidv4());
        if (weights && weights.length > 3) {
            creature.brain.initializeWithWeights(creature.brain.model.inputShape[1], creature.brain.model.outputShape[1], weights[3]);
            creature.brain.mutate(0.01); // Aplicar una mutación del 1%
        }
        state.creatures.push(creature);
    }

    state.food = [];
    for (let i = 0; i < 50; i++) {
        state.food.push(new Food());
    }
}

// Llama a la función de inicialización al comienzo
initializeCreaturesAndFood();

export function updateState() {
    state.timeCounter++; // Incrementa el contador de tiempo
    handleFoodRespawn();
    updateTotalDays();
    updateAndDisplayFood();
    updateAndDisplayCreatures();
    checkAllCreaturesDead();
}

function handleFoodRespawn() {
    state.foodRespawnCounter++;
    if (state.foodRespawnCounter >= state.foodRespawnTime) {
        state.food.push(new Food());
        state.foodRespawnCounter = 0;
    }
}

function updateTotalDays() {
    state.totalDays = Math.floor(state.timeCounter / (3600 / 365)); // 1 año es 3600 segundos
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
        c.move(state.food, state.creatures);
        c.eat(state.food);
        c.age();
        c.checkMitosis(colorCounts);

        if (c.size <= c.minSize) {
            storeBestModelWeights(c); // Almacenar pesos del mejor modelo
            state.creatures.splice(i, 1); // Eliminar criaturas muertas
            continue;
        }

        for (let j = state.creatures.length - 1; j >= 0; j--) {
            if (i !== j && c.eatCreature(state.creatures[j])) {
                storeBestModelWeights(c); // Almacenar pesos del mejor modelo
                state.creatures.splice(j, 1);
                break;
            }
        }
    }
}

function storeBestModelWeights(creature) {
    let score = creature.calculateScore();
    state.topCreatures.push({ creature, score });
    state.topCreatures.sort((a, b) => b.score - a.score);
    if (state.topCreatures.length > 4) {
        state.topCreatures.pop();
    }
}

function checkAllCreaturesDead() {
    if (state.creatures.length === 0) {
        let bestWeights = state.topCreatures.map(entry => entry.creature.brain.model.getWeights().map(tensor => tensor.arraySync()));
        initializeCreaturesAndFood(bestWeights);
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
