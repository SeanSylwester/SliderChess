import 'dotenv/config';
import express from 'express';
import path from 'path';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { Game } from './gameLogic.js';
import { handleMessage, handleQuitGame, handleCreateGameFromState, handleJoinGame, handleChangeName } from './messageHandler.js';
import { MESSAGE_TYPES, gameListMessage, JoinGameMessage, Message, ADMIN_COMMANDS, GameInfo, LogMessage, PieceColor, GameState, GlobalChatMessage } from '../shared/types.js';
import * as db from './db.js';
import { QueryArrayResult } from 'pg';
import { gameInfoFromGameState } from '../shared/utils.js';

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
let server;
if (process.env.LOCAL) {
    // created with mkcert
    const options = {
        key: fs.readFileSync('./localhost-key.pem'), // Replace with your key file path
        cert: fs.readFileSync('./localhost.pem')  // Replace with your cert file path
    };
    server = https.createServer(options, app);
} else {
    server = http.createServer(app);
}

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store connected clients
const clients = new Map<WebSocket, ClientInfo>();
let clientIdCounter = 1;

// Store list of games
let games = new Map<number, Game>();
export let gameList: GameInfo[] = [];

export async function getGame(gameId: number): Promise<Game | undefined> {
    let game: Game | undefined;
    
    // first, check our games map in ram
    game = games.get(gameId);
    if (game) return game;

    // if it's not loaded, try to load it from the DB
    game = await db.gameFromDB(gameId);
    if (game) {
        games.set(gameId, game);
        return game;
    }

    return;
}

export function sendMessage<T extends Message>(client: ClientInfo, message: T): void {
    if (client && client.ws && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
    } else {
        console.error(`WebSocket is not connected, cannot send ${message.type} message to ${client.id} (${client.name})`);
    }
}

export function updateGameInList(game: Game): void {
    const gameListIdx = gameList.findIndex(el => el.gameId === game.id);
    if (gameListIdx !== -1) {
        gameList.splice(gameListIdx, 1);
        gameList.push(game.getGameInfo());
    }
}

export function sendGameList(client: ClientInfo): void {
    sendMessage(client, { type: MESSAGE_TYPES.GAME_LIST,  gameList: gameList, nClients: clients.size } satisfies gameListMessage)
}

export function pushGameList(): void {
    clients.forEach((client) => {
        if (!client.gameId) {
            // only push to clients that aren't in a game
            sendGameList(client);
        }
    });
}

export function sendGlobalChat(message: string): void {
    clients.forEach((client) => {
        if (!client.gameId) {
            // only push to clients that aren't in a game
            sendMessage(client, { type: MESSAGE_TYPES.GLOBAL_CHAT, message: message } satisfies GlobalChatMessage);
        }
    });
}

// functions to force a client to change screens to a game room (by JOIN_GAME), or the lobby (by QUIT_GAME)
export function serveGameRoom(client: ClientInfo, password: string): void {
    if (clients.has(client.ws)) {
        if (!client.gameId) {
            console.error(`Client ${client.id} is missing gameId, cannot assign to room`);
            return;
        }
        sendGameList(client);
        sendMessage(client, { type: MESSAGE_TYPES.JOIN_GAME, gameId: client.gameId, password: password } satisfies JoinGameMessage);
    }
}

