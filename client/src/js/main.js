import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { io } from 'socket.io-client';
import { FishingGame } from './FishingGame.js';
import { Player } from './Player.js';
import { UI } from './UI.js';

class Game {
    constructor() {
        this.players = {};
        this.playerId = null;
        this.playerName = '';
        this.socket = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.water = null;
        this.controls = null;
        this.fishingGame = null;
        this.ui = null;
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canMove = true;
        this.init();
    }

    init() {
        // Inicializa a tela de login
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
    }

    startGame() {
        this.playerName = document.getElementById('player-name').value.trim();
        if (!this.playerName) {
            alert('Por favor, digite seu nome para começar.');
            return;
        }

        // Esconde a tela de login e mostra a UI do jogo
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('ui-container').style.display = 'block';

        // Inicializa o Three.js
        this.setupThreeJS();
        
        // Inicializa a UI
        this.ui = new UI();
        
        // Adiciona os estilos CSS para mensagens e efeitos visuais
        this.ui.addStyles();
        
        // Inicializa a conexão com o servidor
        this.setupSocketConnection();
        
        // Configura os callbacks entre fishingGame e UI
        this.setupCallbacks();
        
        // Inicia o loop de renderização
        this.animate();
    }

    setupThreeJS() {
        // Cria a cena 3D
        this.scene = new THREE.Scene();
        
        // Configura a câmera
        this.camera = new THREE.PerspectiveCamera(
            75, // Campo de visão mais amplo para primeira pessoa 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        // A posição inicial da câmera será definida quando o jogador for criado
        
        // Configura o renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game-canvas'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        
        // Configura os controles de primeira pessoa (PointerLockControls)
        this.setupFirstPersonControls();
        
        // Cria o céu
        this.setupSky();
        
        // Cria a água
        this.setupWater();
        
        // Cria a ilha e os piers
        this.setupIsland();
        
        // Adiciona luz
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(0, 50, 0);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        // Inicializa o jogo de pesca
        this.fishingGame = new FishingGame(this.scene, this.camera, this.water);
        
        // Evento de redimensionamento
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupFirstPersonControls() {
        // Cria os controles de primeira pessoa
        this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
        
        // Adiciona evento para travar o mouse quando clicar na tela
        this.renderer.domElement.addEventListener('click', () => {
            if (!this.controls.isLocked) {
                this.controls.lock();
            }
        });
        
        // Adiciona eventos para quando o controle é travado/destravado
        this.controls.addEventListener('lock', () => {
            this.canMove = true;
            this.ui.showMessage("Mouse travado - pressione ESC para liberar", "info", 2000);
        });
        
        this.controls.addEventListener('unlock', () => {
            this.canMove = false;
            this.ui.showMessage("Clique na tela para continuar jogando", "info", 2000);
        });
        
        // Adiciona os event listeners para movimento
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
    }
    
    handleKeyDown(event) {
        if (!this.canMove) return;
        
        switch (event.code) {
            case 'KeyW':
                this.moveForward = true;
                break;
            case 'KeyS':
                this.moveBackward = true;
                break;
            case 'KeyA':
                this.moveLeft = true;
                break;
            case 'KeyD':
                this.moveRight = true;
                break;
            case 'Space':
                // Ação de pesca é tratada pelo jogador
                if (this.playerId && this.players[this.playerId]) {
                    if (!this.players[this.playerId].isFishing) {
                        this.players[this.playerId].startFishing();
                    } else {
                        this.players[this.playerId].stopFishing();
                    }
                }
                break;
        }
    }
    
    handleKeyUp(event) {
        switch (event.code) {
            case 'KeyW':
                this.moveForward = false;
                break;
            case 'KeyS':
                this.moveBackward = false;
                break;
            case 'KeyA':
                this.moveLeft = false;
                break;
            case 'KeyD':
                this.moveRight = false;
                break;
        }
    }

    setupSky() {
        const sky = new Sky();
        sky.scale.setScalar(1000);
        this.scene.add(sky);

        const skyUniforms = sky.material.uniforms;
        skyUniforms['turbidity'].value = 10;
        skyUniforms['rayleigh'].value = 2;
        skyUniforms['mieCoefficient'].value = 0.005;
        skyUniforms['mieDirectionalG'].value = 0.8;

        const sun = new THREE.Vector3();
        const phi = THREE.MathUtils.degToRad(88);
        const theta = THREE.MathUtils.degToRad(180);

        sun.setFromSphericalCoords(1, phi, theta);
        skyUniforms['sunPosition'].value.copy(sun);
    }

    setupWater() {
        const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
        this.water = new Water(
            waterGeometry,
            {
                textureWidth: 512,
                textureHeight: 512,
                waterNormals: new THREE.TextureLoader().load('src/assets/waternormals.jpg', function (texture) {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                }),
                sunDirection: new THREE.Vector3(0, 1, 0),
                sunColor: 0xffffff,
                waterColor: 0x001e0f,
                distortionScale: 3.7,
                fog: this.scene.fog !== undefined
            }
        );
        this.water.rotation.x = -Math.PI / 2;
        this.scene.add(this.water);
    }

    setupIsland() {
        // Cria a ilha principal (um círculo elevado)
        const islandRadius = 15;
        const islandGeometry = new THREE.CircleGeometry(islandRadius, 32);
        const islandMaterial = new THREE.MeshLambertMaterial({ color: 0xE2C48C }); // Cor de areia
        const island = new THREE.Mesh(islandGeometry, islandMaterial);
        island.rotation.x = -Math.PI / 2; // Coloca na horizontal
        island.position.y = 0.1; // Ligeiramente acima da água
        this.scene.add(island);
        
        // Adiciona vegetação no centro da ilha (círculo verde)
        const vegetationRadius = 10;
        const vegetationGeometry = new THREE.CircleGeometry(vegetationRadius, 32);
        const vegetationMaterial = new THREE.MeshLambertMaterial({ color: 0x4C9F4C }); // Verde
        const vegetation = new THREE.Mesh(vegetationGeometry, vegetationMaterial);
        vegetation.rotation.x = -Math.PI / 2;
        vegetation.position.y = 0.15; // Ligeiramente acima da ilha
        this.scene.add(vegetation);
        
        // Adiciona palmeiras
        this.addPalmTrees();
        
        // Adiciona pedras decorativas
        this.addDecorationRocks();
        
        // Adiciona uma cabana na ilha
        this.addHut();
        
        // Adiciona o trapiche principal (norte)
        this.addNorthPier();
        
        // Adiciona o pier leste
        this.addEastPier();
        
        // Adiciona o pier oeste (de pedras)
        this.addWestPier();
    }
    
    addPalmTrees() {
        // Adiciona palmeiras em volta da ilha
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const distance = 12; // Distância do centro
            
            // Tronco da palmeira
            const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 4, 8);
            const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            
            // Posiciona a palmeira
            trunk.position.set(
                Math.cos(angle) * distance,
                2, // Metade da altura
                Math.sin(angle) * distance
            );
            
            // Inclina levemente a palmeira em direção aleatória
            trunk.rotation.x = (Math.random() - 0.5) * 0.2;
            trunk.rotation.z = (Math.random() - 0.5) * 0.2;
            
            this.scene.add(trunk);
            
            // Folhas da palmeira (cone)
            const leavesGeometry = new THREE.ConeGeometry(2, 3, 8);
            const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x3A9D23 });
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            
            // Posiciona as folhas no topo do tronco
            leaves.position.y = 2;
            
