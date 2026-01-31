import { MESSAGE_TYPES, GameInfo, Message, JoinGameMessage, ChatMessage, ChangePositionMessage, PieceColor, ChangeNameMessage, AdminMessage, ADMIN_COMMANDS, GamePasswordMessage } from "../shared/types.js";
import { flipBoard, move, initLocalGameState as initLocalGameState, clearLocalGameState, updateChat, syncTime, updateRules, sendRules } from "./gameLogic.js";
import { formatMinSec } from '../shared/utils.js'
let ws: WebSocket;
let reconnectAttempts = 0;
let reconnectMax = 10;
let fromHistory = false;
let debugClient = false;
(window as any).debugClient = debugClient

function connectWebSocket(): void {
    // Extract game ID from URL, if available
    const gameId = parseInt(window.location.pathname.slice(1)); // Remove leading '/'

    const wsUrl = window.location.hostname === 'localhost' ? 'ws://localhost:10000' : 'wss://sliderchess.onrender.com';
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        (window as any).ws = ws;
        if (reconnectAttempts) {
            console.log('Successfully reconnected to the WebSocket server!');
            reconnectAttempts = 0;
            // TODO: try to reconnect to a game if we were in one
        } else {
            console.log('Connected to WebSocket server');
            if (!isNaN(gameId)) {
                fromHistory = true;
                requestJoinGame(gameId);
            }
        }
    };

    ws.onmessage = (event: MessageEvent) => {
        const message = JSON.parse(event.data);
        if (debugClient) console.log('Received: ', message);
        switch (message.type) {
            case MESSAGE_TYPES.CHANGE_NAME:
                playerNameEntry.value = message.name;
                break;
            case MESSAGE_TYPES.GAME_LIST:
                updateGameList(message.gameList);
                break;
            case MESSAGE_TYPES.GAME_STATE:
                initLocalGameState(message.gameState, message.yourColor);
                break;
            case MESSAGE_TYPES.JOIN_GAME:
                showGame(message.gameId, message.password);
                sendRules();
                break;
            case MESSAGE_TYPES.REJECT_JOIN_GAME:
                handleRejection(message.gameId);
                break;
            case MESSAGE_TYPES.QUIT_GAME:
                clearLocalGameState();
                showLobby();
                break;
            case MESSAGE_TYPES.MOVE_PIECE:
                move(message.fromRow, message.fromCol, message.toRow, message.toCol, message.notation, message.isTile, message.promotions);
                break;
            case MESSAGE_TYPES.CHAT:
                updateChat(message.message);
                break;
            case MESSAGE_TYPES.TIME:
                syncTime(message.clockRunning, message.timeLeftWhite, message.timeLeftBlack, message.initialTimeWhite, message.initialTimeBlack, message.incrementWhite, message.incrementBlack);
                break;
            case MESSAGE_TYPES.RULES:
                updateRules(message.rules);
                break;
            case MESSAGE_TYPES.LOG_MESSAGE:
                console.log(message.log);
                break;
            case MESSAGE_TYPES.GAME_PASSWORD:
                updatePassword(message.password);
                break
            default:
                console.error(`Unknown message type ${message.type}`);
                console.error(message);
        }

    };

    ws.onerror = (error: Event) => {
        console.log('WebSocket error:', error);
    };

    ws.onclose = () => {
        updateChat('Disconnected from server');
        console.log('Disconnected from server');
        tryReconnect();
    };
}

