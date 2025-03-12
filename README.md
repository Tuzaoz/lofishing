# LoFishing 🎣

Um jogo multiplayer competitivo de pesca em 3D usando Three.js e Socket.IO.

## Descrição

LoFishing é um jogo onde os jogadores podem se reunir em um ambiente 3D para competir em desafios de pesca. Capture diferentes tipos de peixes, desde os comuns até os lendários, e vença seus amigos com a maior pontuação!

## Funcionalidades

- Ambiente 3D imersivo com água realista
- Sistema de pesca com diferentes tipos de peixes
- Multiplayer em tempo real
- Sistema de pontuação e ranking
- Interface de usuário intuitiva

## Tipos de Peixes

O jogo conta com diferentes tipos de peixes, cada um com raridade, pontuação e dificuldade específicas:

- **Comuns**: Lambari, Tilápia
- **Incomuns**: Tucunaré, Traíra
- **Raros**: Dourado, Pirarucu
- **Lendários**: Jaú Gigante

## Como Jogar

1. Digite seu nome e entre no jogo
2. Use as teclas WASD para movimentar seu personagem
3. Posicione-se próximo à água
4. Pressione ESPAÇO para lançar a linha de pesca
5. Aguarde até que um peixe seja fisgado
6. Pressione ESPAÇO novamente para puxar a linha

## Requisitos

- Node.js 14+
- NPM 6+
- Navegador moderno com suporte a WebGL

## Instalação

1. Clone o repositório
   ```
   git clone https://github.com/seu-usuario/lofishing.git
   cd lofishing
   ```

2. Instale as dependências
   ```
   npm install
   ```

3. Inicie o servidor de desenvolvimento
   ```
   npm run dev
   ```

4. Acesse o jogo em `http://localhost:3000`

## Construção para Produção

Para gerar uma versão de produção:

```
npm run build
npm start
```

O servidor estará disponível em `http://localhost:3001`.

## Tecnologias Utilizadas

- Three.js - Renderização 3D
- Socket.IO - Comunicação em tempo real
- Express - Servidor web
- Vite - Bundler e servidor de desenvolvimento

## Créditos

Desenvolvido como um projeto para demonstrar as capacidades do Three.js e Socket.IO para jogos multiplayer em tempo real.

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes. 