            // Adiciona as folhas ao tronco
            trunk.add(leaves);
        }
    }
    
    addDecorationRocks() {
        // Adiciona pedras decorativas na ilha
        const rockPositions = [
            { x: -5, z: -7, scale: 1.2 },
            { x: 7, z: 3, scale: 0.8 },
            { x: 0, z: -8, scale: 1 },
            { x: -7, z: 5, scale: 0.7 },
        ];
        
        rockPositions.forEach(pos => {
            const rockGeometry = new THREE.DodecahedronGeometry(pos.scale, 0);
            const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x777777 });
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            
            rock.position.set(pos.x, 0.2, pos.z);
            this.scene.add(rock);
        });
    }
    
    addHut() {
        // Adiciona uma cabana simples na ilha
        const hutPosition = { x: 0, y: 0, z: 5 };
        
        // Base da cabana
        const baseGeometry = new THREE.BoxGeometry(5, 0.2, 4);
        const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(hutPosition.x, hutPosition.y + 0.2, hutPosition.z);
        this.scene.add(base);
        
        // Paredes da cabana
        const wallGeometry = new THREE.BoxGeometry(4.5, 2, 0.2);
        const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xA0522D });
        
        // Parede frontal (com abertura para porta)
        const frontWallLeft = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2, 0.2), wallMaterial);
        frontWallLeft.position.set(hutPosition.x - 1.35, hutPosition.y + 1.1, hutPosition.z + 1.9);
        this.scene.add(frontWallLeft);
        
        const frontWallRight = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2, 0.2), wallMaterial);
        frontWallRight.position.set(hutPosition.x + 1.35, hutPosition.y + 1.1, hutPosition.z + 1.9);
        this.scene.add(frontWallRight);
        
        const frontWallTop = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.5, 0.2), wallMaterial);
        frontWallTop.position.set(hutPosition.x, hutPosition.y + 1.85, hutPosition.z + 1.9);
        this.scene.add(frontWallTop);
        
        // Parede traseira
        const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
        backWall.position.set(hutPosition.x, hutPosition.y + 1.1, hutPosition.z - 1.9);
        this.scene.add(backWall);
        
        // Paredes laterais
        const sideWallGeometry = new THREE.BoxGeometry(0.2, 2, 3.8);
        
        const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        leftWall.position.set(hutPosition.x - 2.25, hutPosition.y + 1.1, hutPosition.z);
        this.scene.add(leftWall);
        
        const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        rightWall.position.set(hutPosition.x + 2.25, hutPosition.y + 1.1, hutPosition.z);
        this.scene.add(rightWall);
        
        // Telhado da cabana (formato piramidal)
        const roofGeometry = new THREE.ConeGeometry(3.5, 2, 4);
        const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(hutPosition.x, hutPosition.y + 2.8, hutPosition.z);
        roof.rotation.y = Math.PI / 4; // Rotaciona para alinhar com a cabana
        this.scene.add(roof);
        
        // Adiciona detalhes - vara de pesca encostada na cabana
        const fishingRodGeometry = new THREE.CylinderGeometry(0.03, 0.03, 4, 8);
        const fishingRodMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const fishingRod = new THREE.Mesh(fishingRodGeometry, fishingRodMaterial);
        fishingRod.position.set(hutPosition.x + 2.3, hutPosition.y + 2, hutPosition.z + 1);
        fishingRod.rotation.z = Math.PI / 4; // Inclina a vara
        this.scene.add(fishingRod);
    }
    
    addNorthPier() {
        // Trapiche principal ao norte da ilha
        const pierLength = 20;
        const pierWidth = 3;
        
        // Base do trapiche (plataforma de madeira)
        const pierGeometry = new THREE.BoxGeometry(pierWidth, 0.2, pierLength);
        const pierMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const pier = new THREE.Mesh(pierGeometry, pierMaterial);
        
        // Posiciona o trapiche começando na borda norte da ilha
        pier.position.set(0, 0.2, -pierLength/2);
        this.scene.add(pier);
        
        // Adiciona pilares de sustentação
        const pilarCount = 10;
        for (let i = 0; i < pilarCount; i++) {
            // Pilares da esquerda
            const leftPilar = this.createPilar();
            leftPilar.position.set(-pierWidth/2 + 0.15, -0.5, -i * 2 - 2);
            this.scene.add(leftPilar);
            
            // Pilares da direita
            const rightPilar = this.createPilar();
            rightPilar.position.set(pierWidth/2 - 0.15, -0.5, -i * 2 - 2);
            this.scene.add(rightPilar);
        }
        
        // Adiciona detalhes ao trapiche (barris, caixas)
        this.addPierDecorations(0, 0.3, -5);
    }
    
    addEastPier() {
        // Pier menor a leste da ilha
        const pierLength = 12;
        const pierWidth = 2;
        
        // Base do pier
        const pierGeometry = new THREE.BoxGeometry(pierLength, 0.2, pierWidth);
        const pierMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const pier = new THREE.Mesh(pierGeometry, pierMaterial);
        
        // Posiciona o pier
        pier.position.set(pierLength/2, 0.2, 8);
        this.scene.add(pier);
        
        // Adiciona pilares de sustentação
        const pilarCount = 6;
        for (let i = 0; i < pilarCount; i++) {
            // Pilares da frente
            const frontPilar = this.createPilar();
            frontPilar.position.set(i * 2 + 2, -0.5, 8 + pierWidth/2 - 0.15);
            this.scene.add(frontPilar);
            
            // Pilares de trás
            const backPilar = this.createPilar();
            backPilar.position.set(i * 2 + 2, -0.5, 8 - pierWidth/2 + 0.15);
            this.scene.add(backPilar);
        }
        
        // Adiciona detalhes ao pier
        this.addPierDecorations(7, 0.3, 8);
    }
    
    addWestPier() {
        // Pier de pedras a oeste da ilha
        const positions = [
            { x: -13, z: 0 },
            { x: -15, z: -1 },
            { x: -17, z: -2 },
            { x: -19, z: -3 },
            { x: -21, z: -4 }
        ];
        
        // Cria pedras grandes achatadas para formar um caminho
        positions.forEach((pos, index) => {
            const stoneGeometry = new THREE.CylinderGeometry(1.2 - index * 0.1, 1.2 - index * 0.1, 0.3, 8);
            const stoneMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
            const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
            
            stone.position.set(pos.x, 0.1, pos.z);
            this.scene.add(stone);
        });
    }
    
    createPilar() {
        // Cria um pilar de madeira para os trapiches
        const pilarGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1.5, 6);
        const pilarMaterial = new THREE.MeshLambertMaterial({ color: 0x6B4226 });
        return new THREE.Mesh(pilarGeometry, pilarMaterial);
    }
    
    addPierDecorations(x, y, z) {
        // Barril
        const barrelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 10);
        const barrelMaterial = new THREE.MeshLambertMaterial({ color: 0x8B572A });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.position.set(x + 0.5, y + 0.3, z + 0.5);
        this.scene.add(barrel);
        
        // Caixa
        const boxGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.6);
        const boxMaterial = new THREE.MeshLambertMaterial({ color: 0xA0522D });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.set(x - 0.5, y + 0.2, z - 0.5);
        this.scene.add(box);
    }

    setupSocketConnection() {
        // Connect to the ngrok URL instead of the default
        this.socket = io('https://ff76-2804-1b2-6243-6aed-6169-b0c0-9d5a-f1ed.ngrok-free.app', {
            transports: ['websocket', 'polling'],
            withCredentials: true
        });

        // Conexão estabelecida com o servidor
        this.socket.on('connect', () => {
            console.log('Conectado ao servidor via ngrok');
            
            // Envia o nome do jogador ao servidor
            this.socket.emit('playerJoin', { name: this.playerName });
        });

        // Recebe o ID do jogador
        this.socket.on('playerJoined', (data) => {
            this.playerId = data.id;
            console.log(`Jogador conectado com ID: ${this.playerId}`);
            
            // Posição inicial do jogador na ilha (ignora a posição do servidor)
            // Coloca o jogador no trapiche principal
            const initialPosition = {
                x: 0,          // Centro do trapiche
                y: 0.3,        // Logo acima do trapiche
                z: -10         // No meio do trapiche norte
            };
            
            // Cria o jogador local
            this.players[this.playerId] = new Player(
                this.scene, 
                this.playerId, 
                this.playerName,
                true,
                this.fishingGame,
                initialPosition, // Usa a posição da ilha em vez da do servidor
                this.camera,     // Passa a câmera para o jogador
                this.controls    // Passa os controles para o jogador
            );
        });

        // Recebe atualizações de outros jogadores
        this.socket.on('playerUpdate', (data) => {
            // Se o jogador não existe, cria um novo
            if (!this.players[data.id] && data.id !== this.playerId) {
                // Verifica se a posição está próxima da origem (água)
                // Se estiver, coloca o jogador em uma posição aleatória na ilha
                let playerPosition = data.position;
                
                // Verificação simplificada - se y for próximo de 0 e não estiver dentro de um raio de 15 (ilha)
                const distanceFromCenter = Math.sqrt(data.position.x * data.position.x + data.position.z * data.position.z);
                if (Math.abs(data.position.y) < 0.5 && distanceFromCenter > 15) {
                    // Gera uma posição aleatória na ilha
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * 8; // Dentro da vegetação
                    
                    playerPosition = {
                        x: Math.cos(angle) * radius,
                        y: 0.3,
                        z: Math.sin(angle) * radius
                    };
                }
                
                this.players[data.id] = new Player(
                    this.scene, 
                    data.id, 
                    data.name,
                    false,
                    this.fishingGame,
                    playerPosition // Usa a posição verificada
                );
                this.ui.addPlayer(data.id, data.name, data.score);
            }
            
            // Atualiza a posição do jogador
            if (data.id !== this.playerId && this.players[data.id]) {
                // Atualiza diretamente as propriedades
                this.players[data.id].position = data.position;
                this.players[data.id].model.position.set(
                    data.position.x, 
                    data.position.y + 1, 
                    data.position.z
                );
                this.ui.updatePlayerScore(data.id, data.score);
            }
        });

        // Recebe evento de pesca bem-sucedida
        this.socket.on('fishCaught', (data) => {
            if (data.playerId === this.playerId) {
                this.fishingGame.fishCaught(data.fish);
                this.ui.updateInventory(data.fish);
                this.ui.updateScore(data.score);
            }
            
            // Atualiza a pontuação do jogador na lista
            this.ui.updatePlayerScore(data.playerId, data.score);
        });

        // Recebe evento de desconexão de jogador
        this.socket.on('playerLeft', (data) => {
            if (this.players[data.id]) {
                this.players[data.id].remove();
                delete this.players[data.id];
                this.ui.removePlayer(data.id);
            }
        });
    }

    setupCallbacks() {
        // Configura o callback para quando um peixe é capturado
        this.fishingGame.setFishCaughtCallback((fish) => {
            this.ui.updateInventory(fish);
            this.ui.updateScore(this.fishingGame.getTotalScore());
        });
        
        // Configura o callback para mensagens durante a pesca
        this.fishingGame.setFishingMessageCallback((message, type) => {
            this.ui.showMessage(message, type);
            
            // Se for uma mensagem de fim de pesca, esconde o timer
            if (message.includes("capturado") || message.includes("escapou")) {
                this.ui.hideBiteTimer();
            }
        });
        
        // Configura o callback para atualizar o timer visual
        this.fishingGame.setTimerDisplayCallback((percentage) => {
            this.ui.updateBiteTimer(percentage);
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Atualiza a água
        this.water.material.uniforms['time'].value += 1.0 / 60.0;
        
        // Movimenta o jogador local
        this.moveLocalPlayer();
        
        // Atualiza o jogo de pesca
        this.fishingGame.update();
        
        // Atualiza os jogadores
        for (const id in this.players) {
            this.players[id].update();
        }
        
        // Envia atualizações do jogador local para o servidor
        if (this.playerId && this.players[this.playerId]) {
            const playerData = {
                id: this.playerId,
                position: this.players[this.playerId].getPosition(),
                action: this.players[this.playerId].getCurrentAction(),
                rotation: this.players[this.playerId].getRotation() // Adicionado para sincronizar a rotação
            };
            this.socket.emit('playerUpdate', playerData);
        }
        
        // Renderiza a cena
        this.renderer.render(this.scene, this.camera);
    }
    
    moveLocalPlayer() {
        if (!this.canMove || !this.playerId || !this.players[this.playerId] || 
            this.players[this.playerId].isFishing) return;
        
        const player = this.players[this.playerId];
        const speed = 0.1;
        let moved = false;
        
        // Calcula a direção com base na rotação da câmera
        const direction = new THREE.Vector3();
        const rotation = this.camera.getWorldDirection(direction);
        
        // Calcula os vetores de movimento
        if (this.moveForward) {
            player.moveForward(speed);
            moved = true;
        }
        if (this.moveBackward) {
            player.moveBackward(speed);
            moved = true;
        }
        if (this.moveLeft) {
            player.moveLeft(speed);
            moved = true;
        }
        if (this.moveRight) {
            player.moveRight(speed);
            moved = true;
        }
    }
}

// Inicializa o jogo quando a página é carregada
window.addEventListener('load', () => {
    new Game();
}); 