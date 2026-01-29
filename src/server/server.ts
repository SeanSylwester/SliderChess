import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { Game } from './gameLogic.js';
import { ClientInfo } from './types.js';
import { handleMessage, handleQuitGame } from './messageHandler.js';
import { MESSAGE_TYPES, GameListMessage, JoinGameMessage, ChangeNameMessage, Message } from '../shared/types.js';
const app = express();
const PORT = process.env.PORT || 10000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store connected clients
const clients = new Map<WebSocket, ClientInfo>();
let clientIdCounter = 1;

// Store list of games
const games = new Map<number, Game>();
let gameList = Array.from(games.values()).map((game) => ({
    gameId: game.id, playerWhite: game.playerWhite?.name || null,
    playerBlack: game.playerBlack?.name || null, numberOfSpectators: game.spectators.length,
    timeLeftWhite: game.timeLeftWhite, timeLeftBlack: game.timeLeftBlack
}));

export function sendMessage<T extends Message>(client: ClientInfo, message: T): void {
    if (client && client.ws && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
    } else {
        console.error('WebSocket is not connected');
    }
}

export function updateGameList() {
    // TODO: probably don't need to recreate the whole array each time...
    gameList = Array.from(games.values()).map((game) => ({
        gameId: game.id, playerWhite: game.playerWhite?.name || null,
        playerBlack: game.playerBlack?.name || null, numberOfSpectators: game.spectators.length,
        timeLeftWhite: game.timeLeftWhite, timeLeftBlack: game.timeLeftBlack
    }));
}

export function sendGameList(client: ClientInfo,): void {
    client.ws.send(JSON.stringify({ type: MESSAGE_TYPES.GAME_LIST,  gameList: gameList } satisfies GameListMessage));
}

export function pushGameList(): void {
    updateGameList();
    clients.forEach((client) => {
        if (!client.gameId) {
            // only push to clients that aren't in a game
            sendGameList(client);
        }
    });
}

// functions to force a client to change screens to a game room (by JOIN_GAME), or the lobby (by QUIT_GAME)
export function serveGameRoom(client: ClientInfo): void {
    if (!client.gameId) {
        console.error(`Client ${client.id} is missing gameId, cannot assign to room`);
        return;
    }
    client.ws.send(JSON.stringify({ type: MESSAGE_TYPES.JOIN_GAME, gameId: client.gameId } satisfies JoinGameMessage));
}

export function serveLobby(client: ClientInfo): void {
    sendGameList(client);
    client.ws.send(JSON.stringify({ type: MESSAGE_TYPES.QUIT_GAME }));
}

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket) => {
    const clientId = clientIdCounter++;
    const clientInfo: ClientInfo = { id: clientId, name: `Player ${clientId}`, ws: ws };
    clients.set(ws, clientInfo);
    console.log(`Client connected: ${clientId}`);

    // Send welcome message to new client
    ws.send(JSON.stringify({ type: MESSAGE_TYPES.CHANGE_NAME, name: clientInfo.name } satisfies ChangeNameMessage));

    // send current game list
    sendGameList(clientInfo);

    // Handle messages from client
    ws.on('message', (data: Buffer) => {
        const client = clients.get(ws);
        if (client) {
            handleMessage(data, client, games);
        } else {
            console.error(`Client info not found for WebSocket: ${clientId}`);
        }
    });

    // Handle client disconnect
    ws.on('close', () => {
        clients.delete(ws);
        console.log(`Client disconnected: ${clientId}`);
        handleQuitGame(clientInfo, games);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error from ${clientId}:`, error);
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')));
app.use(express.static(path.join(__dirname, '../../dist')));

// join game in progress using a URL
app.get('/:gameId', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public', 'index.html'));
});

// Start server
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`WebSocket server is ready for connections`);
});
