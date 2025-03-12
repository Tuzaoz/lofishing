class Player {
    constructor(id, name, position = { x: 0, y: 0, z: 0 }) {
        this.id = id;
        this.name = name;
        this.position = position;
        this.isFishing = false;
        this.fishingPosition = null;
        this.caughtFishes = [];
        this.score = 0;
        this.action = 'idle'; // idle, fishing, pulling
    }
    
    addFish(fish) {
        this.caughtFishes.push(fish);
    }
    
    updateScore() {
        // Calcula a pontuação baseada nos peixes capturados
        this.score = this.caughtFishes.reduce((total, fish) => total + fish.points, 0);
        return this.score;
    }
    
    getInventory() {
        return this.caughtFishes;
    }
    
    setPosition(position) {
        this.position = position;
    }
    
    setAction(action) {
        this.action = action;
    }
    
    startFishing(position) {
        this.isFishing = true;
        this.fishingPosition = position;
        this.action = 'fishing';
    }
    
    stopFishing() {
        this.isFishing = false;
        this.fishingPosition = null;
        this.action = 'idle';
    }
}

module.exports = Player; 