import { v4 as uuidv4 } from 'uuid';
import { Food, Creature } from './classes.js';

export const state = {
    currentMutationColor: null,
    mutationCount: 0,
    frameRateMultiplier: 1,
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
    timeCounter: 0 // Nuevo contador de tiempo
};

// Inicializa las criaturas y la comida
function initializeCreaturesAndFood() {
    for (let i = 0; i < 5; i++) {
        state.creatures.push(new Creature(11, undefined, undefined, 1.0, uuidv4())); // Aumentar tamaño inicial en un 10%
    }
    for (let i = 0; i < 50; i++) {
        state.food.push(new Food());
    }
}

// Llama a la función de inicialización al comienzo
initializeCreaturesAndFood();

export function updateState() {
    state.timeCounter++; // Incrementa el contador de tiempo
    handleFoodRespawn();
    handleSeasonChange();
    updateTotalDays();
    updateAndDisplayFood();
    updateAndDisplayCreatures();
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
        c.move(state.food, state.creatures);
        c.eat(state.food);
        c.age();
        c.checkMitosis(colorCounts);

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
