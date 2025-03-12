import * as THREE from 'three';

export class Player {
    constructor(scene, id, name, isLocal, fishingGame, position = { x: 0, y: 0, z: 0 }, camera = null, controls = null) {
        this.scene = scene;
        this.id = id;
        this.name = name;
        this.isLocal = isLocal;
        this.fishingGame = fishingGame;
        this.position = position;
        this.action = 'idle'; // idle, fishing, pulling
        this.camera = camera;  // Referência à câmera
        this.controls = controls;  // Referência aos controles de primeira pessoa
        
        this.model = null;
        this.nameTag = null;
        this.rod = null;
        this.fishingLine = null;
        this.isFishing = false;
        this.firstPersonRod = null; // Vara de pesca visível em primeira pessoa
        this.direction = new THREE.Vector3(0, 0, -1); // Direção inicial do jogador
        
        this.initialRodRotation = null;
        this.reel = null;
        this.biteAnimation = null; // Para controlar a animação quando um peixe morde
        this.isReeling = false; // Indica se está recolhendo a linha
        
        // Se inscreve nos eventos do jogo de pesca
        if (this.isLocal && fishingGame) {
            fishingGame.onFishBiteStart = () => this.onFishBite(true);
            fishingGame.onFishBiteEnd = () => this.onFishBite(false);
        }
        
        this.init();
    }
    
    init() {
        // Cria um modelo simples para o jogador (um cilindro representando uma pessoa)
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
        const material = new THREE.MeshLambertMaterial({ 
            color: this.isLocal ? 0x0088ff : 0xff8800 
        });
        this.model = new THREE.Mesh(geometry, material);
        this.model.position.set(this.position.x, this.position.y + 1, this.position.z);
        this.model.castShadow = true;
        this.scene.add(this.model);
        
        // Cria o nome do jogador como texto flutuante
        this.createNameTag();
        
        // Se for o jogador local e em primeira pessoa
        if (this.isLocal && this.camera && this.controls) {
            // Posiciona a câmera no topo do modelo do jogador
            this.camera.position.set(
                this.model.position.x,
                this.model.position.y + 0.7, // Um pouco acima do centro do cilindro
                this.model.position.z
            );
            
            // Configura os controles para a posição inicial
            this.controls.getObject().position.copy(this.camera.position);
            
            // Cria uma vara de pesca visível na visão em primeira pessoa
            this.createFirstPersonRod();
        } else {
            // Para outros jogadores, usa a vara de pesca normal
            this.createFishingRod();
        }
    }
    
    createNameTag() {
        // Cria um elemento div para o nome
        const nameTag = document.createElement('div');
        nameTag.className = 'player-name-tag';
        nameTag.textContent = this.name;
        nameTag.style.position = 'absolute';
        nameTag.style.color = 'white';
        nameTag.style.fontSize = '14px';
        nameTag.style.fontWeight = 'bold';
        nameTag.style.padding = '2px 6px';
        nameTag.style.borderRadius = '4px';
        nameTag.style.backgroundColor = this.isLocal ? 'rgba(0, 136, 255, 0.7)' : 'rgba(255, 136, 0, 0.7)';
        nameTag.style.textAlign = 'center';
        nameTag.style.zIndex = '1000';
        
        // Oculta a tag de nome para o jogador local em primeira pessoa
        if (this.isLocal && this.camera) {
            nameTag.style.display = 'none';
        }
        
        // Adiciona o elemento ao corpo do documento
        document.body.appendChild(nameTag);
        
        this.nameTag = nameTag;
    }
    
