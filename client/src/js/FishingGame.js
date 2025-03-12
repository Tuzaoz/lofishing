import * as THREE from 'three';

// Definição de tipos de peixes
const FISH_TYPES = [
    {
        id: 'common_1',
        name: 'Lambari',
        rarity: 'comum',
        points: 10,
        minTime: 2000,
        maxTime: 5000,
        probability: 0.7
    },
    {
        id: 'common_2',
        name: 'Tilápia',
        rarity: 'comum',
        points: 15,
        minTime: 3000,
        maxTime: 6000,
        probability: 0.6
    },
    {
        id: 'uncommon_1',
        name: 'Tucunaré',
        rarity: 'incomum',
        points: 30,
        minTime: 5000,
        maxTime: 8000,
        probability: 0.3
    },
    {
        id: 'uncommon_2',
        name: 'Traíra',
        rarity: 'incomum',
        points: 35,
        minTime: 5000,
        maxTime: 9000,
        probability: 0.25
    },
    {
        id: 'rare_1',
        name: 'Dourado',
        rarity: 'raro',
        points: 60,
        minTime: 7000,
        maxTime: 12000,
        probability: 0.15
    },
    {
        id: 'rare_2',
        name: 'Pirarucu',
        rarity: 'raro',
        points: 80,
        minTime: 8000,
        maxTime: 15000,
        probability: 0.1
    },
    {
        id: 'legendary_1',
        name: 'Jaú Gigante',
        rarity: 'lendário',
        points: 150,
        minTime: 10000,
        maxTime: 20000,
        probability: 0.05
    }
];

export class FishingGame {
    constructor(scene, camera, water) {
        this.scene = scene;
        this.camera = camera;
        this.water = water;
        this.isFishing = false;
        this.fishingTimer = null;
        this.floater = null;
        this.currentPosition = null;
        this.fishingDirection = null; // Direção para onde o jogador está pescando
        this.socket = null;
        this.fishCaughtCallback = null;
        
        // Novos estados para a mecânica de pesca
        this.fishBiting = false; // Indica se um peixe está mordendo a isca
        this.currentFish = null; // Armazena o peixe atual que está sendo fisgado
        this.bitingTimer = null; // Timer para a janela de tempo de captura
        this.bitingStartTime = null; // Momento em que o peixe começou a morder
        this.bitingDuration = 3000; // Duração da janela de tempo para capturar o peixe (3 segundos)
        this.fishingMessageCallback = null; // Callback para exibir mensagens na UI
        this.timerDisplayCallback = null; // Callback para atualizar a exibição do timer
        
        // Callbacks para efeitos visuais quando um peixe morde
        this.onFishBiteStart = null; // Será chamado quando um peixe começar a morder
        this.onFishBiteEnd = null; // Será chamado quando um peixe parar de morder (escapar ou ser pego)
        
        // Efeitos de pesca
        this.fishingEffects = [];
        
        // Lista de peixes capturados
        this.caughtFishes = [];
    }
    
    setSocket(socket) {
        this.socket = socket;
    }
    
    startFishing(position) {
        if (this.isFishing) return;
        
        this.isFishing = true;
        this.currentPosition = position;
        
        // Obtém a direção da câmera para posicionar os efeitos na água
        this.calculateFishingDirection();
        
        // Cria o flutuador (boia) na água
        this.createFloater(position);
        
        // Anima o flutuador
        this.animateFloater();
        
        // Cria efeito de ondulação na água
        this.createRippleEffect(position);
        
        // Exibe mensagem na UI
        if (this.fishingMessageCallback) {
            this.fishingMessageCallback("Pescando... aguarde o peixe morder!", "info");
        }
        
        // Inicia o processo de pesca no servidor
        if (this.socket) {
            this.socket.emit('startFishing', { position });
        } else {
            // Se não houver conexão com o servidor, simula localmente
            this.simulateFishing();
        }
    }
    
    calculateFishingDirection() {
        // Calcula a direção para onde o jogador está olhando (direção da câmera)
        this.fishingDirection = new THREE.Vector3();
        this.camera.getWorldDirection(this.fishingDirection);
        
        // Normaliza e mantém apenas a direção horizontal
        this.fishingDirection.y = 0;
        this.fishingDirection.normalize();
        
        // Calcula a posição do ponto de pesca baseado na direção da câmera
        // A distância pode ser ajustada conforme necessário
        const fishingDistance = 5; // Distância em unidades 3D
        
        // Atualiza a posição de pesca
        this.fishingPosition = {
            x: this.currentPosition.x + this.fishingDirection.x * fishingDistance,
            y: 0, // Altura da água
            z: this.currentPosition.z + this.fishingDirection.z * fishingDistance
        };
    }
    
