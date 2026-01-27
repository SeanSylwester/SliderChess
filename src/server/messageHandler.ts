import WebSocket from 'ws';
import { ClientInfo } from './types.js';
import { Game } from './gameLogic.js';
import { pushGameList, updateGameList, sendGameList, serveGameRoom, serveLobby } from './server.js';
import { MESSAGE_TYPES, PieceColor, Piece } from '../shared/types.js';

export function handleMessage(
    data: Buffer,
    client: ClientInfo,
    games: Map<number, Game>,
    clients: Map<WebSocket, ClientInfo>
): void {
    const message = JSON.parse(data.toString());

    switch (message.type) {
        case MESSAGE_TYPES.CREATE_GAME:
            handleCreateGame(client, games);
            break;
        case MESSAGE_TYPES.JOIN_GAME:
            handleJoinGame(client, message.gameId, games);
            break;
        case MESSAGE_TYPES.CHANGE_POSITION:
            handleChangePosition(client, message.position, games);
            break;
        case MESSAGE_TYPES.QUIT_GAME:
            handleQuitGame(client, games);
            break;
        case MESSAGE_TYPES.MOVE_PIECE:
            handleMovePiece(client, message.fromRow, message.fromCol, message.toRow, message.toCol, message.isTile, message.promotions, games);
            break;
        case MESSAGE_TYPES.REWIND:
            handleRewind(client, games);
            break;
        case MESSAGE_TYPES.DRAW:
            handleDraw(client, games);
            break;
        case MESSAGE_TYPES.CHANGE_NAME:
            handleChangeName(client, message.name);
            break;
        case MESSAGE_TYPES.CHAT:
            console.log(`Chat message from client ${client.id}: ${message.message}`);
            handleChat(client, message.message, games);
            break;
        case MESSAGE_TYPES.GAME_LIST:
            console.log(`Request for the game list from client ${client.id}`);
            updateGameList();
            sendGameList(client);
            break;
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
        console.log(`Client ${client.id} is already in a game (${client.gameId}), cannot join another.`);
        return;
    }

    console.log(`Assigning client ${client.id} to game ${gameId}`);
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

export function handleChangePosition(client: ClientInfo, position: PieceColor, games: Map<number, Game>) {
    if (client.gameId === undefined) {
        console.log(`Client ${client.id} is not in a game, cannot change positions.`);
        return;
    }
    const game = games.get(client.gameId);
    if (!game) {
        console.error(`Game with ID ${client.gameId} not found for client ${client.id}`);
        return;
    }

    game.changePosition(client, position);
    updateGameList();
}

export function handleQuitGame(client: ClientInfo, games: Map<number, Game>): void {
    if (client.gameId === undefined) {
        console.log(`Client ${client.id} is not in a game, cannot quit.`);
        return;
    }

    const game = games.get(client.gameId);
    if (game) {
        game.removePlayer(client);
        if (game.isEmpty()) {
            //games.delete(client.gameId);
            console.log(`Removed empty game ${game.id}`);
        }
        client.gameId = undefined;
        updateGameList();
        serveLobby(client);
    } else {
        console.error(`Game with ID ${client.gameId} not found for client ${client.id}`);
    }
}

function handleMovePiece(c: ClientInfo, fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[], games: Map<number, Game>): void {
    if (c.gameId === undefined) {
        console.log(`Client ${c.id} is not in a game, cannot move piece.`);
        return;
    }
    const game = games.get(c.gameId);
    if (game) {
        game.movePiece(c, fromRow, fromCol, toRow, toCol, isTile, promotions);  // check logic in here
    } else {
        console.error(`Game with ID ${c.gameId} not found for client ${c.id}`);
    }
}

function handleRewind(c: ClientInfo, games: Map<number, Game>): void {
    if (c.gameId === undefined) {
        console.log(`Client ${c.id} is not in a game, cannot rewind.`);
        return;
    }
    const game = games.get(c.gameId);
    if (game) {
        game.rewind();
    } else {
        console.error(`Game with ID ${c.gameId} not found for client ${c.id}`);
    }
}

function handleDraw(c: ClientInfo, games: Map<number, Game>): void {
    if (c.gameId === undefined) {
        console.log(`Client ${c.id} is not in a game, cannot offer draw.`);
        return;
    }
    const game = games.get(c.gameId);
    if (game) {
        game.draw(c);
    } else {
        console.error(`Game with ID ${c.gameId} not found for client ${c.id}`);
    }
}

function handleChangeName(c: ClientInfo, newName: string): void {
    const oldName = c.name;
    c.name = newName;
    console.log(`Client ${c.id} changed name from ${oldName} to ${c.name}`);

    updateGameList();
}

function handleChat(c: ClientInfo, message: string, games: Map<number, Game>): void {
    if (c.gameId === undefined) {
        console.log(`Client ${c.id} is not in a game, cannot send chat message.`);
        return;
    }
    const game = games.get(c.gameId);
    if (game) {
        game.logChatMessage(message, c);
    } else {
        console.error(`Game with ID ${c.gameId} not found for client ${c.id}`);
    }
}