    createFishingRod() {
        // Vara de pesca (cilindro fino) para outros jogadores
        const rodGeometry = new THREE.CylinderGeometry(0.05, 0.05, 3, 8);
        const rodMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        this.rod = new THREE.Mesh(rodGeometry, rodMaterial);
        
        // Rotaciona a vara para ficar na horizontal
        this.rod.rotation.z = Math.PI / 2;
        
        // Posiciona a vara nas "mãos" do jogador
        this.rod.position.set(1.5, 0.5, 0);
        
        // Adiciona a vara ao modelo do jogador
        this.model.add(this.rod);
        
        // Cria o material da linha de pesca (linha invisível inicialmente)
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            visible: false
        });
        
        // Cria a geometria da linha com dois pontos
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),  // Ponto da ponta da vara
            new THREE.Vector3(0, -5, 0)  // Ponto na água
        ]);
        
        // Cria a linha de pesca
        this.fishingLine = new THREE.Line(lineGeometry, lineMaterial);
        
        // Adiciona a linha à ponta da vara
        this.rod.add(this.fishingLine);
    }
    
    createFirstPersonRod() {
        // Cria uma vara de pesca mais visível na primeira pessoa
        const rodGeometry = new THREE.CylinderGeometry(0.02, 0.015, 2.0, 8);
        const rodMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        this.firstPersonRod = new THREE.Mesh(rodGeometry, rodMaterial);
        
        // Cria a "empunhadura" da vara (parte mais grossa)
        const handleGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8);
        const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.y = -0.8; // Posicionada na base da vara
        this.firstPersonRod.add(handle);
        
        // Posiciona a vara na parte inferior direita da tela, mais visível para o jogador
        this.firstPersonRod.position.set(0.4, -0.5, -0.6);
        
        // Rotaciona a vara para uma posição mais natural
        this.firstPersonRod.rotation.x = Math.PI / 4; // Ângulo mais pronunciado
        this.firstPersonRod.rotation.z = -Math.PI / 8;
        this.firstPersonRod.rotation.y = Math.PI / 24; // Leve rotação no eixo Y
        
        // Adiciona a vara à câmera
        this.camera.add(this.firstPersonRod);
        
        // Salva a rotação inicial para as animações
        this.initialRodRotation = {
            x: this.firstPersonRod.rotation.x,
            y: this.firstPersonRod.rotation.y,
            z: this.firstPersonRod.rotation.z
        };
        
        // Adiciona um carretel (bobina) à vara
        const reelGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16);
        const reelMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        this.reel = new THREE.Mesh(reelGeometry, reelMaterial);
        this.reel.rotation.x = Math.PI / 2; // Rotaciona perpendicular à vara
        this.reel.position.set(0, -0.5, 0.1); // Posiciona abaixo da vara
        this.firstPersonRod.add(this.reel);
        
        // Cria o material da linha de pesca (linha visível)
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            visible: false,
            linewidth: 2 // Linha mais visível (note que WebGL tem limitações de linewidth)
        });
        
        // Cria a geometria da linha com pontos mais apropriados
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 1.0, 0),  // Ponta da vara
            new THREE.Vector3(0, -10, -10)  // Ponto na água (será atualizado)
        ]);
        
        // Cria a linha de pesca
        this.fishingLine = new THREE.Line(lineGeometry, lineMaterial);
        
        // Adiciona a linha à ponta da vara
        this.firstPersonRod.add(this.fishingLine);
    }
    
    // Métodos para movimentação relativa à direção da câmera
    moveForward(speed) {
        if (this.isFishing) return;
        
        if (this.isLocal && this.camera && this.controls) {
            // Em primeira pessoa, movemos os controles primeiro
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            
            // Mantém apenas o componente horizontal (ignora movimento vertical)
            direction.y = 0;
            direction.normalize();
            
            // Obtém a posição atual dos controles
            const controlsPosition = this.controls.getObject().position;
            
            // Atualiza a posição dos controles
            controlsPosition.add(direction.multiplyScalar(speed));
            
            // Atualiza a posição do modelo para seguir os controles
            this.model.position.set(
                controlsPosition.x,
                controlsPosition.y - 0.7, // Ajuste para a altura da "cabeça"
                controlsPosition.z
            );
            
            // Atualiza a posição dos dados do jogador
            this.updatePositionData();
        } else {
            // Movimento normal para jogadores não locais
            const direction = new THREE.Vector3(0, 0, -1);
            this.model.position.x += direction.x * speed;
            this.model.position.z += direction.z * speed;
            this.updatePositionData();
        }
    }
    
    moveBackward(speed) {
        if (this.isFishing) return;
        
        if (this.isLocal && this.camera && this.controls) {
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            
            // Mantém apenas o componente horizontal e inverte
            direction.y = 0;
            direction.normalize();
            
            // Obtém a posição atual dos controles
            const controlsPosition = this.controls.getObject().position;
            
            // Atualiza a posição dos controles (movimento para trás)
            controlsPosition.add(direction.multiplyScalar(-speed));
            
            // Atualiza a posição do modelo para seguir os controles
            this.model.position.set(
                controlsPosition.x,
                controlsPosition.y - 0.7, // Ajuste para a altura da "cabeça"
                controlsPosition.z
            );
            
            // Atualiza a posição dos dados do jogador
            this.updatePositionData();
        } else {
            // Movimento normal para jogadores não locais
            const direction = new THREE.Vector3(0, 0, -1);
            this.model.position.x -= direction.x * speed;
            this.model.position.z -= direction.z * speed;
            this.updatePositionData();
        }
    }
    
    moveLeft(speed) {
        if (this.isFishing) return;
        
        if (this.isLocal && this.camera && this.controls) {
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            
            // Calcula o vetor para a esquerda (perpendicular à direção)
            const leftDirection = new THREE.Vector3();
            leftDirection.crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
            
            // Obtém a posição atual dos controles
            const controlsPosition = this.controls.getObject().position;
            
            // Atualiza a posição dos controles
            controlsPosition.add(leftDirection.multiplyScalar(speed));
            
            // Atualiza a posição do modelo para seguir os controles
            this.model.position.set(
                controlsPosition.x,
                controlsPosition.y - 0.7, // Ajuste para a altura da "cabeça"
                controlsPosition.z
            );
            
            // Atualiza a posição dos dados do jogador
            this.updatePositionData();
        } else {
            // Movimento normal para jogadores não locais
            const leftDirection = new THREE.Vector3(1, 0, 0);
            this.model.position.x += leftDirection.x * speed;
            this.model.position.z += leftDirection.z * speed;
            this.updatePositionData();
        }
    }
    
    moveRight(speed) {
        if (this.isFishing) return;
        
        if (this.isLocal && this.camera && this.controls) {
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            
            // Calcula o vetor para a direita (perpendicular à direção)
            const rightDirection = new THREE.Vector3();
            rightDirection.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
            
            // Obtém a posição atual dos controles
            const controlsPosition = this.controls.getObject().position;
            
            // Atualiza a posição dos controles
            controlsPosition.add(rightDirection.multiplyScalar(speed));
            
            // Atualiza a posição do modelo para seguir os controles
            this.model.position.set(
                controlsPosition.x,
                controlsPosition.y - 0.7, // Ajuste para a altura da "cabeça"
                controlsPosition.z
            );
            
            // Atualiza a posição dos dados do jogador
            this.updatePositionData();
        } else {
            // Movimento normal para jogadores não locais
            const rightDirection = new THREE.Vector3(-1, 0, 0);
            this.model.position.x += rightDirection.x * speed;
            this.model.position.z += rightDirection.z * speed;
            this.updatePositionData();
        }
    }
    
    // Novo método para atualizar apenas os dados de posição, sem mover o modelo ou controles
    updatePositionData() {
        // Atualiza a posição do jogador
        this.position = {
            x: this.model.position.x,
            y: this.model.position.y - 1, // Ajuste para a altura do cilindro
            z: this.model.position.z
        };
    }
    
    // Método antigo updatePosition renomeado para setModelPosition
    // Usado apenas para jogadores não locais
    setModelPosition(position) {
        if (!this.isLocal) {
            this.position = position;
            this.model.position.set(position.x, position.y + 1, position.z);
        }
    }
    
    getRotation() {
        // Retorna a rotação da câmera (ou uma rotação padrão para jogadores não locais)
        if (this.isLocal && this.camera) {
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            
            // Calcula o ângulo de rotação em torno do eixo Y (yaw)
            const rotation = {
                y: Math.atan2(direction.x, direction.z)
            };
            
            return rotation;
        }
        
        // Para jogadores não locais, usa a rotação do modelo
        return {
            y: this.model.rotation.y
        };
    }
    
    startFishing() {
        if (this.isFishing) return;
        
        this.isFishing = true;
        this.action = 'fishing';
        
        // Torna a linha visível
        if (this.fishingLine) {
            this.fishingLine.material.visible = true;
            
            // Se estiver em primeira pessoa, atualiza a posição do ponto final da linha
            if (this.isLocal && this.firstPersonRod) {
                const direction = new THREE.Vector3();
                this.camera.getWorldDirection(direction);
                
                // Calcula um ponto na água na direção da câmera
                const waterPosition = new THREE.Vector3(
                    this.position.x + direction.x * 5,
                    0.05, // Altura da água
                    this.position.z + direction.z * 5
                );
                
                // Atualiza a geometria da linha
                const linePositions = this.fishingLine.geometry.attributes.position;
                // O primeiro ponto é a ponta da vara (0, 0, 0 no sistema local)
                // O segundo ponto é a posição na água em coordenadas locais da vara
                const target = new THREE.Vector3().copy(waterPosition);
                this.firstPersonRod.worldToLocal(target);
                
                linePositions.setXYZ(1, target.x, target.y, target.z);
                linePositions.needsUpdate = true;
            }
        }
        
        // Notifica o jogo de pesca que o jogador está pescando
        if (this.isLocal) {
            this.fishingGame.startFishing(this.position);
        }
        
        // Animação de lançar a vara
        this.animateCastRod();
    }
    
    stopFishing() {
        if (!this.isFishing) return;
        
        this.isFishing = false;
        this.action = 'idle';
        
        // Marca que está recolhendo para parar a animação de mordida
        this.isReeling = true;
        
        // Para a animação de vibração, se estiver rodando
        if (this.biteAnimation) {
            clearInterval(this.biteAnimation);
            this.biteAnimation = null;
        }
        
        // Animação de recolher a linha
        if (this.isLocal && this.firstPersonRod) {
            this.animateReelRod();
        }
        
        // Torna a linha invisível após a animação de recolhimento
        setTimeout(() => {
            if (this.fishingLine) {
                this.fishingLine.material.visible = false;
            }
            this.isReeling = false; // Terminou de recolher
        }, 600); // Espera a animação terminar antes de esconder a linha
        
        // Notifica o jogo de pesca que o jogador parou de pescar
        if (this.isLocal) {
            this.fishingGame.stopFishing();
        }
    }
    
    animateCastRod() {
        // Animação de lançar a vara
        if (this.isLocal && this.firstPersonRod && this.initialRodRotation) {
            // Sequência de animação mais dramática para o lançamento
            const rodAnimation = [];
            
            // Animação levantando a vara para trás
            rodAnimation.push({
                time: 0,
                rotation: {
                    x: this.initialRodRotation.x - 0.5, // Movimento para trás
                    y: this.initialRodRotation.y,
                    z: this.initialRodRotation.z
                }
            });
            
            // Animação movendo a vara para frente (lançamento)
            rodAnimation.push({
                time: 300,
                rotation: {
                    x: this.initialRodRotation.x + 0.7, // Movimento para frente
                    y: this.initialRodRotation.y,
                    z: this.initialRodRotation.z
                }
            });
            
            // Retorno à posição original com pequena oscilação
            rodAnimation.push({
                time: 500,
                rotation: {
                    x: this.initialRodRotation.x + 0.2, // Pequena oscilação
                    y: this.initialRodRotation.y,
                    z: this.initialRodRotation.z
                }
            });
            
            // Posição final
            rodAnimation.push({
                time: 700,
                rotation: {
                    x: this.initialRodRotation.x,
                    y: this.initialRodRotation.y,
                    z: this.initialRodRotation.z
                }
            });
            
            // Executa cada etapa da animação
            rodAnimation.forEach(step => {
                setTimeout(() => {
                    if (this.firstPersonRod) {
                        this.firstPersonRod.rotation.x = step.rotation.x;
                        this.firstPersonRod.rotation.y = step.rotation.y;
                        this.firstPersonRod.rotation.z = step.rotation.z;
                    }
                }, step.time);
            });
            
            // Adiciona uma animação para o carretel (bobina) girando
            if (this.reel) {
                let reelSpeed = 0;
                const reelAnimation = setInterval(() => {
                    if (!this.reel || !this.isFishing) {
                        clearInterval(reelAnimation);
                        return;
                    }
                    
                    this.reel.rotation.z += reelSpeed;
                    
                    // Desacelera gradualmente
                    reelSpeed = Math.max(0, reelSpeed - 0.01);
                }, 30);
                
                // Inicia o giro rápido
                reelSpeed = 0.3;
            }
        } else if (this.rod) {
            // Animação para a vara em terceira pessoa (para outros jogadores)
            const initialRotation = this.rod.rotation.z;
            
            setTimeout(() => {
                this.rod.rotation.z = initialRotation - 0.3;
            }, 100);
            
            setTimeout(() => {
                this.rod.rotation.z = initialRotation;
            }, 300);
        }
    }
    
    animateReelRod() {
        // Animação de recolher a vara
        if (this.isLocal && this.firstPersonRod && this.initialRodRotation) {
            // Sequência de animação para o recolhimento
            const rodAnimation = [];
            
            // Animação levantando a vara
            rodAnimation.push({
                time: 0,
                rotation: {
                    x: this.initialRodRotation.x - 0.3, // Movimento para cima
                    y: this.initialRodRotation.y,
                    z: this.initialRodRotation.z
                }
            });
            
            // Pequenas oscilações simulando o puxar da linha
            for (let i = 1; i <= 3; i++) {
                rodAnimation.push({
                    time: 100 + i * 100,
                    rotation: {
                        x: this.initialRodRotation.x - 0.3 + (i % 2) * 0.15,
                        y: this.initialRodRotation.y,
                        z: this.initialRodRotation.z + (i % 2) * 0.05
                    }
                });
            }
            
            // Retorno à posição original
            rodAnimation.push({
                time: 500,
                rotation: {
                    x: this.initialRodRotation.x,
                    y: this.initialRodRotation.y,
                    z: this.initialRodRotation.z
                }
            });
            
            // Executa cada etapa da animação
            rodAnimation.forEach(step => {
                setTimeout(() => {
                    if (this.firstPersonRod) {
                        this.firstPersonRod.rotation.x = step.rotation.x;
                        this.firstPersonRod.rotation.y = step.rotation.y;
                        this.firstPersonRod.rotation.z = step.rotation.z;
                    }
                }, step.time);
            });
            
            // Adiciona uma animação para o carretel (bobina) girando rapidamente
            if (this.reel) {
                let reelSpeed = 0.5; // Velocidade inicial rápida
                const reelAnimation = setInterval(() => {
                    if (!this.reel || this.isFishing) {
                        clearInterval(reelAnimation);
                        return;
                    }
                    
                    this.reel.rotation.z += reelSpeed;
                    
                    // Desacelera gradualmente
                    reelSpeed = Math.max(0, reelSpeed - 0.02);
                    
                    // Para a animação quando estiver muito lenta
                    if (reelSpeed < 0.01) {
                        clearInterval(reelAnimation);
                    }
                }, 30);
            }
        }
    }
    
    update() {
        // Atualiza a posição da tag de nome para seguir o jogador na tela
        if (this.nameTag && !this.isLocal) {
            const vector = new THREE.Vector3();
            const widthHalf = window.innerWidth / 2;
            const heightHalf = window.innerHeight / 2;
            
            // Posição do modelo convertida para coordenadas de tela
            this.model.updateWorldMatrix(true, false);
            vector.setFromMatrixPosition(this.model.matrixWorld);
            vector.project(this.fishingGame.camera);
            
            vector.x = (vector.x * widthHalf) + widthHalf;
            vector.y = -(vector.y * heightHalf) + heightHalf;
            
            this.nameTag.style.left = `${vector.x - this.nameTag.offsetWidth / 2}px`;
            this.nameTag.style.top = `${vector.y - 40}px`; // 40px acima do jogador
        }
    }
    
    getPosition() {
        return this.position;
    }
    
    getCurrentAction() {
        return this.action;
    }
    
    remove() {
        // Remove o modelo do jogador da cena
        if (this.model) {
            this.scene.remove(this.model);
        }
        
        // Remove a tag de nome
        if (this.nameTag && this.nameTag.parentNode) {
            this.nameTag.parentNode.removeChild(this.nameTag);
        }
        
        // Remove a vara de pesca em primeira pessoa
        if (this.isLocal && this.firstPersonRod && this.camera) {
            this.camera.remove(this.firstPersonRod);
        }
    }
    
    onFishBite(isHitting) {
        // Chamado quando um peixe começa ou para de morder a isca
        if (!this.isLocal || !this.firstPersonRod) return;
        
        if (isHitting) {
            // Inicia animação de vibração da vara quando um peixe morde
            if (this.biteAnimation) {
                clearInterval(this.biteAnimation);
            }
            
            let intensity = 0.05; // Intensidade inicial da vibração
            let time = 0;
            
            this.biteAnimation = setInterval(() => {
                if (!this.isFishing || !this.firstPersonRod || this.isReeling) {
                    if (this.biteAnimation) {
                        clearInterval(this.biteAnimation);
                        this.biteAnimation = null;
                    }
                    return;
                }
                
                // Aplica vibração aleatória à vara
                if (this.initialRodRotation) {
                    this.firstPersonRod.rotation.x = this.initialRodRotation.x + (Math.random() - 0.5) * intensity;
                    this.firstPersonRod.rotation.z = this.initialRodRotation.z + (Math.random() - 0.5) * intensity;
                    
                    // Intensidade varia com o tempo para um efeito mais realista
                    time += 0.1;
                    intensity = 0.05 + Math.sin(time) * 0.03;
                }
                
                // Agita o carretel um pouco também
                if (this.reel) {
                    this.reel.rotation.z += Math.random() * 0.1;
                }
            }, 50);
        } else {
            // Para a animação de vibração
            if (this.biteAnimation) {
                clearInterval(this.biteAnimation);
                this.biteAnimation = null;
            }
            
            // Restaura a rotação original da vara
            if (this.firstPersonRod && this.initialRodRotation) {
                this.firstPersonRod.rotation.x = this.initialRodRotation.x;
                this.firstPersonRod.rotation.z = this.initialRodRotation.z;
            }
        }
    }
} 