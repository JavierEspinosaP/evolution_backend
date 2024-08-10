import { v4 as uuidv4 } from 'uuid';
import { state } from './logic.js';

const INITIAL_COLORS = ["red", "blue", "yellow", "green"];
const AVAILABLE_COLORS = ["red", "blue", "yellow", "green"];
const BORDER_THRESHOLD = 10;
const BORDER_REPULSION_STRENGTH = 0.1;
const FOOD_ATTRACTION_RANGE = 100;
const SMOOTHING_FACTOR = 0.2;

function getRandomColor() {
    return AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)];
}

function getInitialColor() {
    return INITIAL_COLORS[Math.floor(Math.random() * INITIAL_COLORS.length)];
}

function map(value, start1, stop1, start2, stop2) {
    return ((value - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
}

function dist(pos1, pos2) {
    let dx = pos1.x - pos2.x;
    let dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
}


class Entity {
    constructor() {
        this.pos = { x: Math.random() * 1280, y: Math.random() * 720 };
        this.vel = { x: (Math.random() - 0.5) * 0.25, y: (Math.random() - 0.5) * 0.25 };
    }

    updatePosition() {
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
    }

    checkBorders() {
        if (this.pos.x < 0 || this.pos.x > 1280) this.vel.x *= -1;
        if (this.pos.y < 0 || this.pos.y > 720) this.vel.y *= -1;
    }
}

export class Food extends Entity {
    constructor() {
        super();
        this.id = uuidv4();
        this.type = Math.random() < 0.5 ? 'normal' : 'growth';
        this.lifeTime = 3600; // Vida de 1 minuto (60 FPS * 60 segundos)
    }

    move() {
        super.updatePosition();
        this.vel.x += (Math.random() - 0.5) * 0.025;
        this.vel.y += (Math.random() - 0.5) * 0.025;
        this.vel.x = Math.min(Math.max(this.vel.x, -0.125), 0.125);
        this.vel.y = Math.min(Math.max(this.vel.y, -0.125), 0.125);
        super.checkBorders();
    }

    age() {
        this.lifeTime--;
        return this.lifeTime <= 0;
    }
}

export class Creature extends Entity {
    constructor(size = 11, pos, color = getInitialColor(), speedMultiplier = 0.5, id = uuidv4()) {
        super();
        this.id = id;
        this.pos = pos || { x: Math.random() * 1280, y: Math.random() * 720 };
        this.size = size;
        this.color = color;
        this.minSize = 5;
        this.maxSize = 37.5;
        this.lifeSpan = 10000;
        this.timeSinceLastMeal = 0;
        this.speedMultiplier = speedMultiplier;
        this.energy = 100;
        this.olfatoRange = map(this.size, this.minSize, 100, 75, 250);
        this.foodEaten = 0;
        this.preyEaten = 0;
        this.reproduced = false;
        this.ageCounter = 0;
        this.borderRepulsionAccum = { x: 0, y: 0 };
        this.acc = { x: 0, y: 0 };
        this.direction = 'right';  // Dirección inicial
        state.creatureDirections.set(this.id, { pos: this.pos, vel: this.vel, direction: this.direction });
    }

    

    applyForce(force) {
        this.vel.x += force.x * SMOOTHING_FACTOR;
        this.vel.y += force.y * SMOOTHING_FACTOR;
    }


    move(food, creatures) {
        const FRAME_RATE_MULTIPLIER = state.frameRateMultiplier;
        const BASE_SPEED = this.speedMultiplier * FRAME_RATE_MULTIPLIER;

        this.ageCounter++;
        const { closestNormalFood, closestGrowthFood, closestPrey, closestPredator } = this.findClosestEntities(food, creatures);
        const { speed, action } = this.determineAction(closestNormalFood, closestGrowthFood, closestPrey, closestPredator, BASE_SPEED);

        this.performAction(action, closestNormalFood, closestGrowthFood, closestPrey, closestPredator, speed);
        this.updateVelocityAndPosition(FRAME_RATE_MULTIPLIER);
        this.handleBorders();
        this.reduceEnergy();
        this.checkEnergy();

        this.updateDirection(); // Actualizar la dirección basada en la velocidad

        // Actualizar dirección en el estado
        state.creatureDirections.set(this.id, { pos: this.pos, vel: this.vel, direction: this.direction });
    }

    updateDirection() {
        const angle = Math.atan2(this.vel.y, this.vel.x) * 180 / Math.PI;
        if (angle >= -45 && angle < 45) {
            this.direction = 'right';
        } else if (angle >= 45 && angle < 135) {
            this.direction = 'down';
        } else if (angle >= -135 && angle < -45) {
            this.direction = 'up';
        } else {
            this.direction = 'left';
        }
    }

    findClosestEntities(food, creatures) {
        let closestNormalFood = null, closestGrowthFood = null, closestPrey = null, closestPredator = null;
        let closestNormalFoodDist = Infinity, closestGrowthFoodDist = Infinity, closestPreyDist = Infinity, closestPredatorDist = Infinity;

        for (let f of food) {
            let d = dist(this.pos, f.pos);
            if (f.type === "normal" && d < closestNormalFoodDist && d < this.olfatoRange) {
                closestNormalFoodDist = d;
                closestNormalFood = f;
            } else if (f.type === "growth" && d < closestGrowthFoodDist && d < this.olfatoRange) {
                closestGrowthFoodDist = d;
                closestGrowthFood = f;
            }
        }

        for (let other of creatures) {
            if (other.id !== this.id && other.color !== this.color) {
                let d = dist(this.pos, other.pos);
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

        return { closestNormalFood, closestGrowthFood, closestPrey, closestPredator };
    }

    determineAction(closestNormalFood, closestGrowthFood, closestPrey, closestPredator, BASE_SPEED) {
        let speed = BASE_SPEED;
        let action = "wander";
        if (closestPredator) action = "flee";
        else if (closestPrey) action = "pursue";
        else if (closestGrowthFood) action = "seekGrowthFood";
        else if (closestNormalFood) action = "seekNormalFood";

        return { speed, action };
    }

    performAction(action, closestNormalFood, closestGrowthFood, closestPrey, closestPredator, speed) {
        switch (action) {
            case "flee":
                this.flee(closestPredator, speed, closestNormalFood, closestGrowthFood);
                break;
            case "pursue":
                this.pursue(closestPrey, speed, closestNormalFood, closestGrowthFood);
                break;
            case "seekGrowthFood":
                this.seekFood(closestGrowthFood, speed);
                break;
            case "seekNormalFood":
                this.seekFood(closestNormalFood, speed);
                break;
            default:
                this.applyForce({ x: (Math.random() - 0.5) * 0.1, y: (Math.random() - 0.5) * 0.1 });
        }

        this.applyForce(this.borderRepulsionAccum);
    }

    flee(predator, speed, closestNormalFood, closestGrowthFood) {
        let flee = this.calculateDirection(predator.pos, speed, true);
        let fleeWithFoodAttraction = this.addFoodAttraction(flee, speed, closestNormalFood, closestGrowthFood);
        this.applyForce(fleeWithFoodAttraction);
    }

    pursue(prey, speed, closestNormalFood, closestGrowthFood) {
        let pursue = this.calculateDirection(prey.pos, speed);
        let pursueWithFoodAttraction = this.addFoodAttraction(pursue, speed, closestNormalFood, closestGrowthFood);
        this.applyForce(pursueWithFoodAttraction);
    }

    seekFood(food, speed) {
        let desired = this.calculateDirection(food.pos, speed);
        this.applyForce(desired);
    }

    calculateDirection(targetPos, speed, isFlee = false) {
        let direction = { x: targetPos.x - this.pos.x, y: targetPos.y - this.pos.y };
        let mag = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        direction.x = (direction.x / mag) * speed;
        direction.y = (direction.y / mag) * speed;
        if (isFlee) {
            direction.x *= -1;
            direction.y *= -1;
        }
        return direction;
    }

    addFoodAttraction(direction, speed, closestNormalFood, closestGrowthFood) {
        if (closestNormalFood && dist(this.pos, closestNormalFood.pos) < FOOD_ATTRACTION_RANGE) {
            direction = this.adjustDirection(direction, closestNormalFood.pos, speed * 1.2);
        } else if (closestGrowthFood && dist(this.pos, closestGrowthFood.pos) < FOOD_ATTRACTION_RANGE) {
            direction = this.adjustDirection(direction, closestGrowthFood.pos, speed * 1.5);
        }
        return direction;
    }

    adjustDirection(direction, targetPos, speed) {
        let towardsFood = { x: targetPos.x - this.pos.x, y: targetPos.y - this.pos.y };
        let mag = Math.sqrt(towardsFood.x * towardsFood.x + towardsFood.y * towardsFood.y);
        towardsFood.x = (towardsFood.x / mag) * speed;
        towardsFood.y = (towardsFood.y / mag) * speed;
        direction.x += towardsFood.x;
        direction.y += towardsFood.y;
        return direction;
    }

    updateVelocityAndPosition(FRAME_RATE_MULTIPLIER) {
        this.vel.x = Math.min(Math.max(this.vel.x + this.acc.x, -this.speedMultiplier * FRAME_RATE_MULTIPLIER), this.speedMultiplier * FRAME_RATE_MULTIPLIER);
        this.vel.y = Math.min(Math.max(this.vel.y + this.acc.y, -this.speedMultiplier * FRAME_RATE_MULTIPLIER), this.speedMultiplier * FRAME_RATE_MULTIPLIER);
        this.pos.x = Math.min(Math.max(this.pos.x + this.vel.x, 0), 1280);
        this.pos.y = Math.min(Math.max(this.pos.y + this.vel.y, 0), 720);
        this.acc.x = 0;
        this.acc.y = 0;
    }

    handleBorders() {
        if (this.pos.x < BORDER_THRESHOLD) this.applyForce({ x: BORDER_REPULSION_STRENGTH, y: 0 });
        if (this.pos.x > 1280 - BORDER_THRESHOLD) this.applyForce({ x: -BORDER_REPULSION_STRENGTH, y: 0 });
        if (this.pos.y < BORDER_THRESHOLD) this.applyForce({ x: 0, y: BORDER_REPULSION_STRENGTH });
        if (this.pos.y > 720 - BORDER_THRESHOLD) this.applyForce({ x: 0, y: -BORDER_REPULSION_STRENGTH });
    }

    reduceEnergy() {
        this.energy -= Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y) * 0.08;
    }

    checkEnergy() {
        if (this.energy <= 0) this.die();
    }

    die() {
        let index = state.creatures.indexOf(this);
        if (index > -1) {
            state.creatures.splice(index, 1);
        }
    }

    eat(food) {
        for (let i = food.length - 1; i >= 0; i--) {
            if (dist(this.pos, food[i].pos) < this.size) {
                this.consumeFood(food[i]);
                food.splice(i, 1);
                this.borderRepulsionAccum.x = 0;
                this.borderRepulsionAccum.y = 0;
                break;
            }
        }
    }

    consumeFood(food) {
        if (this.size < this.maxSize) {
            if (food.type === "growth") {
                this.size = Math.min(this.size + 4, this.maxSize); // Limitar al tamaño máximo
                this.energy += 200;
            } else {
                this.size = Math.min(this.size + 2, this.maxSize); // Limitar al tamaño máximo
                this.energy += 100;
            }
        }
        this.timeSinceLastMeal = 0;
        this.foodEaten++;
    }

    eatCreature(other) {
        if (dist(this.pos, other.pos) < this.size && this.size > other.size && this.color !== other.color) {
            if (state.creatures.includes(other)) {
                this.consumeCreature(other);
                return true;
            }
        }
        return false;
    }

    consumeCreature(other) {
        if (this.size < this.maxSize) {
            this.size = Math.min(this.size + other.size / 2, this.maxSize); // Limitar al tamaño máximo
        }
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
        if (this.size >= 37.5 && state.creatures.length < 10) {
            this.reproduce(colorCounts);
        }
    }

    reproduce(colorCounts) {
        if (state.creatures.length >= 10) return; // No reproducir si ya hay 10 criaturas
    
        let numOffspring = 3; // Constante fija
        let childSize = (this.size * 0.9) / numOffspring;
        let distance = this.size;
    
        // Copiar los colores disponibles y eliminar el color del padre
        let availableColors = [...AVAILABLE_COLORS].filter(color => color !== this.color);
    
        for (let i = 0; i < numOffspring; i++) {
            if (state.creatures.length >= 10 || availableColors.length === 0) break; // No crear más criaturas si ya hay 10 o no hay colores disponibles
    
            // Seleccionar un color único para cada hijo
            let childColor = availableColors.splice(Math.floor(Math.random() * availableColors.length), 1)[0];
            let childPos = this.generateChildPosition(distance);
            state.creatures.push(new Creature(childSize, childPos, childColor));
        }
    
        this.size /= 3;
        if (this.size < this.minSize) this.size = this.minSize;
    }
    

    calculateChildColor(colorCounts, forceMutation = false) {
        let childColor = this.color;
        let mutationProbability = Math.min(0.5 * colorCounts.get(this.color), 0.9);

        if (forceMutation || Math.random() < mutationProbability) {
            if (!state.currentMutationColor || state.mutationCount >= 10) {
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