    stopFishing() {
        if (!this.isFishing) return;
        
        // Se um peixe estiver mordendo a isca, tenta capturá-lo
        if (this.fishBiting && this.currentFish) {
            this.catchCurrentFish();
        } else if (this.fishBiting) {
            // Para os efeitos visuais de mordida
            if (this.onFishBiteEnd) {
                this.onFishBiteEnd();
            }
        }
        
        this.isFishing = false;
        this.fishBiting = false;
        this.currentFish = null;
        
        // Cancela os timers
        if (this.fishingTimer) {
            clearTimeout(this.fishingTimer);
            this.fishingTimer = null;
        }
        
        if (this.bitingTimer) {
            clearTimeout(this.bitingTimer);
            this.bitingTimer = null;
        }
        
        // Remove o flutuador
        this.removeFloater();
        
        // Notifica o servidor
        if (this.socket) {
            this.socket.emit('stopFishing');
        }
    }
    
    createFloater(position) {
        // Cria uma boia simples (esfera vermelha)
        const geometry = new THREE.SphereGeometry(0.1, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.floater = new THREE.Mesh(geometry, material);
        
        // Se tivermos uma direção de pesca, usa essa direção para posicionar a boia
        if (this.fishingDirection) {
            // Posiciona o flutuador na água na direção da câmera
            const waterY = 0; // Altura da água
            this.floater.position.set(
                this.fishingPosition.x,
                waterY + 0.05,
                this.fishingPosition.z
            );
        } else {
            // Caso tradicional (usado para outros jogadores)
            const waterY = 0; // Altura da água
            this.floater.position.set(position.x, waterY + 0.05, position.z);
        }
        
        // Adiciona à cena
        this.scene.add(this.floater);
    }
    
    removeFloater() {
        if (this.floater) {
            this.scene.remove(this.floater);
            this.floater = null;
        }
    }
    
    animateFloater() {
        if (!this.floater) return;
        
        // Animação simples da boia subindo e descendo levemente
        const initialY = this.floater.position.y;
        const animate = () => {
            if (!this.floater || !this.isFishing) return;
            
            const time = Date.now() * 0.001;
            
            // Se um peixe estiver mordendo, faz a boia se mover mais intensamente
            if (this.fishBiting) {
                this.floater.position.y = initialY + Math.sin(time * 8) * 0.1;
            } else {
                this.floater.position.y = initialY + Math.sin(time * 2) * 0.03;
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    createRippleEffect(position) {
        // Efeito simples de ondulação na água
        const geometry = new THREE.CircleGeometry(0.5, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        const ripple = new THREE.Mesh(geometry, material);
        ripple.rotation.x = -Math.PI / 2; // Alinha com a superfície da água
        
        // Se tivermos uma direção de pesca, usa essa direção para posicionar o efeito
        if (this.fishingDirection && this.fishingPosition) {
            ripple.position.set(
                this.fishingPosition.x,
                0.01,
                this.fishingPosition.z
            );
        } else {
            ripple.position.set(position.x, 0.01, position.z); // Ligeiramente acima da água
        }
        
        this.scene.add(ripple);
        this.fishingEffects.push({
            effect: ripple,
            createdAt: Date.now(),
            duration: 2000, // 2 segundos
            type: 'ripple'
        });
    }
    
    simulateFishing() {
        // Simula o processo de pesca localmente
        // Escolhe um tipo de peixe aleatório com base na probabilidade
        const fishType = this.getRandomFishType();
        
        // Define um tempo aleatório para o peixe morder a isca
        const biteTime = Math.random() * (fishType.maxTime - fishType.minTime) + fishType.minTime;
        
        // Define o timer para a mordida
        this.fishingTimer = setTimeout(() => {
            // Verifica se ainda está pescando
            if (!this.isFishing) return;
            
            // Tenta fazer o peixe morder com base na probabilidade
            if (Math.random() <= fishType.probability) {
                // Peixe mordeu!
                this.startBiting(fishType);
            } else {
                // Falhou, tenta novamente
                this.simulateFishing();
            }
        }, biteTime);
    }
    
    startBiting(fishType) {
        this.fishBiting = true;
        this.currentFish = {
            ...fishType,
            size: this.getRandomSize(fishType),
            weight: this.getRandomWeight(fishType)
        };
        
        // Altera a aparência do flutuador para indicar a mordida
        this.updateFloaterForBiting(true);
        
        // Cria efeito visual de mordida
        this.createBiteEffect();
        
        // Registra o momento em que o peixe começou a morder
        this.bitingStartTime = Date.now();
        
        // Exibe mensagem na UI
        if (this.fishingMessageCallback) {
            this.fishingMessageCallback("Peixe mordendo! Pressione ESPAÇO para pescar!", "success");
        }
        
        // Chama o callback para iniciar efeitos visuais (vibração da vara, etc.)
        if (this.onFishBiteStart) {
            this.onFishBiteStart();
        }
        
        // Define o timer para a janela de captura
        this.bitingTimer = setTimeout(() => {
            // Se ainda estiver com peixe mordendo e não foi capturado
            if (this.fishBiting) {
                this.escapeFish();
            }
        }, this.bitingDuration);
    }
    
    updateFloaterForBiting(isBiting) {
        if (!this.floater) return;
        
        if (isBiting) {
            // Muda a cor do flutuador para verde quando um peixe está mordendo
            this.floater.material.color.set(0x00ff00);
            // Aumenta o tamanho do flutuador
            this.floater.scale.set(2, 2, 2);
        } else {
            // Volta à cor normal (vermelho)
            this.floater.material.color.set(0xff0000);
            // Restaura o tamanho normal
            this.floater.scale.set(1, 1, 1);
        }
    }
    
    escapeFish() {
        // Limpa o estado de mordida
        this.fishBiting = false;
        this.currentFish = null;
        
        // Restaura a aparência do flutuador
        this.updateFloaterForBiting(false);
        
        // Cancela o timer de mordida
        if (this.bitingTimer) {
            clearTimeout(this.bitingTimer);
            this.bitingTimer = null;
        }
        
        // Chama o callback para parar efeitos visuais
        if (this.onFishBiteEnd) {
            this.onFishBiteEnd();
        }
        
        // Cria efeito visual de peixe escapando
        this.createEscapeEffect();
        
        // Exibe mensagem na UI
        if (this.fishingMessageCallback) {
            this.fishingMessageCallback("O peixe escapou!", "error");
        }
        
        // Continua pescando (tenta novamente)
        this.simulateFishing();
    }
    
    catchCurrentFish() {
        if (!this.currentFish) return;
        
        // Adiciona horário de captura
        const fish = {
            ...this.currentFish,
            catchTime: new Date()
        };
        
        // Adiciona o peixe à lista de peixes pegos
        this.caughtFishes.push(fish);
        
        // Limpa o estado de mordida
        this.fishBiting = false;
        this.currentFish = null;
        
        // Cancela o timer de mordida
        if (this.bitingTimer) {
            clearTimeout(this.bitingTimer);
            this.bitingTimer = null;
        }
        
        // Chama o callback para parar efeitos visuais
        if (this.onFishBiteEnd) {
            this.onFishBiteEnd();
        }
        
        // Cria efeito visual de peixe pego
        this.createCatchEffect();
        
        // Restaura a aparência do flutuador
        this.updateFloaterForBiting(false);
        
        // Notifica o servidor
        if (this.socket) {
            this.socket.emit('fishCaught', { fish });
        }
        
        // Chama o callback para atualizar a UI
        if (this.fishCaughtCallback) {
            this.fishCaughtCallback(fish);
        }
        
        // Exibe mensagem na UI
        if (this.fishingMessageCallback) {
            this.fishingMessageCallback(`Peixe capturado: ${fish.name}!`, "success");
        }
    }
    
    createBiteEffect() {
        // Efeito visual quando um peixe morde (círculos na água com cor diferente)
        if (!this.floater) return;
        
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                if (!this.floater) return;
                
                const size = 0.5 * (i + 1);
                const geometry = new THREE.CircleGeometry(size, 32);
                const material = new THREE.MeshBasicMaterial({ 
                    color: 0xffff00, // Amarelo para indicar mordida
                    transparent: true,
                    opacity: 0.5 - (i * 0.1),
                    side: THREE.DoubleSide
                });
                
                const ripple = new THREE.Mesh(geometry, material);
                ripple.rotation.x = -Math.PI / 2;
                ripple.position.set(
                    this.floater.position.x, 
                    0.01, 
                    this.floater.position.z
                );
                
                this.scene.add(ripple);
                this.fishingEffects.push({
                    effect: ripple,
                    createdAt: Date.now(),
                    duration: 1000, // 1 segundo
                    type: 'bite'
                });
            }, i * 150);
        }
    }
    
    createEscapeEffect() {
        // Efeito visual quando um peixe escapa (círculos na água com cor diferente)
        if (!this.floater) return;
        
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                if (!this.floater) return;
                
                const size = 0.5 * (i + 1);
                const geometry = new THREE.CircleGeometry(size, 32);
                const material = new THREE.MeshBasicMaterial({ 
                    color: 0xff0000, // Vermelho para indicar que escapou
                    transparent: true,
                    opacity: 0.5 - (i * 0.1),
                    side: THREE.DoubleSide
                });
                
                const ripple = new THREE.Mesh(geometry, material);
                ripple.rotation.x = -Math.PI / 2;
                ripple.position.set(
                    this.floater.position.x, 
                    0.01, 
                    this.floater.position.z
                );
                
                this.scene.add(ripple);
                this.fishingEffects.push({
                    effect: ripple,
                    createdAt: Date.now(),
                    duration: 1500, // 1.5 segundos
                    type: 'escape'
                });
            }, i * 200);
        }
    }
    
    createCatchEffect() {
        // Efeito visual quando um peixe é pego (círculos maiores na água)
        if (!this.floater) return;
        
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                if (!this.floater) return;
                
                const size = 0.5 * (i + 1);
                const geometry = new THREE.CircleGeometry(size, 32);
                const material = new THREE.MeshBasicMaterial({ 
                    color: 0x00ffff,
                    transparent: true,
                    opacity: 0.5 - (i * 0.1),
                    side: THREE.DoubleSide
                });
                
                const ripple = new THREE.Mesh(geometry, material);
                ripple.rotation.x = -Math.PI / 2;
                ripple.position.set(
                    this.floater.position.x, 
                    0.01, 
                    this.floater.position.z
                );
                
                this.scene.add(ripple);
                this.fishingEffects.push({
                    effect: ripple,
                    createdAt: Date.now(),
                    duration: 1500, // 1.5 segundos
                    type: 'catch'
                });
            }, i * 200);
        }
    }
    
    getRandomFishType() {
        // Sorteia um tipo de peixe com base na raridade/probabilidade
        // Inicialmente, escolhe aleatoriamente entre todos os tipos
        const randomValue = Math.random();
        let cumulativeProbability = 0;
        
        for (const fishType of FISH_TYPES) {
            cumulativeProbability += fishType.probability;
            if (randomValue <= cumulativeProbability) {
                return fishType;
            }
        }
        
        // Caso de fallback, retorna o mais comum
        return FISH_TYPES[0];
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
    
    update() {
        // Atualiza os efeitos visuais (remove os antigos)
        const currentTime = Date.now();
        
        // Atualiza o timer visual se um peixe estiver mordendo
        if (this.fishBiting && this.bitingStartTime && this.timerDisplayCallback) {
            const elapsedTime = currentTime - this.bitingStartTime;
            const remainingTime = Math.max(0, this.bitingDuration - elapsedTime);
            const remainingPercentage = (remainingTime / this.bitingDuration) * 100;
            this.timerDisplayCallback(remainingPercentage);
        }
        
        // Se o jogador estiver pescando, atualiza a posição dos efeitos se necessário
        if (this.isFishing && this.fishingDirection && this.floater) {
            // Recalcula a direção da pesca (caso o jogador tenha movido a câmera)
            this.calculateFishingDirection();
            
            // Atualiza a posição da linha de pesca se o jogador virou a câmera
            // Isso só é necessário se o jogador puder mover a câmera enquanto pesca
        }
        
        for (let i = this.fishingEffects.length - 1; i >= 0; i--) {
            const effect = this.fishingEffects[i];
            const elapsedTime = currentTime - effect.createdAt;
            
            // Se o efeito expirou, remove-o
            if (elapsedTime >= effect.duration) {
                this.scene.remove(effect.effect);
                this.fishingEffects.splice(i, 1);
                continue;
            }
            
            // Atualiza a opacidade do efeito
            const opacity = 1 - (elapsedTime / effect.duration);
            if (effect.effect.material) {
                effect.effect.material.opacity = opacity * 
                    (effect.type === 'ripple' ? 0.3 : 0.5);
            }
            
            // Aumenta o tamanho do efeito gradualmente
            if (effect.type === 'ripple' || effect.type === 'catch' || 
                effect.type === 'bite' || effect.type === 'escape') {
                const scale = 1 + (elapsedTime / effect.duration);
                effect.effect.scale.set(scale, scale, 1);
            }
        }
    }
    
    setFishCaughtCallback(callback) {
        this.fishCaughtCallback = callback;
    }
    
    setFishingMessageCallback(callback) {
        this.fishingMessageCallback = callback;
    }
    
    setTimerDisplayCallback(callback) {
        this.timerDisplayCallback = callback;
    }
    
    getCaughtFishes() {
        return this.caughtFishes;
    }
    
    getTotalScore() {
        return this.caughtFishes.reduce((total, fish) => total + fish.points, 0);
    }
    
    fishCaught(fish) {
        // Esse método é chamado quando o servidor confirma que um peixe foi pego
        this.caughtFishes.push(fish);
        this.createCatchEffect();
        
        // Exibe mensagem na UI
        if (this.fishingMessageCallback) {
            this.fishingMessageCallback(`Você pescou um ${fish.name}!`, "success");
        }
    }
} 