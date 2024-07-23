import { v4 as uuidv4 } from 'uuid';
import { state } from './logic.js';

export class Food {
    constructor() {
        this.id = uuidv4();
        this.pos = { x: Math.random() * 1900, y: Math.random() * 800 };
        this.type = Math.random() < 0.5 ? 'normal' : 'growth';
        this.vel = { x: (Math.random() - 0.5) * 0.25, y: (Math.random() - 0.5) * 0.25 };
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
    constructor(size = 11, pos = { x: Math.random() * 1900, y: Math.random() * 800 }, color = getInitialColor(), speedMultiplier = 1.0, id = uuidv4()) {
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
    }

    applyForce(force) {
        const smoothingFactor = 0.2;
        this.acc.x += force.x * smoothingFactor;
        this.acc.y += force.y * smoothingFactor;
    }
    

    move(food, creatures) {
        this.ageCounter++;
        let { closestNormalFood, closestGrowthFood, closestPrey, closestPredator } = this.findClosestEntities(food, creatures);
        let { speed, action } = this.determineAction(closestNormalFood, closestGrowthFood, closestPrey, closestPredator);

        this.performAction(action, closestNormalFood, closestGrowthFood, closestPrey, closestPredator, speed);
        this.updateVelocityAndPosition();
        this.handleBorders();
        this.reduceEnergy();
        this.checkEnergy();
    }

    findClosestEntities(food, creatures) {
        let closestNormalFood = null, closestGrowthFood = null, closestPrey = null, closestPredator = null;
        let closestNormalFoodDist = Infinity, closestGrowthFoodDist = Infinity, closestPreyDist = Infinity, closestPredatorDist = Infinity;

        for (let f of food) {
            let d = this.dist(this.pos, f.pos);
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

        return { closestNormalFood, closestGrowthFood, closestPrey, closestPredator };
    }

    determineAction(closestNormalFood, closestGrowthFood, closestPrey, closestPredator) {
        let baseSpeed = 1.5 * this.speedMultiplier * state.frameRateMultiplier;
        let speed = baseSpeed;
        if (state.season === "winter") speed *= 0.5;
        else if (state.season === "summer") speed *= 1.2;

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
        let flee = { x: this.pos.x - predator.pos.x, y: this.pos.y - predator.pos.y };
        let mag = Math.sqrt(flee.x * flee.x + flee.y * flee.y);
        flee.x = (flee.x / mag) * speed;
        flee.y = (flee.y / mag) * speed;
        let noiseFactor = 1;
        flee.x += (Math.random() - 0.5) * noiseFactor * speed;
        flee.y += (Math.random() - 0.5) * noiseFactor * speed;
        flee.x = Math.min(Math.max(flee.x, -speed), speed);
        flee.y = Math.min(Math.max(flee.y, -speed), speed);
        let fleeWithFoodAttraction = this.addFoodAttraction(flee, speed, closestNormalFood, closestGrowthFood);
        this.applyForce({ x: fleeWithFoodAttraction.x - this.vel.x, y: fleeWithFoodAttraction.y - this.vel.y });
    }

    pursue(prey, speed, closestNormalFood, closestGrowthFood) {
        let pursue = { x: prey.pos.x - this.pos.x, y: prey.pos.y - this.pos.y };
        let mag = Math.sqrt(pursue.x * pursue.x + pursue.y * pursue.y);
        pursue.x = (pursue.x / mag) * speed;
        pursue.y = (pursue.y / mag) * speed;
        let noiseFactor = 0.5;
        pursue.x += (Math.random() - 0.5) * noiseFactor * speed;
        pursue.y += (Math.random() - 0.5) * noiseFactor * speed;
        pursue.x = Math.min(Math.max(pursue.x, -speed), speed);
        pursue.y = Math.min(Math.max(pursue.y, -speed), speed);
        let pursueWithFoodAttraction = this.addFoodAttraction(pursue, speed, closestNormalFood, closestGrowthFood);
        this.applyForce({ x: pursueWithFoodAttraction.x - this.vel.x, y: pursueWithFoodAttraction.y - this.vel.y });
    }

    seekFood(food, speed) {
        let desired = { x: food.pos.x - this.pos.x, y: food.pos.y - this.pos.y };
        let mag = Math.sqrt(desired.x * desired.x + desired.y * desired.y);
        desired.x = (desired.x / mag) * speed;
        desired.y = (desired.y / mag) * speed;
        this.applyForce({ x: desired.x - this.vel.x, y: desired.y - this.vel.y });
    }

    addFoodAttraction(direction, speed, closestNormalFood, closestGrowthFood) {
        let foodAttractionRange = 100;
        if (closestNormalFood && this.dist(this.pos, closestNormalFood.pos) < foodAttractionRange) {
            let towardsFood = { x: closestNormalFood.pos.x - this.pos.x, y: closestNormalFood.pos.y - this.pos.y };
            let mag = Math.sqrt(towardsFood.x * towardsFood.x + towardsFood.y * towardsFood.y);
            towardsFood.x = (towardsFood.x / mag) * speed * 1.2;
            towardsFood.y = (towardsFood.y / mag) * speed * 1.2;
            direction.x += towardsFood.x;
            direction.y += towardsFood.y;
        } else if (closestGrowthFood && this.dist(this.pos, closestGrowthFood.pos) < foodAttractionRange) {
            let towardsFood = { x: closestGrowthFood.pos.x - this.pos.x, y: closestGrowthFood.pos.y - this.pos.y };
            let mag = Math.sqrt(towardsFood.x * towardsFood.x + towardsFood.y * towardsFood.y);
            towardsFood.x = (towardsFood.x / mag) * speed * 1.5;
            towardsFood.y = (towardsFood.y / mag) * speed * 1.5;
            direction.x += towardsFood.x;
            direction.y += towardsFood.y;
        }
        return direction;
    }

    updateVelocityAndPosition() {
        this.vel.x += this.acc.x;
        this.vel.y += this.acc.y;
        this.vel.x = Math.min(Math.max(this.vel.x, -this.speedMultiplier * state.frameRateMultiplier), this.speedMultiplier * state.frameRateMultiplier);
        this.vel.y = Math.min(Math.max(this.vel.y, -this.speedMultiplier * state.frameRateMultiplier), this.speedMultiplier * state.frameRateMultiplier);
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
        this.acc.x = 0;
        this.acc.y = 0;
    }

    handleBorders() {
        if (this.pos.x < 0) this.pos.x = 0;
        if (this.pos.x > 1900) this.pos.x = 1900;
        if (this.pos.y < 0) this.pos.y = 0;
        if (this.pos.y > 800) this.pos.y = 800;

        let borderThreshold = 10;
        let borderRepulsionStrength = 0.1;

        if (this.pos.x < borderThreshold) this.applyForce({ x: borderRepulsionStrength, y: 0 });
        if (this.pos.x > 1900 - borderThreshold) this.applyForce({ x: -borderRepulsionStrength, y: 0 });
        if (this.pos.y < borderThreshold) this.applyForce({ x: 0, y: borderRepulsionStrength });
        if (this.pos.y > 800 - borderThreshold) this.applyForce({ x: 0, y: -borderRepulsionStrength });
    }

    reduceEnergy() {
        let distance = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
        this.energy -= distance * 0.08;
    }

    checkEnergy() {
        if (this.energy <= 0) this.die();
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
                this.borderRepulsionAccum.x = 0;
                this.borderRepulsionAccum.y = 0;
                break;
            }
        }
    }

    consumeFood(food) {
        if (food.type === "growth") {
            this.size += 4;
            this.energy += 200;
        } else {
            this.size += 2;
            this.energy += 100;
        }
        this.timeSinceLastMeal = 0;
        this.foodEaten++;
    }

    eatCreature(other) {
        let d = this.dist(this.pos, other.pos);
        if (d < this.size && this.size > other.size && this.color !== other.color) {
            if (state.creatures.includes(other)) {
                this.consumeCreature(other);
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
        let numOffspring = this.calculateNumOffspring();
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
    let newColor = `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
    return newColor;
}

function map(value, start1, stop1, start2, stop2) {
    return ((value - start1) / (stop1 - start1)) * (stop2 - stop2) + start2;
}
