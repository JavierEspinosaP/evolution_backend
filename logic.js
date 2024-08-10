import { v4 as uuidv4 } from 'uuid';
import { Food, Creature } from './classes.js';

export const state = {
    currentMutationColor: null,
    mutationCount: 0,
    frameRateMultiplier: 0.5,
    food: [],
    creatures: [],
    colorTraits: new Map(),
    creatureIDCounter: 0,
    totalDays: 0,
    foodRespawnTime: 100,
    foodRespawnCounter: 0,
    timeCounter: 0,
    creatureDirections: new Map(), // Añadir esta línea para las direcciones de las criaturas
};

// Inicializa las criaturas y la comida
function initializeCreaturesAndFood() {
    for (let i = 0; i < 5; i++) {
        if (state.creatures.length < 10) {
            state.creatures.push(new Creature(11, undefined, undefined, 1.0, uuidv4()));
        }
    }
    for (let i = 0; i < 10; i++) {
        state.food.push(new Food());
    }
}

// Llama a la función de inicialización al comienzo
initializeCreaturesAndFood();

export function updateState() {
    state.timeCounter++;
    handleFoodRespawn();
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

function updateTotalDays() {
    state.totalDays = Math.floor(state.timeCounter / (state.foodRespawnTime * 7));
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
        if (!c || !c.id) continue; // Verificar que la criatura y su id existan
        c.move(state.food, state.creatures);
        c.eat(state.food);
        c.age();
        c.checkMitosis(colorCounts);

        // Guardar la dirección de la criatura
        state.creatureDirections.set(c.id, { pos: c.pos, vel: c.vel, direction: c.direction });

        if (c.size <= c.minSize) {
            state.creatures.splice(i, 1); // Eliminar criaturas muertas
            state.creatureDirections.delete(c.id); // Eliminar la dirección de la criatura
            continue;
        }

        for (let j = state.creatures.length - 1; j >= 0; j--) {
            if (i !== j && c.eatCreature(state.creatures[j])) {
                // Verificar que la criatura existe antes de eliminar
                if (state.creatures[j] && state.creatures[j].id) {
                    state.creatureDirections.delete(state.creatures[j].id); // Eliminar la dirección de la criatura comida
                }
                state.creatures.splice(j, 1);
                break;
            }
        }
    }
}


function countColors(creatures) {
    let colorCounts = new Map();
    for (let creature of creatures) {
        colorCounts.set(creature.color, (colorCounts.get(creature.color) || 0) + 1);
    }
    return colorCounts;
}

export function updateMutationColorAndCount(newColor) {
    state.currentMutationColor = newColor;
    state.mutationCount = 0;
}
