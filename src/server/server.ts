import 'dotenv/config';
import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { Game } from './gameLogic.js';
import { handleMessage, handleQuitGame, handleCreateGameFromState } from './messageHandler.js';
import { MESSAGE_TYPES, gameListMessage, JoinGameMessage, Message, ADMIN_COMMANDS, GameInfo, LogMessage, PieceColor, GameState } from '../shared/types.js';

const app = express();
const PORT = process.env.PORT || 10000;

export interface ClientInfo {
    id: number;
    name: string;
    ws: WebSocket;
    isAdmin: boolean;
    ip: string | undefined;
    req: http.IncomingMessage;
    gameId: number;
    gamePosition: PieceColor;
}

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store connected clients
const clients = new Map<WebSocket, ClientInfo>();
const clientLastKnownPosition = new Map<number, { name: string, gameId: number, position: PieceColor }>();
let clientIdCounter = 1;

// Store list of games
const games = new Map<number, Game>();
let gameList: GameInfo[] = [];

export function sendMessage<T extends Message>(client: ClientInfo, message: T): void {
    if (client && client.ws && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
    } else {
        console.error('WebSocket is not connected');
    }
}

export function updateGameList() {
    // TODO: probably don't need to recreate the whole array each time...
    gameList = [];
    for (const game of games.values()) {
        gameList.push({
            hasPassword: game.password !== '',
            gameId: game.id, 
            playerWhite: game.playerWhite?.name || null,
            playerBlack: game.playerBlack?.name || null, 
            numberOfSpectators: game.spectators.length,
            timeLeftWhite: game.timeLeftWhite, 
            timeLeftBlack: game.timeLeftBlack
        });
    }
}

export function sendGameList(client: ClientInfo): void {
    sendMessage(client, { type: MESSAGE_TYPES.GAME_LIST,  gameList: gameList } satisfies gameListMessage)
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
export function serveGameRoom(client: ClientInfo, password: string): void {
    if (!client.gameId) {
        console.error(`Client ${client.id} is missing gameId, cannot assign to room`);
        return;
    }
    sendMessage(client, { type: MESSAGE_TYPES.JOIN_GAME, gameId: client.gameId, password: password } satisfies JoinGameMessage);
}

export function serveLobby(client: ClientInfo): void {
    sendGameList(client);
    sendMessage(client, { type: MESSAGE_TYPES.QUIT_GAME } satisfies Message)
}

function sendLog(client: ClientInfo, data: any): void {
    sendMessage(client, { type: MESSAGE_TYPES.LOG_MESSAGE, log: data } satisfies LogMessage);
}

export function handleAdminCommand(admin: ClientInfo, command: ADMIN_COMMANDS, data: any): void {
    if (!admin.isAdmin) {
        console.error('Someone tried and failed to send an admin command');
        console.log(admin.ip);
        return;
    }
    console.log(`Executing admin command ${ADMIN_COMMANDS[command]} with data:`);
    console.log(data);

    // lookup the game that the client is in for most message types
    let game: Game | undefined;
    if ([ADMIN_COMMANDS.GAME_DELETE, ADMIN_COMMANDS.GAME_GET_IDS, ADMIN_COMMANDS.GAME_KICK_PLAYER, ADMIN_COMMANDS.GAME_DEMOTE_PLAYER].includes(command)) {
        game = games.get(data.gameId);
        if (game === undefined) {
            console.error(`Game with ID ${data.gameId} not found`);
            return;
        }
    }
    switch (command) {
        case ADMIN_COMMANDS.GAME_DELETE:
            game!.logChatMessage('Server is killing this game. You can stay here but the connection will be broken');
            for (const client of game!.allClients()) {
                client.gameId = 0;
            }
            games.delete(data.gameId);
            pushGameList();
            break;

        case ADMIN_COMMANDS.GAME_GET_IDS:
            sendLog(admin, game!.allClients());
            break;
        
        case ADMIN_COMMANDS.GAME_KICK_PLAYER:
            const kickedPlayer = game!.allClients().find(el => el.id === data.clientId);
            if (kickedPlayer) {
                game!.logChatMessage(`Server is kicking ${kickedPlayer.name}`);
                handleQuitGame(kickedPlayer, games);
                sendLog(admin, `Kicked ${kickedPlayer.name} (${kickedPlayer.id}) from game ${game!.id}`);
            } else {
                sendLog(admin, `Couldn't find ${data.clientId} in game ${game!.id}`);
            }
            break;
        
        case ADMIN_COMMANDS.GAME_DEMOTE_PLAYER:
            const demotedPlayer = data.color === PieceColor.WHITE ? game!.playerWhite : game!.playerBlack;
            if (demotedPlayer) game!.changePosition(demotedPlayer, PieceColor.NONE);
            break;

        default:
            sendLog(admin, `Command ${ADMIN_COMMANDS[command]} (${command}) not found, or handler not implemented`);
    }
}

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const clientId = clientIdCounter++;
    const clientInfo: ClientInfo = { id: clientId, name: `Player ${clientId}`, ws: ws, isAdmin: false, ip: req.socket.remoteAddress, req: req, gameId: 0, gamePosition: PieceColor.NONE };
    clients.set(ws, clientInfo);
    console.log(`Client connected: ${clientId}`);

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
        clientLastKnownPosition.set(clientInfo.id, { name: clientInfo.name, gameId: clientInfo.gameId, position: clientInfo.gamePosition })
        clients.delete(ws);
        console.log(`Client disconnected: ${clientId}`);
        handleQuitGame(clientInfo, games);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error from ${clientId}:`, error);
    });
});

export function handleReconnect(client: ClientInfo, clientOldId: number, clientOldName: string, gameState: GameState): void {
    // if the client says that they're in a game, then try to reconnect them based on lastPosition
    //   if we don't have the lastPosition and/or the indicated game (e.g. on server restart), then load from the client's gameState
    const lastPosition = clientLastKnownPosition.get(clientOldId);
    if (lastPosition) {
        // we were aware of the client disconnecting and have data ready to reconnect them
        console.log(`Reconnecting new client ${client.id} to stored client ${clientOldId} (${lastPosition.name})`);
        clientLastKnownPosition.delete(clientOldId);
        client.id = clientOldId;
        clientIdCounter = Math.max(clientIdCounter, clientOldId+1);
        client.name = lastPosition.name
        
        const game = games.get(lastPosition.gameId);
        if (game) {
            console.log(` and also trying to connect client ${client.id} to game ${lastPosition.gameId} as ${PieceColor[lastPosition.position]}`);
            client.gameId = lastPosition.gameId;
            game.addPlayer(client, lastPosition.position);
        } else if (gameState) {
            // recreate the game with the same gameId if the game is lost for some reason
            handleCreateGameFromState(client, games, lastPosition.gameId, gameState);
        } else {
            console.log(` but couldn't reconnect client to their game (${lastPosition.gameId}) nor recreate it from a client-provided state`);
        }
    } else {
        // server doesn't know anything! fill in with the provided info, if possible
        console.log(`Reconnecting new unknown client ${client.id} to ${clientOldId} (${clientOldName})`);
        if (!clientOldId || [...clients.values()].some(el => el.id === clientOldId)) {
            // id 0 or in use, generate a new one
            client.id = clientIdCounter++;
        } else {
            client.id = clientOldId;
            clientIdCounter = Math.max(clientIdCounter, clientOldId+1);
        }
        client.name = clientOldName;
        
        // recreate the game if they were in one. Make sure we don't clobber it later!
        if (gameState) {
            handleCreateGameFromState(client, games, gameState.id, gameState);
        }
    }
}

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
