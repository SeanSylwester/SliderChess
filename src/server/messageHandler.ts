import { Game } from './gameLogic.js';
import { updateGameList as updateGameList, sendGameList as sendGameList, serveGameRoom, serveLobby, sendMessage, ClientInfo, handleAdminCommand, pushGameList, handleReconnect } from './server.js';
import { ChangeNameMessage, MESSAGE_TYPES, RejectJoinGameMessage, PieceColor, GameState } from '../shared/types.js';

export function handleMessage(data: Buffer, client: ClientInfo, games: Map<number, Game>): void {
    const message = JSON.parse(data.toString());

    // lookup the game that the client is in for most message types
    let game: Game | undefined;
    if ([MESSAGE_TYPES.CHANGE_POSITION, MESSAGE_TYPES.MOVE_PIECE, MESSAGE_TYPES.REWIND, MESSAGE_TYPES.DRAW, 
         MESSAGE_TYPES.SURRENDER, MESSAGE_TYPES.CHAT, MESSAGE_TYPES.RULES, MESSAGE_TYPES.GAME_OVER,
         MESSAGE_TYPES.GAME_PASSWORD].includes(message.type)) {
        if (!client.gameId) {
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
            handleCreateGame(client, games, message.initialTime, message.increment, message.password);
            break;

        case MESSAGE_TYPES.JOIN_GAME:
            handleJoinGame(client, games, message.gameId, message.password, );
            break;

        case MESSAGE_TYPES.CHANGE_POSITION:
            game!.changePosition(client, message.position);
            updateGameList();
            break;

        case MESSAGE_TYPES.QUIT_GAME:
            handleQuitGame(client, games);
            break;

        case MESSAGE_TYPES.MOVE_PIECE:
            game!.move(client, message.fromRow, message.fromCol, message.toRow, message.toCol, message.isTile, message.promotions); 
            break;

        case MESSAGE_TYPES.REWIND:
            game!.rewind();
            break;

        case MESSAGE_TYPES.DRAW:
            game!.draw(client);
            break;

        case MESSAGE_TYPES.SURRENDER:
            game!.surrender(client);
            break;

        case MESSAGE_TYPES.CHANGE_NAME:
            handleChangeName(client, message.name);
            break;

        case MESSAGE_TYPES.CHAT:
            game!.logChatMessage(message.message, client);
            break;

        case MESSAGE_TYPES.RULES:
            game!.updateRules(client, message.rules);
            break;

        case MESSAGE_TYPES.GAME_OVER:
            game!.checkGameOver();
            break;

        case MESSAGE_TYPES.GAME_LIST:
            updateGameList();
            sendGameList(client);
            break;
        
        case MESSAGE_TYPES.ADMIN_MESSAGE:
            handleAdminCommand(client, message.command, message.data);
            break;
        
        case MESSAGE_TYPES.GAME_PASSWORD:
            game!.setPassword(message.password, client);
            pushGameList();
            break;

        case MESSAGE_TYPES.RECONNECT:
            handleReconnect(client, message.clientId, message.clientName, message.gameState);
            break;

        default:
            console.error(`Unknown message type ${message.type}`);
            console.error(message);
    }
}

let gameIdCounter = 1;
function handleCreateGame(client: ClientInfo, games: Map<number, Game>, initialTime: number, increment: number, password: string): void {
    console.log(`Creating game ${gameIdCounter} for client ${client.id}`);
    const newGame = new Game(gameIdCounter++, initialTime, increment, password);
    games.set(newGame.id, newGame);

    handleJoinGame(client, games, newGame.id, password); // note: this will updateGameList() when the client is assigned to a position
    pushGameList();
}

export function handleCreateGameFromState(client: ClientInfo, games: Map<number, Game>, gameId: number, gameState: GameState): void {
    if (!gameId) {
        // client maliciously creating a game with ID 0 would break a lot of stuff... 
        gameId = gameIdCounter++;
        console.log(` assigning new game ID ${gameId}`);
    } 

    let game: Game;
    if (games.has(gameId)) {
        console.log(` game ${gameId} already existing, connecting client to game instead of loading from state`)
        game = games.get(gameId)!;
    } else {
        console.log(` and recreating from client state`);
        game = new Game(gameId, 10, 10, '');
        game.loadFromState(gameState)
        games.set(game.id, game);
        gameIdCounter = Math.max(gameIdCounter, gameId + 1);  // put the counter above this one so that we don't clobber this later
    }

    handleJoinGame(client, games, gameId, gameState.password); // note: this will updateGameList() when the client is assigned to a position

    // try to assign color based on name match
    if (gameState.playerWhiteName === client.name) game.changePosition(client, PieceColor.WHITE);
    else if (gameState.playerBlackName === client.name) game.changePosition(client, PieceColor.BLACK);
    pushGameList();
}

export function handleJoinGame(client: ClientInfo, games: Map<number, Game>, gameId: number, password: string): void {
    if (client.gameId) {
        console.error(`Client ${client.id} is already in a game (${client.gameId}), cannot join another.`);
        return;
    }

    const game = games.get(gameId);
    if (game) {
        // allow join to admins, unlocked games, or locked games if the provided password matches
        if (client.isAdmin || !game.password || (password && password === game.password)) {
            game.addPlayer(client);
            client.gameId = gameId;
            updateGameList();
            serveGameRoom(client, game.password);
        } else {
            sendMessage(client, { type: MESSAGE_TYPES.REJECT_JOIN_GAME, gameId: gameId } satisfies RejectJoinGameMessage);
        }
    } else {
        console.error(`Game with ID ${gameId} not found for client ${client.id}. Sending them to the lobby.`);
        serveLobby(client);
    }
}

export function handleQuitGame(client: ClientInfo, games: Map<number, Game>): void {
    if (!client.gameId) {
        console.error(`Client ${client.id} is not in a game, cannot quit. Sending them to the lobby`);
        serveLobby(client);
        return;
    }

    const game = games.get(client.gameId);
    if (game) {
        game.removePlayer(client);
        client.gameId = 0;
        client.gamePosition = PieceColor.NONE;
        updateGameList();
        serveLobby(client);
    } else {
        console.error(`Game with ID ${client.gameId} not found for client ${client.id}`);
    }
}

function handleChangeName(client: ClientInfo, name: string): void {
    const oldName = client.name;
    if (name.startsWith('admin|')) {
        // try to login as admin, with the password after the pipe
        if (name.substring(6) === process.env.ADMIN_SECRET) {
            client.isAdmin = true;
            client.name = 'admin';
            console.log('Someone logged in as admin')
            sendMessage(client, { type: MESSAGE_TYPES.CHANGE_NAME, name: client.name } satisfies ChangeNameMessage)
        } else {
            console.error('Someone tried and failed to login as admin');
            sendMessage(client, { type: MESSAGE_TYPES.CHANGE_NAME, name: 'naughty boy' } satisfies ChangeNameMessage)
        }
        console.log(client.ip);
    } else if (name === '') {
        // new connection asking for their name and clientId
        sendMessage(client, { type: MESSAGE_TYPES.CHANGE_NAME, name: client.name, clientId: client.id } satisfies ChangeNameMessage);
    } else if (name !== 'admin') {
        // normal name change request
        client.name = name;
        console.log(`Client ${client.id} changed name from ${oldName} to ${client.name}`);
        updateGameList();
        sendMessage(client, { type: MESSAGE_TYPES.CHANGE_NAME, name: client.name } satisfies ChangeNameMessage);
    }
}