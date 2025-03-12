const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Importa os modelos
const Game = require('./models/Game');

// Inicializa o aplicativo Express
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Configurações
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// Cria um novo jogo
const game = new Game();

// Configuração do Socket.IO
io.on('connection', (socket) => {
    console.log(`Novo cliente conectado: ${socket.id}`);
    
    // Jogador inicia uma sessão
    socket.on('playerJoin', (data) => {
        const player = game.addPlayer(socket.id, data.name);
        console.log(`Jogador ${data.name} (${socket.id}) entrou no jogo`);
        
        // Informa ao jogador que ele entrou com sucesso
        socket.emit('playerJoined', {
            id: socket.id,
            position: player.position
        });
        
        // Informa a todos os jogadores sobre o novo jogador
        io.emit('playerUpdate', {
            id: socket.id,
            name: data.name,
            position: player.position,
            score: player.score
        });
        
        // Envia a lista de jogadores existentes para o novo jogador
        game.getPlayers().forEach(p => {
            if (p.id !== socket.id) {
                socket.emit('playerUpdate', {
                    id: p.id,
                    name: p.name,
                    position: p.position,
                    score: p.score
                });
            }
        });
    });
    
    // Recebe atualizações do jogador
    socket.on('playerUpdate', (data) => {
        const player = game.getPlayer(socket.id);
        if (player) {
            // Atualiza a posição e ação do jogador
            player.position = data.position;
            player.action = data.action;
            
            // Transmite a todos os jogadores
            io.emit('playerUpdate', {
                id: socket.id,
                name: player.name,
                position: player.position,
                score: player.score,
                action: player.action
            });
        }
    });
    
    // Jogador começa a pescar
    socket.on('startFishing', (data) => {
        const player = game.getPlayer(socket.id);
        if (player) {
            player.isFishing = true;
            player.fishingPosition = data.position;
            
            // Inicia o processo de pesca
            game.startFishing(socket.id);
            
            console.log(`Jogador ${player.name} começou a pescar`);
        }
    });
    
    // Jogador para de pescar
    socket.on('stopFishing', () => {
        const player = game.getPlayer(socket.id);
        if (player) {
            player.isFishing = false;
            
            // Para o processo de pesca
            game.stopFishing(socket.id);
            
            console.log(`Jogador ${player.name} parou de pescar`);
        }
    });
    
    // Jogador pegou um peixe
    socket.on('fishCaught', (data) => {
        const player = game.getPlayer(socket.id);
        if (player) {
            // Adiciona o peixe ao inventário do jogador
            player.addFish(data.fish);
            
            // Atualiza a pontuação
            player.updateScore();
            
            // Notifica todos os jogadores
            io.emit('fishCaught', {
                playerId: socket.id,
                fish: data.fish,
                score: player.score
            });
            
            console.log(`Jogador ${player.name} pegou um ${data.fish.name}`);
        }
    });
    
    // Desconexão do jogador
    socket.on('disconnect', () => {
        const player = game.getPlayer(socket.id);
        if (player) {
            console.log(`Jogador ${player.name} (${socket.id}) saiu do jogo`);
            
            // Remove o jogador do jogo
            game.removePlayer(socket.id);
            
            // Notifica todos os jogadores
            io.emit('playerLeft', { id: socket.id });
        } else {
            console.log(`Cliente desconectado: ${socket.id}`);
        }
    });
});

// Rota principal
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Inicia o servidor
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
}); 