// adapted from render.com/docs/websocket
function tryReconnect(): void {
    if (reconnectAttempts++ > reconnectMax) {
        updateChat('Max reconnection attempts reached :(');
        console.log('Max reconnection attempts reached');
        return;
    };

    // Exponential backoff: 1s, 2s, 4s, 8s, etc. (max 60 seconds)
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 60000)

    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`)
    setTimeout(connectWebSocket, delay) // Reattempts connection after specified delay
}

export function sendMessage<T extends Message>(message: T): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
        if (debugClient) console.log('Sending: ', message);
        ws.send(JSON.stringify(message));
    } else {
        console.error('WebSocket is not connected');
    }
}

export function admin(command: ADMIN_COMMANDS, data={}): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: MESSAGE_TYPES.ADMIN_MESSAGE, command: command, data: data } satisfies AdminMessage));
    } else {
        console.error('WebSocket is not connected');
    }
}
(window as any).admin = admin;
(window as any).AC = ADMIN_COMMANDS;

let myGameId = -1;
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
function showGame(gameId: number, password: string): void {
    lobbyScreen!.style.display = 'none';
    gameScreen!.style.display = 'block';
    if (!fromHistory) window.history.pushState({}, '', window.location.origin + `/${gameId}`);
    fromHistory = false;

    myGameId = gameId;

    updatePassword(password);
    const game = getGame(gameId);
    if (game) {
        game.password = password;
    } else {
        // set some defaults and store the password, then let updateGameList() fix it
        gameList.push({
            hasPassword: password !== '', 
            password: password, 
            gameId: gameId,
            playerWhite: '?',
            playerBlack: '?',
            numberOfSpectators: 0,
            timeLeftWhite: 0,
            timeLeftBlack: 0
        });
        sendMessage({ type: MESSAGE_TYPES.GAME_LIST } satisfies Message);
    }

}
function showLobby(): void {
    lobbyScreen!.style.display = 'block';
    gameScreen!.style.display = 'none';
    if (!fromHistory) window.history.pushState({}, '', window.location.origin);
    fromHistory = false;

    myGameId = -1;
}


// lobby screen
const playerNameEntry = document.getElementById('playerName') as HTMLInputElement;
function updateName(): void {
    sendMessage({ type: MESSAGE_TYPES.CHANGE_NAME, name: playerNameEntry.value } satisfies ChangeNameMessage);
    playerNameEntry.value = '';
}
const updateNameButton = document.getElementById('updateName');
updateNameButton!.addEventListener('click', updateName);
playerNameEntry!.addEventListener('keypress', function (event) {
    if (event.key === "Enter") {
        updateNameButton?.click();
    }
});

function requestJoinGame(gameId: number): void {
    // see if the game is in our map
    const game = getGame(gameId);
    let password = '';

    // if there's a game in our map, and we know it has a password, then send our stored password or prompt for one if needed
    // the server will either join the game, at which point we'll store the the prompted password
    //   or it'll send a reject message. If we get that, then clear the stored password and recall this function to try again
    if (game && game.hasPassword) {
        if (game.password) {
            password = game.password;
        } else {
            const input = prompt('Input the password for the game room', '');
            if (input) {
                password = input;
            } else {
                // cancelling on the password prompt will break the incorrect-password-retry loop
                return;
            }
        }
    }

    sendMessage({ type: MESSAGE_TYPES.JOIN_GAME, gameId: gameId, password: password } satisfies JoinGameMessage)
}
function handleRejection(gameId: number): void {
    // clear the stored password and try to join again
    const game = getGame(gameId);
    if (!game) {
        console.log(`Ignoring rejection from game we don't even know about...`);
        return
    }

    console.log(`Rejected from game ${gameId}. Trying again...`)
    game.hasPassword = true;
    game.password = '';
    requestJoinGame(gameId);
}

// gamesInfo is replaced each call to updateGameList after transferring over any locally stored data
let gameList: GameInfo[] = [];
function getGame(gameId: number): GameInfo | undefined {
    return gameList.find(el => el.gameId === gameId);
}