export function serveLobby(client: ClientInfo): void {
    if (clients.has(client.ws)) {
        sendGameList(client);
        sendMessage(client, { type: MESSAGE_TYPES.QUIT_GAME } satisfies Message);
    }
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
    if ([ADMIN_COMMANDS.GAME_GET_IDS, ADMIN_COMMANDS.GAME_KICK_PLAYER, 
        ADMIN_COMMANDS.GAME_DEMOTE_PLAYER, ADMIN_COMMANDS.GAME_UNLOCK_RULES].includes(command)) {
        game = games.get(data.gameId);  // not grabbing game from DB here. Just join the game first to handle the save/load properly elsewhere
        if (game === undefined) {
            console.error(`Game with ID ${data.gameId} not found`);
            return;
        }
    }
    switch (command) {
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
        
        case ADMIN_COMMANDS.GAME_UNLOCK_RULES:
            game!.rulesLocked = false;
            game!.logChatMessage('admin has unlocked the rules.');
            game!.sendRulesAgreement();
            break;
        
        case ADMIN_COMMANDS.REFRESH_DB:
            getGamesListFromDB();
            break;
        
        case ADMIN_COMMANDS.FORCE_SAVE_ALL:
            for (const [gameId, game] of games) {
                db.saveToDB(game);
            }
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
    sendMessage(clientInfo, { type: MESSAGE_TYPES.GLOBAL_CHAT, message: 'Welcome to SliderChess!' } satisfies GlobalChatMessage);

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
        if (clientInfo.gameId && !shuttingDown) handleQuitGame(clientInfo, games);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error from ${clientId}:`, error);
    });
});

export async function handleReconnect(client: ClientInfo, clientOldId: number, clientOldName: string, gameState: GameState | undefined): Promise<void> {
    // wait until we've heard from the DB to do any reconnections
    if (!loadedFromDB) {
        setTimeout(() => handleReconnect(client, clientOldId, clientOldName, gameState), 1000);
        return;
    }

    // try to reconnect client to old id and name
    console.log(`Reconnecting client ${client.id} (was ${clientOldId}) to their old name (${clientOldName})`);
    handleChangeName(client, clientOldName);
    
    if (!gameState || !gameState.id) return;

    // if the client says that they're in a game, then try to reconnect them
    //   if we don't have the indicated game, then make a new game and load from the client's gameState
    const game = await getGame(gameState.id);
    if (game) {
        console.log(` and also connecting client ${client.id} to game ${gameState.id}, if they have the right password`);
        handleJoinGame(client, games, gameState.id, gameState.password);
    } else {
        // recreate the game with a new id if it wasn't found on the DB at startup
        console.log(` but we couldn't find their game (${gameState.id}), so we're recreating from client state with a new ID`);
        handleCreateGameFromState(client, games, gameState);
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
    console.log(`Server is running at https://localhost:${PORT}`);
    console.log(`WebSocket server is ready for connections`);
});

// get gameInfo[] from DB
export let loadedFromDB = false;
async function getGamesListFromDB() {
    if (process.env.DUMMY) await db.createDummyTable();

    const newGameList = await db.gamesListFromDB();
    loadedFromDB = true;  // set this even if it failed
    if(!newGameList) return;

    gameList = newGameList;
    pushGameList();
    console.log(`Loaded ${newGameList.length} games from DB`);
}
getGamesListFromDB();


// this line from gemini, not sure if needed :
// Begin reading from stdin so the process does not exit immediately
// Note: This is necessary in some cases (like when the event loop is empty)
// to keep the process running so it can receive signals.
process.stdin.resume();

process.on('SIGINT', () => gracefulExit('SIGINT'));
process.on('SIGTERM', () => gracefulExit('SIGTERM'));

let shuttingDown = false;
async function gracefulExit(term: string) {
    console.log(`Caught interrupt signal (${term}). Performing cleanup...`);
    shuttingDown = true;
    try {
        // start closing server, await later
        console.log('Trying to close server');
        const closeServer = new Promise<void>((resolve, reject) => {
            wss.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // tell all the active games currently in memory that they're getting shut down
        for (const [gameId, game] of games) {
            if (game.isActive && !game.isEmpty()) {
                game.logChatMessage('SERVER SHUTTING DOWN! Trying to save game to database...|  Keep this tab open just in case the DB write fails to avoid losing your game');
            }
        }

        // disconnect all existing connections
        console.log('Trying to disconnect clients');
        wss.clients.forEach((client) => {
            client.close();
        });
        console.log('  All clients disconnected');

        // actually close the server now
        await closeServer;
        console.log('  HTTP server closed');

        // save all active games currently in memory
        console.log('Trying to save games');
        const promises: Promise<QueryArrayResult | undefined>[] = [];
        for (const [gameId, game] of games) {
            if (game.isActive) {
                promises.push(db.saveToDB(game));
            }
        }
        await Promise.all(promises);
        console.log('  All games saved')
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
    console.log('Calling process exit');
    process.exit(0);
}