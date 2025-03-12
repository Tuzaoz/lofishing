export class UI {
    constructor() {
        this.score = 0;
        this.inventory = [];
        this.players = {};
        
        // Referências aos elementos da UI
        this.playerScoreElement = document.getElementById('player-score');
        this.fishListElement = document.getElementById('fish-list');
        this.onlinePlayersElement = document.getElementById('online-players');
        
        // Elementos para o timer de captura de peixe
        this.biteTimerElement = null;
        
        // Elemento para a mira em primeira pessoa
        this.crosshairElement = null;
        
        this.init();
    }
    
    init() {
        // Inicializa a UI com valores padrão
        this.updateScore(0);
        this.clearInventory();
        this.clearPlayerList();
        
        // Cria o elemento do timer
        this.createBiteTimer();
        
        // Cria a mira para primeira pessoa
        this.createCrosshair();
    }
    
    createBiteTimer() {
        // Cria o timer de mordida (inicialmente oculto)
        const timerContainer = document.createElement('div');
        timerContainer.className = 'bite-timer-container';
        timerContainer.style.position = 'fixed';
        timerContainer.style.top = '50%';
        timerContainer.style.left = '50%';
        timerContainer.style.transform = 'translate(-50%, -50%)';
        timerContainer.style.width = '300px';
        timerContainer.style.height = '30px';
        timerContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        timerContainer.style.borderRadius = '15px';
        timerContainer.style.overflow = 'hidden';
        timerContainer.style.display = 'none';
        timerContainer.style.zIndex = '1001';
        
        const timerBar = document.createElement('div');
        timerBar.className = 'bite-timer-bar';
        timerBar.style.height = '100%';
        timerBar.style.width = '100%';
        timerBar.style.backgroundColor = '#00ff00';
        timerBar.style.transition = 'width 0.1s linear';
        
        timerContainer.appendChild(timerBar);
        document.body.appendChild(timerContainer);
        
        this.biteTimerElement = {
            container: timerContainer,
            bar: timerBar
        };
    }
    
    updateBiteTimer(percentage) {
        if (!this.biteTimerElement) return;
        
        // Mostra o timer
        this.biteTimerElement.container.style.display = 'block';
        
        // Atualiza a largura da barra
        this.biteTimerElement.bar.style.width = `${percentage}%`;
        
        // Muda a cor conforme o tempo diminui
        if (percentage > 66) {
            this.biteTimerElement.bar.style.backgroundColor = '#00ff00'; // Verde
        } else if (percentage > 33) {
            this.biteTimerElement.bar.style.backgroundColor = '#ffff00'; // Amarelo
        } else {
            this.biteTimerElement.bar.style.backgroundColor = '#ff0000'; // Vermelho
        }
        
        // Se o tempo acabou, esconde o timer
        if (percentage <= 0) {
            this.hideBiteTimer();
        }
    }
    
    hideBiteTimer() {
        if (this.biteTimerElement) {
            this.biteTimerElement.container.style.display = 'none';
        }
    }
    
    updateScore(score) {
        this.score = score;
        this.playerScoreElement.textContent = score;
    }
    
    updateInventory(fish) {
        // Adiciona o peixe ao inventário
        this.inventory.push(fish);
        
        // Adiciona o peixe à lista na UI
        const listItem = document.createElement('li');
        listItem.classList.add('fish-item');
        listItem.classList.add(`fish-rarity-${fish.rarity}`);
        
        // Formata a hora de captura
        const catchTime = fish.catchTime ? new Date(fish.catchTime) : new Date();
        const timeString = `${catchTime.getHours().toString().padStart(2, '0')}:${catchTime.getMinutes().toString().padStart(2, '0')}`;
        
        // Cria o conteúdo do item
        listItem.innerHTML = `
            <span class="fish-name">${fish.name}</span>
            <span class="fish-details">
                <span class="fish-rarity">${this.translateRarity(fish.rarity)}</span>
                <span class="fish-size">${fish.size}cm</span>
                <span class="fish-weight">${fish.weight}kg</span>
                <span class="fish-points">+${fish.points}</span>
                <span class="fish-time">${timeString}</span>
            </span>
        `;
        
        // Adiciona cores de acordo com a raridade
        listItem.style.borderLeft = `4px solid ${this.getRarityColor(fish.rarity)}`;
        
        // Adiciona à lista de peixes
        this.fishListElement.prepend(listItem);
        
        // Aplica efeito de entrada
        setTimeout(() => {
            listItem.classList.add('show');
        }, 10);
    }
    
    translateRarity(rarity) {
        // Traduz a raridade para português
        switch (rarity) {
            case 'comum':
                return 'Comum';
            case 'incomum':
                return 'Incomum';
            case 'raro':
                return 'Raro';
            case 'lendário':
                return 'Lendário';
            default:
                return rarity;
        }
    }
    
    getRarityColor(rarity) {
        // Retorna uma cor baseada na raridade
        switch (rarity) {
            case 'comum':
                return '#aaaaaa';
            case 'incomum':
                return '#55aa55';
            case 'raro':
                return '#5555ff';
            case 'lendário':
                return '#ffaa00';
            default:
                return '#ffffff';
        }
    }
    
    clearInventory() {
        this.inventory = [];
        this.fishListElement.innerHTML = '';
    }
    
    addPlayer(id, name, score = 0) {
        // Adiciona um jogador à lista
        this.players[id] = {
            name,
            score
        };
        
        // Cria o elemento na UI
        const listItem = document.createElement('li');
        listItem.id = `player-${id}`;
        listItem.classList.add('player-item');
        listItem.innerHTML = `
            <span class="player-name">${name}</span>
            <span class="player-score">${score}</span>
        `;
        
        // Adiciona à lista de jogadores
        this.onlinePlayersElement.appendChild(listItem);
        
        // Reordena a lista de jogadores por pontuação
        this.sortPlayerList();
    }
    
    updatePlayerScore(id, score) {
        // Atualiza a pontuação de um jogador
        if (this.players[id]) {
            this.players[id].score = score;
            
            // Atualiza o elemento na UI
            const playerElement = document.getElementById(`player-${id}`);
            if (playerElement) {
                const scoreElement = playerElement.querySelector('.player-score');
                if (scoreElement) {
                    scoreElement.textContent = score;
                    
                    // Adiciona efeito de destaque
                    scoreElement.classList.add('highlight');
                    setTimeout(() => {
                        scoreElement.classList.remove('highlight');
                    }, 1000);
                }
            }
            
            // Reordena a lista
            this.sortPlayerList();
        }
    }
    
    removePlayer(id) {
        // Remove um jogador da lista
        if (this.players[id]) {
            delete this.players[id];
            
            // Remove o elemento da UI
            const playerElement = document.getElementById(`player-${id}`);
            if (playerElement) {
                playerElement.classList.add('fade-out');
                setTimeout(() => {
                    if (playerElement.parentNode) {
                        playerElement.parentNode.removeChild(playerElement);
                    }
                }, 500);
            }
        }
    }
    
    clearPlayerList() {
        this.players = {};
        this.onlinePlayersElement.innerHTML = '';
    }
    
    sortPlayerList() {
        // Ordena os jogadores por pontuação em ordem decrescente
        const sortedPlayers = Object.entries(this.players)
            .sort(([, a], [, b]) => b.score - a.score);
        
        // Reordena os elementos na UI
        sortedPlayers.forEach(([id], index) => {
            const playerElement = document.getElementById(`player-${id}`);
            if (playerElement) {
                // Remove e adiciona novamente para reordenar
                playerElement.parentNode.appendChild(playerElement);
                
                // Adiciona classe de posição
                playerElement.classList.remove('first', 'second', 'third');
                if (index === 0) playerElement.classList.add('first');
                if (index === 1) playerElement.classList.add('second');
                if (index === 2) playerElement.classList.add('third');
            }
        });
    }
    
    showMessage(message, type = 'info', duration = 3000) {
        // Cria um elemento de mensagem
        const messageElement = document.createElement('div');
        messageElement.classList.add('game-message', `message-${type}`);
        messageElement.textContent = message;
        
        // Adiciona ao corpo do documento
        document.body.appendChild(messageElement);
        
        // Anima a entrada
        setTimeout(() => {
            messageElement.classList.add('show');
        }, 10);
        
        // Remove após a duração especificada
        setTimeout(() => {
            messageElement.classList.remove('show');
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 500);
        }, duration);
    }
    
    createCrosshair() {
        // Cria uma mira simples no centro da tela
        const crosshair = document.createElement('div');
        crosshair.className = 'crosshair';
        crosshair.style.position = 'fixed';
        crosshair.style.top = '50%';
        crosshair.style.left = '50%';
        crosshair.style.transform = 'translate(-50%, -50%)';
        crosshair.style.width = '10px';
        crosshair.style.height = '10px';
        crosshair.style.border = '2px solid white';
        crosshair.style.borderRadius = '50%';
        crosshair.style.opacity = '0.7';
        crosshair.style.zIndex = '1002';
        crosshair.style.pointerEvents = 'none'; // Permite clicar "através" da mira
        
        document.body.appendChild(crosshair);
        this.crosshairElement = crosshair;
    }
    
    // Método para mostrar/esconder a mira
    toggleCrosshair(show) {
        if (this.crosshairElement) {
            this.crosshairElement.style.display = show ? 'block' : 'none';
        }
    }
    
    // Adiciona estilos CSS para as mensagens e efeitos visuais
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .fish-item {
                opacity: 0;
                transform: translateX(-10px);
                transition: opacity 0.3s, transform 0.3s;
            }
            
            .fish-item.show {
                opacity: 1;
                transform: translateX(0);
            }
            
            .player-score.highlight {
                animation: score-pulse 1s;
            }
            
            @keyframes score-pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.2); color: gold; }
                100% { transform: scale(1); }
            }
            
            .player-item.fade-out {
                opacity: 0;
                transform: translateY(10px);
                transition: opacity 0.5s, transform 0.5s;
            }
            
            .first .player-name::before {
                content: "👑 ";
            }
            
            .second .player-name::before {
                content: "🥈 ";
            }
            
            .third .player-name::before {
                content: "🥉 ";
            }
            
            .game-message {
                position: fixed;
                top: 20%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.8);
                padding: 10px 20px;
                border-radius: 5px;
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                font-weight: bold;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.3s, transform 0.3s;
            }
            
            .game-message.show {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
            
            .message-info {
                background-color: rgba(0, 100, 255, 0.7);
            }
            
            .message-success {
                background-color: rgba(0, 180, 0, 0.7);
            }
            
            .message-error {
                background-color: rgba(255, 50, 50, 0.7);
            }
            
            .fish-rarity-comum {
                background-color: rgba(170, 170, 170, 0.1);
            }
            
            .fish-rarity-incomum {
                background-color: rgba(85, 170, 85, 0.1);
            }
            
            .fish-rarity-raro {
                background-color: rgba(85, 85, 255, 0.1);
            }
            
            .fish-rarity-lendário {
                background-color: rgba(255, 170, 0, 0.1);
            }
            
            .bite-timer-container {
                box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
                animation: pulse 1s infinite alternate;
            }
            
            @keyframes pulse {
                0% { box-shadow: 0 0 15px rgba(255, 255, 255, 0.5); }
                100% { box-shadow: 0 0 20px rgba(255, 255, 255, 0.8); }
            }
            
            .crosshair {
                animation: crosshair-pulse 1.5s infinite alternate;
            }
            
            @keyframes crosshair-pulse {
                0% { opacity: 0.5; }
                100% { opacity: 0.8; }
            }
        `;
        
        document.head.appendChild(style);
    }
} 