const gameListElement = document.getElementById('gameList')!;
function updateGameList(newGameList: GameInfo[]): void {
    gameListElement.innerHTML = ''; // Clear existing list
    for (const game of newGameList){
        // transfer over our stored password to games with matching IDs
        const oldGameInfo = getGame(game.gameId);
        if (oldGameInfo && oldGameInfo.password) game.password = oldGameInfo.password;
        

        const gameItem = document.createElement('li');
        gameItem.value = game.gameId;

        const gameButton = document.createElement('button');
        gameButton.textContent = "Join";
        gameButton.addEventListener('click', () => requestJoinGame(game.gameId));
        gameItem.appendChild(gameButton);

        if (game.hasPassword) {
            const lock = document.createElement('span');
            lock.textContent = ' 🔒';
            gameItem.appendChild(lock);
        }

        const gameText = document.createElement('span');
        gameText.textContent = ` ${game.playerWhite || 'None'} (${formatMinSec(game.timeLeftWhite)}) vs ${game.playerBlack || 'None'}  (${formatMinSec(game.timeLeftBlack)}). ${game.numberOfSpectators} spectators`;
        gameItem.appendChild(gameText);

        gameListElement.appendChild(gameItem);
    }
    gameList = newGameList;
}
const refreshGameListButton = document.getElementById('refreshGameList');
refreshGameListButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.GAME_LIST } satisfies Message));

const createGame = document.getElementById('createGame');
createGame!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CREATE_GAME }));


// game screen
const sendChatButton = document.getElementById('sendChat') as HTMLButtonElement;
const chatEntry = document.getElementById('chatEntry') as HTMLInputElement;
sendChatButton!.addEventListener('click', () => {
    if (chatEntry.value.trim() !== '') {
        sendMessage({ type: MESSAGE_TYPES.CHAT,  message: chatEntry.value } satisfies ChatMessage);
        chatEntry.value = '';
    }
});
chatEntry!.addEventListener('keypress', function (event) {
    if (event.key === "Enter") {
        sendChatButton?.click();
    }
});

const updatePasswordButton = document.getElementById('updateGamePassword') as HTMLButtonElement;
const passwordEntry = document.getElementById('gamePassword') as HTMLInputElement;
updatePasswordButton!.addEventListener('click', () => {
    if (passwordEntry.value.trim() !== '') {
        sendMessage({ type: MESSAGE_TYPES.GAME_PASSWORD,  password: passwordEntry.value } satisfies GamePasswordMessage);
    }
});
passwordEntry!.addEventListener('keypress', function (event) {
    if (event.key === "Enter") {
        updatePasswordButton?.click();
    }
});
function updatePassword(password: string): void {
    passwordEntry!.value = password;
    const game = getGame(myGameId);
    if (game) game.password = password
}

const quitGameButton = document.getElementById('quitGame');
quitGameButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.QUIT_GAME } satisfies Message));

const flipBoardButton = document.getElementById('flipBoard');
flipBoardButton!.addEventListener('click', flipBoard);

const rewindButton = document.getElementById('rewind');
rewindButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.REWIND } satisfies Message));

const drawButton = document.getElementById('draw');
drawButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.DRAW } satisfies Message));

const surrenderButton = document.getElementById('surrender');
surrenderButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.SURRENDER } satisfies Message));

const claimWhiteButton = document.getElementById('claimWhite');
claimWhiteButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, position: PieceColor.WHITE } satisfies ChangePositionMessage));
const claimBlackButton = document.getElementById('claimBlack');
claimBlackButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, position: PieceColor.BLACK } satisfies ChangePositionMessage));
const claimSpectatorButton = document.getElementById('claimSpectator');
claimSpectatorButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, position: PieceColor.NONE } satisfies ChangePositionMessage));


// Connect when page loads
window.addEventListener('DOMContentLoaded', () => {connectWebSocket();});

// handle back/forward
window.addEventListener("popstate", (event) => {
    const gameId = parseInt(window.location.pathname.slice(1)); // Remove leading '/'
    fromHistory = true;
    if (isNaN(gameId)) {
        sendMessage({ type: MESSAGE_TYPES.QUIT_GAME });
    } else {
        requestJoinGame(gameId);
    }
});