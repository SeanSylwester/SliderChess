import { MESSAGE_TYPES, SCREENS, GameInfo, Message, JoinGameMessage, ChatMessage, ChangePositionMessage, PieceColor, ChangeNameMessage, AdminMessage, ADMIN_COMMANDS, GamePasswordMessage } from "../shared/types.js";
import { flipBoard, move, initLocalGameState as initLocalGameState, clearLocalGameState, updateChat, syncTime, updateRules, sendRules } from "./gameLogic.js";
import { formatMinSec } from '../shared/utils.js'
let ws: WebSocket;
let fromHistory = false;

function connectWebSocket(): void {
    // Extract game ID from URL, if available
    const gameId = parseInt(window.location.pathname.slice(1)); // Remove leading '/'

    const wsUrl = window.location.hostname === 'localhost' ? 'ws://localhost:10000' : 'wss://sliderchess.onrender.com';
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        if (!isNaN(gameId)) {
            fromHistory = true;
            requestJoinGameById(gameId);
        }
    };

    ws.onmessage = (event: MessageEvent) => {
        const message = JSON.parse(event.data);

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
        console.log('Disconnected from server');
    };
}

export function sendMessage<T extends Message>(message: T): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
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


const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
function showGame(gameId: number, password: string): void {
    lobbyScreen!.style.display = 'none';
    gameScreen!.style.display = 'block';
    updatePassword(password);
    if (!fromHistory) window.history.pushState({}, '', window.location.origin + `/${gameId}`);
    fromHistory = false;
}
function showLobby(): void {
    lobbyScreen!.style.display = 'block';
    gameScreen!.style.display = 'none';
    if (!fromHistory) window.history.pushState({}, '', window.location.origin);
    fromHistory = false;
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

function requestJoinGame(game: GameInfo): void {
    let password = '';
    if (game.hasPassword) {
        const input = prompt('Input the password for the game room', '');
        if (input) password = input;
    }
    sendMessage({ type: MESSAGE_TYPES.JOIN_GAME, gameId: game.gameId, password: password } satisfies JoinGameMessage)
}
let waitingForGameList = 0;  // holds gameId while we wait for a new game list
function requestJoinGameById(gameId: number): void {
    waitingForGameList = gameId;
    ws.send(JSON.stringify({ type: MESSAGE_TYPES.JOIN_GAME, gameId: gameId, password: '' } satisfies JoinGameMessage));
}

function updateGameList(gameList: GameInfo[]): void {
    const gameListElement = document.getElementById('gameList');
    if (gameListElement) {
        gameListElement.innerHTML = ''; // Clear existing list
        gameList.forEach(game => {
            const gameItem = document.createElement('li');
            gameItem.value = game.gameId;

            const gameButton = document.createElement('button');
            gameButton.textContent = "Join";
            gameButton.addEventListener('click', () => requestJoinGame(game));
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
        });
    }
    if (waitingForGameList) {
        const game = gameList.find(el => el.gameId === waitingForGameList);
        waitingForGameList = 0;
        if (game) {
            requestJoinGame(game);
        }
    }
}
const refreshGameListButton = document.getElementById('refreshGameList');
refreshGameListButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.GAME_LIST }));

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
}

const quitGameButton = document.getElementById('quitGame');
quitGameButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.QUIT_GAME }));

const flipBoardButton = document.getElementById('flipBoard');
flipBoardButton!.addEventListener('click', flipBoard);

const rewindButton = document.getElementById('rewind');
rewindButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.REWIND }));

const drawButton = document.getElementById('draw');
drawButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.DRAW }));

const surrenderButton = document.getElementById('surrender');
surrenderButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.SURRENDER }));

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
        requestJoinGameById(gameId);
    }
});