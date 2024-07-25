import { v4 as uuidv4 } from 'uuid';
import { state } from './logic.js';
import * as tf from '@tensorflow/tfjs';

export class Food {
    constructor() {
        this.id = uuidv4();
        this.pos = { x: Math.random() * 1900, y: Math.random() * 800 };
        this.type = Math.random() < 0.5 ? 'normal' : 'growth';
        this.vel = { x: (Math.random() - 0.5) * 0.25, y: (Math.random() - 0.5) * 0.25 };
        this.lifeTime = 3600;
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
    constructor(size = 11, pos = { x: Math.random() * 1900, y: Math.random() * 800 }, color = getInitialColor(), 
                speedMultiplier = 1.0, id = uuidv4(), model = null) {
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
        this.model = model || this.createModel();
    }

    createModel() {
        const model = tf.sequential();
        model.add(tf.layers.dense({ inputShape: [this.getInputSize()], units: 16, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 2, activation: 'tanh' })); // Salida para dirección y velocidad
        return model;
    }

    getInputSize() {
        return 6; // [energy, closestFoodDist, closestPredatorDist, closestPreyDist, size, olfatoRange]
    }

    getInputs(food, creatures) {
        let closestNormalFood = null, closestPrey = null, closestPredator = null;
        let closestNormalFoodDist = Infinity, closestPreyDist = Infinity, closestPredatorDist = Infinity;

        for (let f of food) {
            let d = this.dist(this.pos, f.pos);
            if (f.type === "normal" && d < closestNormalFoodDist) {
                closestNormalFoodDist = d;
                closestNormalFood = f;
            }
        }

        for (let other of creatures) {
            if (other.id !== this.id) {
                let d = this.dist(this.pos, other.pos);
                if (other.size < this.size && d < closestPreyDist) {
                    closestPreyDist = d;
                    closestPrey = other;
                } else if (other.size > this.size && d < closestPredatorDist) {
                    closestPredatorDist = d;
                    closestPredator = other;
                }
            }
        }

        return [
            this.energy / 100, // Normalización de energía
            closestNormalFoodDist / 1900, // Normalización de distancias
            closestPredatorDist / 1900,
            closestPreyDist / 1900,
            this.size / 50, // Normalización del tamaño
            this.olfatoRange / 250 // Normalización del rango de olfato
        ];
    }

    decideAction(food, creatures) {
        const inputs = tf.tensor2d([this.getInputs(food, creatures)], [1, this.getInputSize()]);
        const outputs = this.model.predict(inputs).dataSync();
        const [dx, dy] = outputs;
        return { x: dx, y: dy };
    }

    move(food, creatures) {
        const action = this.decideAction(food, creatures);
        const speed = Math.sqrt(action.x * action.x + action.y * action.y) * this.speedMultiplier;
        this.vel.x = action.x * speed;
        this.vel.y = action.y * speed;
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;

        // Limitar la posición a los bordes del mundo
        if (this.pos.x < 0) this.pos.x = 0;
        if (this.pos.x > 1900) this.pos.x = 1900;
        if (this.pos.y < 0) this.pos.y = 0;
        if (this.pos.y > 800) this.pos.y = 800;

        // Actualizar el estado global con la nueva posición
        state.creatures = state.creatures.map(c => c.id === this.id ? this : c);
    }

    eat(foodArray) {
        for (let i = foodArray.length - 1; i >= 0; i--) {
            let food = foodArray[i];
            let distance = this.dist(this.pos, food.pos);
            if (distance < this.size) {
                this.consumeFood(food);
                foodArray.splice(i, 1);
                break;
            }
        }
    }

    consumeFood(food) {
        if (food.type === 'growth') {
            this.size += 4;
            this.energy += 200;
        } else {
            this.size += 2;
            this.energy += 100;
        }
        this.timeSinceLastMeal = 0;
        this.foodEaten++;

        // Actualizar el estado global con la nueva energía y tamaño
        state.creatures = state.creatures.map(c => c.id === this.id ? this : c);
    }

    eatCreature(otherCreature) {
        let distance = this.dist(this.pos, otherCreature.pos);
        if (distance < this.size && this.size > otherCreature.size) {
            this.consumeCreature(otherCreature);
            return true;
        }
        return false;
    }

    consumeCreature(otherCreature) {
        this.size += otherCreature.size / 2;
        this.energy += 200;
        this.preyEaten++;
        otherCreature.die(); 

        // Actualizar el estado global con la nueva energía y tamaño
        state.creatures = state.creatures.map(c => c.id === this.id ? this : c);
    }

    age() {
        this.ageCounter++;
        this.timeSinceLastMeal++;
        this.energy -= 0.1;
        if (this.timeSinceLastMeal > 1000) {
            this.size -= 1;
            this.timeSinceLastMeal = 0;
            if (this.size < this.minSize) this.size = this.minSize;
        }
        if (this.size <= this.minSize || this.energy <= 0) {
            this.die();
        }

        // Actualizar el estado global con la nueva energía y tamaño
        state.creatures = state.creatures.map(c => c.id === this.id ? this : c);
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
            let childModel = this.createModel(); // Crear nuevo modelo para cada hijo
            this.mutateModel(childModel);
            let child = new Creature(childSize, childPos, childColor, this.speedMultiplier, uuidv4(), childModel);
            state.creatures.push(child);
        }

        this.size /= 3;
        if (this.size < this.minSize) this.size = this.minSize;

        // Actualizar el estado global con la nueva lista de criaturas
        state.creatures = state.creatures.filter(c => c.id !== this.id).concat(this);
    }

    mutateModel(model) {
        const weights = model.getWeights();
        const mutatedWeights = weights.map(weight => {
            const values = weight.dataSync().slice();
            for (let i = 0; i < values.length; i++) {
                if (Math.random() < 0.05) {
                    values[i] += Math.random() * 0.1 - 0.05;
                }
            }
            return tf.tensor(values, weight.shape);
        });
        model.setWeights(mutatedWeights);
    }

    dist(pos1, pos2) {
        let dx = pos1.x - pos2.x;
        let dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
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
    return ((value - start1) / (stop1 - stop1)) * (stop2 - stop2) + start2;
}
