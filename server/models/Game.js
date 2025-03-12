const Player = require('./Player');
const { getRandomFishType } = require('./Fish');

class Game {
    constructor() {
        this.players = {};
        this.fishingTimers = {};
    }
    
    addPlayer(id, name) {
        // Cria um novo jogador com posição aleatória
        const position = this.getRandomPosition();
        const player = new Player(id, name, position);
        
        // Adiciona ao registro de jogadores
        this.players[id] = player;
        
        return player;
    }
    
    removePlayer(id) {
        // Remove o jogador do registro
        if (this.players[id]) {
            delete this.players[id];
        }
        
        // Cancela qualquer timer de pesca
        this.stopFishing(id);
    }
    
    getPlayer(id) {
        return this.players[id];
    }
    
    getPlayers() {
        return Object.values(this.players);
    }
    
    getRandomPosition() {
        // Gera uma posição aleatória para o jogador
        return {
            x: (Math.random() - 0.5) * 10, // -5 a 5
            y: 0, // Altura do chão
            z: (Math.random() - 0.5) * 10  // -5 a 5
        };
    }
    
    startFishing(playerId) {
        const player = this.getPlayer(playerId);
        if (!player || player.isFishing === false) return;
        
        // Cancela qualquer timer existente
        this.stopFishing(playerId);
        
        // Define um novo timer para a pesca
        const fishType = getRandomFishType();
        const catchTime = Math.random() * (fishType.maxTime - fishType.minTime) + fishType.minTime;
        
        this.fishingTimers[playerId] = setTimeout(() => {
            // Verifica se o jogador ainda está pescando
            if (player.isFishing) {
                // Determina se o jogador pega um peixe com base na probabilidade
                if (Math.random() <= fishType.probability) {
                    // Gera tamanho e peso aleatórios para o peixe
                    const fish = {
                        ...fishType,
                        catchTime: new Date(),
                        size: this.getRandomSize(fishType),
                        weight: this.getRandomWeight(fishType)
                    };
                    
                    // Adiciona o peixe ao inventário do jogador
                    player.addFish(fish);
                    player.updateScore();
                    
                    // Retorna o evento para o cliente
                    return {
                        success: true,
                        fish,
                        score: player.score
                    };
                } else {
                    // Não pegou o peixe, tenta novamente
                    this.startFishing(playerId);
                }
            }
        }, catchTime);
    }
    
    stopFishing(playerId) {
        // Cancela o timer de pesca
        if (this.fishingTimers[playerId]) {
            clearTimeout(this.fishingTimers[playerId]);
            delete this.fishingTimers[playerId];
        }
    }
    
    getRandomSize(fishType) {
        // Gera um tamanho aleatório baseado no tipo de peixe
        let baseSize;
        switch (fishType.rarity) {
            case 'comum':
                baseSize = 10; // cm
                break;
            case 'incomum':
                baseSize = 25; // cm
                break;
            case 'raro':
                baseSize = 50; // cm
                break;
            case 'lendário':
                baseSize = 100; // cm
                break;
            default:
                baseSize = 10;
        }
        
        // Variação de ±30%
        return Math.round(baseSize * (0.7 + Math.random() * 0.6));
    }
    
    getRandomWeight(fishType) {
        // Gera um peso aleatório baseado no tipo de peixe
        let baseWeight;
        switch (fishType.rarity) {
            case 'comum':
                baseWeight = 0.2; // kg
                break;
            case 'incomum':
                baseWeight = 1.0; // kg
                break;
            case 'raro':
                baseWeight = 5.0; // kg
                break;
            case 'lendário':
                baseWeight = 15.0; // kg
                break;
            default:
                baseWeight = 0.2;
        }
        
        // Variação de ±30%
        return parseFloat((baseWeight * (0.7 + Math.random() * 0.6)).toFixed(1));
    }
}

module.exports = Game; 