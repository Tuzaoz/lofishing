import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

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
        
        // Novo: variáveis para o modelo 3D e animações
        this.characterModel = null;
        this.mixer = null;
        this.animations = {};
        this.currentAnimation = null;
        this.clock = new THREE.Clock();
        
        // Novas variáveis para acompanhar movimento e posição
        this.isMoving = false;
        this.lastPosition = new THREE.Vector3();
        this.modelOffset = 0; // Reduzido de 1.5 para 0.6 - Distância atrás da câmera
        
        // Nova variável para o modelo da vara de pesca FBX
        this.fishingRodModel = null;
        this.rightHandBone = null;
        
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
            color: this.isLocal ? 0x0088ff : 0xff8800,
            transparent: true,
            opacity: 0 // Torna invisível inicialmente
        });
        this.model = new THREE.Mesh(geometry, material);
        this.model.position.set(this.position.x, this.position.y + 1, this.position.z);
        this.model.castShadow = true;
        this.scene.add(this.model);
        
        // Carrega o modelo 3D (fishing.fbx)
        this.loadCharacterModel();
        
        // Cria o nome do jogador como texto flutuante
        this.createNameTag();
        
        // Se for o jogador local e em primeira pessoa
        if (this.isLocal && this.camera && this.controls) {
            // Posiciona a câmera no topo do modelo do jogador (altura da cabeça)
            this.camera.position.set(
                this.model.position.x,
                this.model.position.y + 1.9, // Aumentado de 2.3 para 1.9 para ficar um pouco acima da cabeça
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
    
    // Novo: Método para carregar o modelo 3D
    loadCharacterModel() {
        const loader = new FBXLoader();
        loader.load('assets/fishing.fbx', (fbx) => {
            this.characterModel = fbx;
            
            // Ajuste de escala e posição
            this.characterModel.scale.set(0.02, 0.02, 0.02);
            this.characterModel.position.y = -1; // Ajuste conforme necessário
            
            // Adiciona o modelo ao jogador
            this.model.add(this.characterModel);
            
            // Configura o mixer para animações
            this.mixer = new THREE.AnimationMixer(this.characterModel);
            
            // Armazena as animações disponíveis
            if (fbx.animations && fbx.animations.length > 0) {
                fbx.animations.forEach((animation) => {
                    // Identifica animações pelo nome
                    const name = animation.name.toLowerCase();
                    this.animations[name] = animation;
                });
                
                // Se não houver animação de pesca ou idle especifica, usa as animações disponíveis
                if (!this.animations['fishing'] && fbx.animations.length > 0) {
                    this.animations['fishing'] = fbx.animations[0];
                }
                
                if (!this.animations['idle'] && fbx.animations.length > 1) {
                    this.animations['idle'] = fbx.animations[1];
                } else if (!this.animations['idle'] && fbx.animations.length > 0) {
                    this.animations['idle'] = fbx.animations[0];
                }
                
                // Inicia a animação de idle
                this.playAnimation('idle');
            }
            
            // Carrega a animação de caminhada
            loader.load('assets/walking.fbx', (walkingFbx) => {
                if (walkingFbx.animations && walkingFbx.animations.length > 0) {
                    // Usa a primeira animação do arquivo
                    this.animations['walking'] = walkingFbx.animations[0];
                    console.log('Animação de caminhada carregada com sucesso');
                } else {
                    console.warn('Arquivo walking.fbx não contém animações');
                }
            }, 
            // Progress callback
            (xhr) => {
                console.log('Animação de caminhada: ' + (xhr.loaded / xhr.total * 100) + '% carregado');
            },
            // Error callback
            (error) => {
                console.error('Erro ao carregar a animação de caminhada', error);
            });
            
            console.log('Modelo 3D carregado com sucesso', this.animations);
            
            // Carrega e conecta o modelo da vara de pesca depois que o personagem é carregado
            this.loadFishingRodModel();
        }, 
        // Progress callback
        (xhr) => {
            console.log((xhr.loaded / xhr.total * 100) + '% carregado');
        },
        // Error callback 
        (error) => {
            console.error('Erro ao carregar o modelo 3D', error);
        });
    }
    
    // Novo método para carregar e conectar o modelo da vara de pesca
    loadFishingRodModel() {
        if (!this.characterModel) return;
        
        const loader = new FBXLoader();
        
        // Lista atualizada de possíveis caminhos para tentar
        const paths = [
            './assets/fishing-road.fbx',
            '../assets/fishing-road.fbx',
            'assets/fishing-road.fbx',
            '/assets/fishing-road.fbx',
            './public/assets/fishing-road.fbx',
            '/client/assets/fishing-road.fbx'
        ];
        
        console.log('Tentando carregar modelo da vara de pesca...');
        
        // Função para tentar carregar de um caminho
        const tryLoadPath = (index) => {
            if (index >= paths.length) {
                console.error('Todos os caminhos falharam. Criando vara geométrica como fallback');
                this.createGeometricRod();
                return;
            }
            
            const path = paths[index];
            console.log(`[Rod] Tentando carregar vara de pesca do caminho: ${path}`);
            
            loader.load(path, 
                // Success callback
                (fbx) => {
                    console.log(`[Rod] Vara de pesca carregada com sucesso do caminho: ${path}`);
                    this.setupFishingRod(fbx);
                },
                // Progress callback
                (xhr) => {
                    console.log(`[Rod] ${path}: ${(xhr.loaded / xhr.total * 100).toFixed(2)}% carregado`);
                },
                // Error callback
                (error) => {
                    console.error(`[Rod] Erro ao carregar do caminho ${path}:`, error);
                    // Tenta o próximo caminho
                    tryLoadPath(index + 1);
                }
            );
        };
        
        // Inicia a tentativa com o primeiro caminho
        tryLoadPath(0);
    }
    
    // Método separado para configurar a vara depois de carregada
    setupFishingRod(fbx) {
        this.fishingRodModel = fbx;
        console.log('[Rod] Modelo da vara carregado com sucesso:', fbx);
        
        // Debug do modelo da vara
        this.debugModelStructure(fbx, 'Vara de Pesca');
        
        // Ajusta escala e posição da vara - AUMENTANDO a escala para maior visibilidade
        this.fishingRodModel.scale.set(0.02, 0.02, 0.02); // Aumentado de 0.01 para 0.02
        
        // Sabemos que o nome do osso é mixamorigRightHand, vamos procurar diretamente
        this.rightHandBone = this.findNamedBone(this.characterModel, "mixamorigRightHand");
        
        if (this.rightHandBone) {
            console.log('[Rod] Osso da mão direita encontrado! (mixamorigRightHand)');
            
            // Adiciona a vara de pesca como filha do osso da mão direita
            this.rightHandBone.add(this.fishingRodModel);
            
            // Ajustes na posição e rotação da vara em relação à mão
            // Posição mais alta para ficar mais em pé
            this.fishingRodModel.position.set(0.5, 1.0, 0);
            // Rotação mais vertical
            this.fishingRodModel.rotation.set(0, -90, 0);
            
            // Ajustando o tamanho da vara para ficar proporcional e maior
            this.fishingRodModel.scale.set(1.0, 1.0, 1.0); // Aumentado de 0.5 para 1.0
            
            console.log('[Rod] Vara anexada ao osso mixamorigRightHand');
        } else {
            console.warn('[Rod] Não foi possível encontrar o osso mixamorigRightHand. Tentando método alternativo.');
            
            // Tentativa alternativa - procurar por qualquer osso da mão direita
            this.rightHandBone = this.findRightHandBone(this.characterModel);
            
            if (this.rightHandBone) {
                console.log('[Rod] Encontrado osso alternativo:', this.rightHandBone.name);
                this.rightHandBone.add(this.fishingRodModel);
                this.fishingRodModel.position.set(0.5, 1.0, 0);
                this.fishingRodModel.rotation.set(0, -90, 0);
                this.fishingRodModel.scale.set(1.0, 1.0, 1.0);
            } else {
                // Se não encontrar o osso da mão, adiciona ao modelo do personagem
                console.warn('[Rod] Nenhum osso da mão encontrado. Adicionando a vara ao modelo do personagem.');
                this.characterModel.add(this.fishingRodModel);
                
                // Posição aproximada para a mão direita - AJUSTANDO posição para ser mais visível
                this.fishingRodModel.position.set(30, 110, 15);
                this.fishingRodModel.rotation.set(0, 0, 0);
            }
        }
        
        // Inicialmente invisível até que a animação de pesca seja ativada
        this.fishingRodModel.visible = false;
        
        // Garantindo que todos os meshes dentro do modelo estejam visíveis quando a vara for mostrada
        this.fishingRodModel.traverse(child => {
            if (child.isMesh) {
                child.visible = true;
                child.castShadow = true;
                child.receiveShadow = true;
                console.log('[Rod] Mesh dentro da vara de pesca:', child.name);
            }
        });
        
        console.log('[Rod] Modelo da vara de pesca configurado com sucesso');
    }
    
    // Método para debugar a estrutura de um modelo
    debugModelStructure(model, modelName) {
        console.log(`\n===== ESTRUTURA DO MODELO: ${modelName} =====`);
        
        // Contadores para estatísticas
        let meshCount = 0;
        let materialCount = 0;
        let textureCount = 0;
        let boneCount = 0;
        
        // Função para analisar recursivamente o modelo
        const analyzeObject = (obj, indent = 0) => {
            const spacing = ' '.repeat(indent * 2);
            const type = obj.type || 'Unknown';
            console.log(`${spacing}${obj.name || 'unnamed'} [${type}]`);
            
            // Detecta tipos específicos
            if (obj.isMesh) {
                meshCount++;
                console.log(`${spacing}  - MESH com geometria: ${obj.geometry ? obj.geometry.type : 'nenhuma'}`);
                console.log(`${spacing}  - Material: ${obj.material ? obj.material.type : 'nenhum'}`);
            }
            
            if (obj.isBone) {
                boneCount++;
            }
            
            if (obj.material) {
                materialCount++;
                if (obj.material.map) textureCount++;
            }
            
            // Processa filhos recursivamente
            if (obj.children && obj.children.length > 0) {
                obj.children.forEach(child => {
                    analyzeObject(child, indent + 1);
                });
            }
        };
        
        // Analisa o modelo
        analyzeObject(model);
        
        // Exibe estatísticas
        console.log(`\n----- ESTATÍSTICAS DO MODELO -----`);
        console.log(`Meshes: ${meshCount}`);
        console.log(`Materiais: ${materialCount}`);
        console.log(`Texturas: ${textureCount}`);
        console.log(`Ossos: ${boneCount}`);
        console.log(`===================================\n`);
    }
    
    // Método específico para encontrar um osso pelo nome exato
    findNamedBone(model, boneName) {
        let foundBone = null;
        
        // Função para procurar recursivamente
        const searchForBone = (object) => {
            // Verifica se o objeto atual é um osso com o nome procurado
            if (object.isBone && object.name === boneName) {
                foundBone = object;
                return true;
            }
            
            // Se não, procura nos filhos
            if (object.children) {
                for (const child of object.children) {
                    if (searchForBone(child)) {
                        return true;
                    }
                }
            }
            
            return false;
        };
        
        // Inicia a busca
        searchForBone(model);
        
        if (foundBone) {
            console.log(`Osso ${boneName} encontrado!`);
        } else {
            console.warn(`Osso ${boneName} NÃO encontrado na hierarquia do modelo.`);
            
            // Para depuração, lista todos os ossos disponíveis
            const allBones = [];
            model.traverse(obj => {
                if (obj.isBone) {
                    allBones.push(obj.name);
                }
            });
            
            console.log('Ossos disponíveis:', allBones);
        }
        
        return foundBone;
    }
    
    // Método de fallback para criar uma vara de pesca geométrica simples
    createGeometricRod() {
        console.log('[Rod] Criando vara de pesca geométrica como fallback');
        
        // Cria um grupo para representar a vara de pesca
        this.fishingRodModel = new THREE.Group();
        
        // Cria o corpo da vara (cilindro alongado) - Aumentando comprimento e tornando mais visível
        const rodGeometry = new THREE.CylinderGeometry(0.15, 0.08, 45, 8); // Aumentado tamanho e detalhes
        const rodMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513, emissive: 0x3d2314 }); // Marrom com emissão
        const rod = new THREE.Mesh(rodGeometry, rodMaterial);
        
        // Rotaciona para ficar mais na vertical
        rod.rotation.z = Math.PI / 3; // Alterado de Math.PI/2 para Math.PI/3 para ficar mais vertical
        
        // Adiciona ao grupo
        this.fishingRodModel.add(rod);
        
        // Cria a empunhadura (cilindro mais grosso) - Aumentando tamanho
        const handleGeometry = new THREE.CylinderGeometry(0.25, 0.25, 8, 8); // Aumentado de 0.15 para 0.25 e de 5 para 8
        const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x654321, emissive: 0x2a1a0d }); // Marrom escuro com emissão
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        
        // Posiciona na ponta da vara - Ajustado para nova rotação
        handle.position.set(-18, 0, 0);
        handle.rotation.z = Math.PI / 3; // Alterado para corresponder com a vara
        
        // Adiciona ao grupo
        this.fishingRodModel.add(handle);
        
        // Adiciona detalhes adicionais para maior visibilidade
        // Ponta da vara (cone para maior destaque)
        const tipGeometry = new THREE.ConeGeometry(0.1, 1.5, 8);
        const tipMaterial = new THREE.MeshLambertMaterial({ color: 0xC0C0C0, emissive: 0x303030 }); // Prateado
        const tip = new THREE.Mesh(tipGeometry, tipMaterial);
        tip.position.set(21, 0, 0);
        tip.rotation.z = Math.PI / 3;
        this.fishingRodModel.add(tip);
        
        // Procura pelo osso da mão direita - tentamos especificamente o mixamorigRightHand primeiro
        this.rightHandBone = this.findNamedBone(this.characterModel, "mixamorigRightHand");
        
        if (!this.rightHandBone) {
            // Se não encontrar, tenta o método geral
            this.rightHandBone = this.findRightHandBone(this.characterModel);
        }
        
        if (this.rightHandBone) {
            console.log('[Rod] Osso da mão encontrado para vara geométrica:', this.rightHandBone.name);
            this.rightHandBone.add(this.fishingRodModel);
            this.fishingRodModel.position.set(0.5, 1.5, 0); // Posição mais alta
            this.fishingRodModel.rotation.set(0, -90, 0); // Mais vertical
            this.fishingRodModel.scale.set(1.5, 1.5, 1.5); // Escala maior
        } else {
            console.warn('[Rod] Nenhum osso da mão encontrado. Adicionando a vara ao modelo do personagem.');
            this.characterModel.add(this.fishingRodModel);
            
            // Posição aproximada para a mão direita - AJUSTANDO posição para ser mais visível
            this.fishingRodModel.position.set(35, 120, 20);
            this.fishingRodModel.rotation.set(0, -90, 0);
        }
        
        // Inicialmente invisível até que a animação de pesca seja ativada
        this.fishingRodModel.visible = false;
    }
    
    // Método para encontrar o osso da mão direita no esqueleto
    findRightHandBone(model) {
        let rightHandBone = null;
        const possibleNames = [
            'RightHand', 'Hand_R', 'right_hand', 'hand_right', 'mao_direita', 
            'hand.r', 'hand_r', 'handright', 'righthand', 'right.hand',
            'r_hand', 'rhand', 'r_wrist', 'rightwrist', 'wrist_r',
            'mixamorigRightHand', 'mixamorig:RightHand', 'mixamorig_RightHand',
            // Nomes básicos de ossos (pode identificar errado, mas é melhor que nada)
            'right', 'hand', 'arm', 'palm', 'finger', 'wrist'
        ];
        
        // Para depuração, imprime todos os nomes de ossos
        console.log('Procurando pelo osso da mão direita...');
        const allBoneNames = [];
        
        // Função para coletar nomes de todos os ossos
        const collectBoneNames = (object) => {
            if (object.isBone) {
                allBoneNames.push(object.name);
            }
            
            if (object.children) {
                for (const child of object.children) {
                    collectBoneNames(child);
                }
            }
        };
        
        // Coleta todos os nomes de ossos para depuração
        collectBoneNames(model);
        console.log('Ossos encontrados:', allBoneNames);
        
        if (allBoneNames.length === 0) {
            console.warn('NENHUM OSSO ENCONTRADO NO MODELO! Isso pode indicar que o modelo não tem esqueleto.');
            return null;
        }
        
        // Imprime toda a hierarquia do modelo para depuração
        console.log('Hierarquia do modelo:');
        this.printModelHierarchy(model);
        
        // Função para procurar recursivamente nos filhos do modelo
        const searchBones = (object) => {
            if (object.isBone) {
                // Verifica se o nome do osso contém "right" e "hand" (case insensitive)
                const name = object.name.toLowerCase();
                if ((name.includes('right') && name.includes('hand')) || 
                    (name.includes('r_') && name.includes('hand')) ||
                    (name.includes('hand_r')) ||
                    (name.includes('hand') && name.includes('r')) ||
                    possibleNames.some(boneName => 
                        object.name.toLowerCase() === boneName.toLowerCase())) {
                    rightHandBone = object;
                    return true;
                }
            }
            
            // Se não encontrou, procura nos filhos
            if (object.children) {
                for (const child of object.children) {
                    if (searchBones(child)) {
                        return true;
                    }
                }
            }
            
            return false;
        };
        
        // Começa a busca no modelo do personagem
        searchBones(model);
        
        // Se não encontrou com o método acima, tenta localizar o primeiro osso com "hand" no nome
        if (!rightHandBone) {
            console.warn('Não foi possível encontrar o osso da mão direita com os nomes comuns. Procurando por qualquer osso de mão...');
            
            // Função alternativa para encontrar qualquer osso de mão
            const findAnyHandBone = (object) => {
                if (object.isBone) {
                    const name = object.name.toLowerCase();
                    if (name.includes('hand')) {
                        console.log('Encontrado um osso de mão:', object.name);
                        return object;
                    }
                }
                
                if (object.children) {
                    for (const child of object.children) {
                        const result = findAnyHandBone(child);
                        if (result) return result;
                    }
                }
                
                return null;
            };
            
            rightHandBone = findAnyHandBone(model);
        }
        
        // Se ainda não encontrou, pega o primeiro osso disponível como último recurso
        if (!rightHandBone && allBoneNames.length > 0) {
            console.warn('Nenhum osso de mão encontrado. Usando o primeiro osso disponível como último recurso.');
            
            const findFirstBone = (object) => {
                if (object.isBone) {
                    console.log('Usando primeiro osso encontrado:', object.name);
                    return object;
                }
                
                if (object.children) {
                    for (const child of object.children) {
                        const result = findFirstBone(child);
                        if (result) return result;
                    }
                }
                
                return null;
            };
            
            rightHandBone = findFirstBone(model);
        }
        
        return rightHandBone;
    }
    
    // Método para imprimir a hierarquia do modelo para depuração
    printModelHierarchy(obj, indent = 0) {
        const spacing = ' '.repeat(indent * 2);
        const isBone = obj.isBone ? ' [BONE]' : '';
        const isMesh = obj.isMesh ? ' [MESH]' : '';
        console.log(`${spacing}${obj.name || 'unnamed'}${isBone}${isMesh}`);
        
        if (obj.children && obj.children.length > 0) {
            obj.children.forEach(child => {
                this.printModelHierarchy(child, indent + 1);
            });
        }
    }
    
    // Novo: Método para reproduzir animações
    playAnimation(name, fadeIn = 0.5) {
        if (!this.mixer || !this.animations[name]) {
            console.warn(`Animação '${name}' não encontrada`);
            return;
        }
        
        // Para a animação atual se existir
        if (this.currentAnimation) {
            this.currentAnimation.fadeOut(fadeIn);
        }
        
        // Inicia a nova animação
        const animation = this.mixer.clipAction(this.animations[name]);
        animation.reset().fadeIn(fadeIn).play();
        this.currentAnimation = animation;
        
        console.log(`Reproduzindo animação: ${name}`);
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
            
            // Calcula uma posição atrás da câmera para o modelo
            const modelDirection = new THREE.Vector3();
            this.camera.getWorldDirection(modelDirection);
            modelDirection.y = 0;
            modelDirection.normalize();
            
            // Posiciona o modelo atrás da câmera
            this.model.position.set(
                controlsPosition.x - modelDirection.x * this.modelOffset,
                controlsPosition.y - 2.3, // Ajustado para manter consistência com a inicialização
                controlsPosition.z - modelDirection.z * this.modelOffset
            );
            
            // Marca que o jogador está se movendo
            this.isMoving = true;
            
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
            
            // Calcula uma posição atrás da câmera para o modelo
            const modelDirection = new THREE.Vector3();
            this.camera.getWorldDirection(modelDirection);
            modelDirection.y = 0;
            modelDirection.normalize();
            
            // Posiciona o modelo atrás da câmera
            this.model.position.set(
                controlsPosition.x - modelDirection.x * this.modelOffset,
                controlsPosition.y - 2.3, // Ajustado para manter consistência com a inicialização
                controlsPosition.z - modelDirection.z * this.modelOffset
            );
            
            // Marca que o jogador está se movendo
            this.isMoving = true;
            
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
            
            // Calcula uma posição atrás da câmera para o modelo
            const modelDirection = new THREE.Vector3();
            this.camera.getWorldDirection(modelDirection);
            modelDirection.y = 0;
            modelDirection.normalize();
            
            // Posiciona o modelo atrás da câmera
            this.model.position.set(
                controlsPosition.x - modelDirection.x * this.modelOffset,
                controlsPosition.y - 2.3, // Ajustado para manter consistência com a inicialização
                controlsPosition.z - modelDirection.z * this.modelOffset
            );
            
            // Marca que o jogador está se movendo
            this.isMoving = true;
            
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
            
            // Calcula uma posição atrás da câmera para o modelo
            const modelDirection = new THREE.Vector3();
            this.camera.getWorldDirection(modelDirection);
            modelDirection.y = 0;
            modelDirection.normalize();
            
            // Posiciona o modelo atrás da câmera
            this.model.position.set(
                controlsPosition.x - modelDirection.x * this.modelOffset,
                controlsPosition.y - 2.3, // Ajustado para manter consistência com a inicialização
                controlsPosition.z - modelDirection.z * this.modelOffset
            );
            
            // Marca que o jogador está se movendo
            this.isMoving = true;
            
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
        
        console.log('[Fishing] Iniciando pesca...');
        
        // Reproduz a animação de pesca
        if (this.characterModel && this.mixer) {
            this.playAnimation('fishing');
        }
        
        // Mostra o modelo da vara de pesca FBX se estiver disponível
        if (this.fishingRodModel) {
            console.log('[Fishing] Mostrando vara de pesca modelo FBX');
            
            // Verificar se a vara está corretamente conectada ao osso da mão
            if (!this.rightHandBone || !this.rightHandBone.children.includes(this.fishingRodModel)) {
                console.log('[Fishing] Reconectando vara ao osso da mão direita...');
                
                // Tenta reconectar ao osso
                this.rightHandBone = this.findNamedBone(this.characterModel, "mixamorigRightHand");
                
                if (this.rightHandBone) {
                    // Remove do parent atual se existir
                    if (this.fishingRodModel.parent) {
                        this.fishingRodModel.parent.remove(this.fishingRodModel);
                    }
                    
                    // Adiciona ao osso da mão
                    this.rightHandBone.add(this.fishingRodModel);
                    
                    // Ajusta posição, rotação e escala para maior visibilidade
                    this.fishingRodModel.position.set(0.5, 1.5, 0);  // Posição mais alta
                    this.fishingRodModel.rotation.set(0, -90, 0);  // Mais vertical
                    this.fishingRodModel.scale.set(1.5, 1.5, 1.5);  // Escala maior
                    console.log('[Fishing] Vara reposicionada e redimensionada para maior visibilidade');
                }
            }
            
            // Agora torna a vara visível
            this.fishingRodModel.visible = true;
            
            // Garante que todos os meshes da vara estão visíveis
            this.fishingRodModel.traverse(child => {
                if (child.isMesh) {
                    child.visible = true;
                    child.material.needsUpdate = true;
                    console.log('[Fishing] Tornando mesh visível:', child.name);
                }
            });
        } else {
            console.warn('[Fishing] Modelo da vara de pesca não está disponível! Tentando carregar...');
            this.loadFishingRodModel(); // Tenta carregar se não estiver disponível
            
            // Se o modelo não estiver disponível mesmo após tentativa de carregamento, cria uma vara geométrica
            setTimeout(() => {
                if (!this.fishingRodModel && this.isFishing) {
                    console.warn('[Fishing] Modelo da vara ainda não disponível. Criando vara geométrica...');
                    this.createGeometricRod();
                    this.fishingRodModel.visible = true;
                }
            }, 1000);
        }
        
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
        
        console.log('Parando de pescar...');
        
        this.isFishing = false;
        this.action = 'idle';
        
        // Volta para a animação de idle
        if (this.characterModel && this.mixer) {
            this.playAnimation('idle');
        }
        
        // Esconde o modelo da vara de pesca FBX
        if (this.fishingRodModel) {
            console.log('Escondendo vara de pesca modelo FBX');
            // Descomentar a linha abaixo para garantir que a vara fique invisível
            this.fishingRodModel.visible = false;
        }
        
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
    
    update(deltaTime) {
        // Atualiza a posição da tag de nome
        if (this.nameTag) {
            const position = this.getPosition();
            const vector = new THREE.Vector3(position.x, position.y + 2.5, position.z);
            
            // Usa a câmera correta
            if (this.camera) {
                // Projeta a posição 3D para coordenadas de tela
                vector.project(this.camera);
                
                // Converte para coordenadas CSS
                const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
                
                // Atualiza a posição da tag
                this.nameTag.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
                
                // Ajusta a opacidade baseada na distância
                const distance = new THREE.Vector3(position.x, position.y, position.z).distanceTo(this.camera.position);
                const opacity = 1.0 - Math.min(Math.max((distance - 5) / 15, 0), 0.8);
                this.nameTag.style.opacity = opacity.toFixed(2);
            } else if (this.fishingGame && this.fishingGame.camera) {
                // Tenta usar a câmera do jogo se disponível
                vector.project(this.fishingGame.camera);
                
                // Converte para coordenadas CSS
                const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
                
                // Atualiza a posição da tag
                this.nameTag.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
            }
        }
        
        // Se for o jogador local, rotaciona o modelo 3D para seguir a direção da câmera
        if (this.isLocal && this.camera && this.characterModel) {
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            
            // Calcula o ângulo de rotação no eixo Y (yaw)
            const rotationY = Math.atan2(direction.x, direction.z);
            
            // Aplica a rotação ao modelo
            this.characterModel.rotation.y = rotationY;
        }
        
        // VERSÃO MELHORADA: Controla a visibilidade da vara de pesca com base no estado de pesca
        if (this.fishingRodModel) {
            // Mostra apenas quando estiver pescando
            if (this.isFishing) {
                this.fishingRodModel.visible = true;
                
                // Garante que todos os meshes da vara estão visíveis
                this.fishingRodModel.traverse(child => {
                    if (child.isMesh) {
                        child.visible = true;
                    }
                });
                
                // Verifica se a vara está corretamente conectada ao osso da mão
                if (this.rightHandBone && !this.rightHandBone.children.includes(this.fishingRodModel)) {
                    // Remove do parent atual se existir
                    if (this.fishingRodModel.parent) {
                        this.fishingRodModel.parent.remove(this.fishingRodModel);
                    }
                    
                    // Adiciona ao osso da mão
                    this.rightHandBone.add(this.fishingRodModel);
                    
                    // Ajusta posição, rotação e escala
                    this.fishingRodModel.position.set(0.5, 1.0, 0);
                    this.fishingRodModel.rotation.set(0, -90, 0);
                    this.fishingRodModel.scale.set(1.0, 1.0, 1.0);
                }
            } else {
                this.fishingRodModel.visible = false;
            }
        }

        // Atualiza a animação com base no movimento (apenas se não estiver pescando)
        if (this.characterModel && this.mixer && !this.isFishing) {
            // Verifica se o jogador está se movendo
            if (this.isMoving) {
                // Reproduz a animação de caminhada se disponível
                if (this.animations['walking'] && 
                    (!this.currentAnimation || this.currentAnimation._clip !== this.animations['walking'])) {
                    this.playAnimation('walking');
                }
            } else {
                // Volta para a animação de idle
                if (this.animations['idle'] && 
                    (!this.currentAnimation || this.currentAnimation._clip !== this.animations['idle'])) {
                    this.playAnimation('idle');
                }
            }
            
            // Reinicia a flag de movimento para o próximo frame
            this.isMoving = false;
        }
        
        // Atualiza o mixer de animação se existir
        if (this.mixer) {
            this.mixer.update(this.clock.getDelta());
        }
    }

    getPosition() {
        return this.position;
    }

    getCurrentAction() {
        return this.action;
    }
    
    // Add the missing onFishBite method
    onFishBite(isActive) {
        console.log(`[Fishing] Fish bite ${isActive ? 'started' : 'ended'}`);
        
        // Se não estiver pescando, ignora o evento
        if (!this.isFishing) return;
        
        if (isActive) {
            // Inicia a animação de mordida (vibração da vara)
            if (this.isLocal && this.firstPersonRod) {
                // Salva a rotação atual
                const currentRotation = {
                    x: this.firstPersonRod.rotation.x,
                    y: this.firstPersonRod.rotation.y,
                    z: this.firstPersonRod.rotation.z
                };
                
                // Para qualquer animação anterior de mordida
                if (this.biteAnimation) {
                    clearInterval(this.biteAnimation);
                }
                
                // Cria uma nova animação de vibração
                this.biteAnimation = setInterval(() => {
                    if (!this.isFishing || this.isReeling) {
                        clearInterval(this.biteAnimation);
                        this.biteAnimation = null;
                        return;
                    }
                    
                    // Aplica uma pequena vibração aleatória
                    this.firstPersonRod.rotation.x = currentRotation.x + (Math.random() - 0.5) * 0.1;
                    this.firstPersonRod.rotation.y = currentRotation.y + (Math.random() - 0.5) * 0.05;
                    this.firstPersonRod.rotation.z = currentRotation.z + (Math.random() - 0.5) * 0.05;
                }, 50);
            } else if (this.fishingRodModel) {
                // Para jogadores não locais ou em terceira pessoa
                // Adiciona vibração ao modelo da vara FBX
                const originalPosition = new THREE.Vector3().copy(this.fishingRodModel.position);
                
                if (this.biteAnimation) {
                    clearInterval(this.biteAnimation);
                }
                
                this.biteAnimation = setInterval(() => {
                    if (!this.isFishing || this.isReeling) {
                        clearInterval(this.biteAnimation);
                        this.biteAnimation = null;
                        
                        // Restaura a posição original
                        if (this.fishingRodModel) {
                            this.fishingRodModel.position.copy(originalPosition);
                        }
                        return;
                    }
                    
                    // Vibração aleatória na posição da vara
                    if (this.fishingRodModel) {
                        this.fishingRodModel.position.set(
                            originalPosition.x + (Math.random() - 0.5) * 0.2,
                            originalPosition.y + (Math.random() - 0.5) * 0.2,
                            originalPosition.z + (Math.random() - 0.5) * 0.2
                        );
                    }
                }, 50);
            }
        } else {
            // Para a animação de vibração
            if (this.biteAnimation) {
                clearInterval(this.biteAnimation);
                this.biteAnimation = null;
                
                // Restaura a posição/rotação original
                if (this.isLocal && this.firstPersonRod && this.initialRodRotation) {
                    this.firstPersonRod.rotation.x = this.initialRodRotation.x;
                    this.firstPersonRod.rotation.y = this.initialRodRotation.y;
                    this.firstPersonRod.rotation.z = this.initialRodRotation.z;
                }
            }
        }
    }
} 