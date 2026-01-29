import WebSocket from 'ws';
import { ClientInfo } from './types.js';
import { Game } from './gameLogic.js';
import { updateGameList, sendGameList, serveGameRoom, serveLobby } from './server.js';
import { MESSAGE_TYPES } from '../shared/types.js';

export function handleMessage(data: Buffer, client: ClientInfo, games: Map<number, Game>): void {
    const message = JSON.parse(data.toString());

    // lookup the game that the client is in for most message types
    let game: Game | undefined;
    if ([MESSAGE_TYPES.CHANGE_POSITION, MESSAGE_TYPES.QUIT_GAME, MESSAGE_TYPES.MOVE_PIECE, 
                MESSAGE_TYPES.REWIND, MESSAGE_TYPES.DRAW, MESSAGE_TYPES.CHAT, 
                MESSAGE_TYPES.RULES, MESSAGE_TYPES.GAME_OVER].includes(message.type)) {
        if (client.gameId === undefined) {
            console.error(`Client ${client.id} is not in a game.`);
            return;
        }
        game = games.get(client.gameId);
        if (game === undefined) {
            console.error(`Game with ID ${client.gameId} not found for client ${client.id}`);
            return;
        }
    }

    switch (message.type) {
        case MESSAGE_TYPES.CREATE_GAME:
            handleCreateGame(client, games);
            break;

        case MESSAGE_TYPES.JOIN_GAME:
            handleJoinGame(client, message.gameId, games);
            break;

        case MESSAGE_TYPES.CHANGE_POSITION:
            game!.changePosition(client, message.position);
            updateGameList();
            break;

        case MESSAGE_TYPES.QUIT_GAME:
            handleQuitGame(client, games);
            break;

        case MESSAGE_TYPES.MOVE_PIECE:
            game!.move(client,  message.fromRow, message.fromCol, message.toRow, message.toCol, message.isTile, message.promotions); 
            break;

        case MESSAGE_TYPES.REWIND:
            game!.rewind();
            break;

        case MESSAGE_TYPES.DRAW:
            game!.draw(client);
            break;

        case MESSAGE_TYPES.CHANGE_NAME:
            const oldName = client.name;
            client.name = message.name;
            console.log(`Client ${client.id} changed name from ${oldName} to ${client.name}`);
            updateGameList();
            break;

        case MESSAGE_TYPES.CHAT:
            game!.logChatMessage(message.message, client);
            break;

        case MESSAGE_TYPES.RULES:
            game!.updateRules(client, message.rules);
            break;

        case MESSAGE_TYPES.GAME_OVER:
            game!.gameOver();
            break;

        case MESSAGE_TYPES.GAME_LIST:
            updateGameList();
            sendGameList(client);
            break;
        
        default:
            console.error(`Unknown message type ${message.type}`);
            console.error(message);
    }
}

let gameIdCounter = 1;
function handleCreateGame(client: ClientInfo, games: Map<number, Game>): void {
    console.log(`Creating game for client ${client.id}`);
    const newGame = new Game(gameIdCounter++);
    games.set(newGame.id, newGame);
    updateGameList();
    handleJoinGame(client, newGame.id, games); // note: this will updateGameList() again when the client is assigned to a position
}

function handleJoinGame(client: ClientInfo, gameId: number, games: Map<number, Game>): void {
    if (client.gameId !== undefined) {
        console.error(`Client ${client.id} is already in a game (${client.gameId}), cannot join another.`);
        return;
    }

    const game = games.get(gameId);
    if (game) {
        game.addPlayer(client);
        client.gameId = gameId;
        updateGameList();
        serveGameRoom(client);
    } else {
        console.error(`Game with ID ${gameId} not found for client ${client.id}. Sending them to the lobby.`);
        serveLobby(client);
    }
}

export function handleQuitGame(client: ClientInfo, games: Map<number, Game>): void {
    if (client.gameId === undefined) {
        console.error(`Client ${client.id} is not in a game, cannot quit.`);
        return;
    }

    const game = games.get(client.gameId);
    if (game) {
        game.removePlayer(client);
        if (game.isEmpty()) {
            games.delete(client.gameId);
            console.log(`Removed empty game ${game.id}`);
        }
        client.gameId = undefined;
        updateGameList();
        serveLobby(client);
    } else {
        console.error(`Game with ID ${client.gameId} not found for client ${client.id}`);
    }
}
