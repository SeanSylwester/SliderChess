import { MESSAGE_TYPES, SCREENS, GameInfo, Message, JoinGameMessage, ChatMessage, ChangePositionMessage, PieceColor, ChangeNameMessage } from "../shared/types.js";
import { flipBoard, movePiece, initLocalGameState as initLocalGameState, clearLocalGameState, updateChat, updateTimes } from "./gameLogic.js";
import { formatMinSec } from '../shared/utils.js'
let ws: WebSocket;
let fromHistory = false;

function connectWebSocket(): void {
    // Extract game ID from URL, if available
    const gameId = parseInt(window.location.pathname.slice(1)); // Remove leading '/'

    ws = new WebSocket('wss://sliderchess.onrender.com');
    //ws = new WebSocket('ws://localhost:10000');

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        if (!isNaN(gameId)) {
            fromHistory = true;
            ws.send(JSON.stringify({ type: MESSAGE_TYPES.JOIN_GAME, gameId: gameId } satisfies JoinGameMessage));
        }
    };

    ws.onmessage = (event: MessageEvent) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
            case MESSAGE_TYPES.CHANGE_NAME:
                console.log('Received name list:', message);
                playerNameEntry.value = message.name;
                break;
            case MESSAGE_TYPES.GAME_LIST:
                console.log('Received game list:', message);
                updateGameList(message.gameList);
                break;
            case MESSAGE_TYPES.GAME_STATE:
                console.log('Received game state:', message);
                initLocalGameState(message.gameState, message.yourColor);
                break;
            case MESSAGE_TYPES.JOIN_GAME:
                console.log('Joining game room:', message.gameId);
                showScreen(SCREENS.GAME_ROOM, message.gameId);
                break;
            case MESSAGE_TYPES.QUIT_GAME:
                console.log('Quitting game room');
                clearLocalGameState();
                showScreen(SCREENS.LOBBY);
                break;
            case MESSAGE_TYPES.MOVE_PIECE:
                console.log('Moving piece:', message);
                movePiece(message.fromRow, message.fromCol, message.toRow, message.toCol, message.notation, message.isTile);
                break;
            case MESSAGE_TYPES.CHAT:
                console.log('Received chat message:', message.message);
                updateChat(message.message);
                break;
            case MESSAGE_TYPES.TIME:
                console.log('Received time message:', message.message);
                updateTimes(message.timeLeftWhite, message.timeLeftBlack, message.initialTimeWhite, message.initialTimeBlack, message.incrementWhite, message.incrementBlack);
                break;
            default:
                const responseElement = document.getElementById('response');
                if (responseElement) {
                    responseElement.textContent = message || JSON.stringify(message);
                }
            // handle other message types as needed
        }

    };

    ws.onerror = (error: Event) => {
        console.error('WebSocket error:', error);
        const responseElement = document.getElementById('response');
        if (responseElement) {
            responseElement.textContent = 'Error: Connection failed';
        }
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
        const responseElement = document.getElementById('response');
        if (responseElement) {
            responseElement.textContent = 'Disconnected from server';
        }
    };
}

export function sendMessage<T extends Message>(message: T): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        console.error('WebSocket is not connected');
    }
}

function showScreen(screenId: typeof SCREENS[keyof typeof SCREENS], gameId?: number): void {
    console.log('showScreen called');
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('game-screen');
    const url = new URL(window.location.href);
    console.log(`before: ${window.history.length}`);
    switch (screenId) {
        case SCREENS.LOBBY:
            lobbyScreen!.style.display = 'block';
            gameScreen!.style.display = 'none';
            if (!fromHistory) window.history.pushState({}, '', window.location.origin);
            break;
        case SCREENS.GAME_ROOM:
            lobbyScreen!.style.display = 'none';
            gameScreen!.style.display = 'block';
            if (!fromHistory) window.history.pushState({}, '', window.location.origin + `/${gameId}`);
            break;
    }
    console.log(`after: ${window.history.length}`);
    fromHistory = false;
}


// lobby screen
function updateName(): void {
    const nameInput = document.getElementById('playerName') as HTMLInputElement;
    sendMessage({ type: MESSAGE_TYPES.CHANGE_NAME, name: nameInput.value } satisfies ChangeNameMessage);
}
const updateNameButton = document.getElementById('updateName');
const playerNameEntry = document.getElementById('playerName') as HTMLInputElement;
updateNameButton!.addEventListener('click', updateName);
playerNameEntry!.addEventListener('keypress', function (event) {
    if (event.key === "Enter") {
        updateNameButton?.click();
    }
});

function updateGameList(gameList: GameInfo[]): void {
    const gameListElement = document.getElementById('gameList');
    if (gameListElement) {
        gameListElement.innerHTML = ''; // Clear existing list
        gameList.forEach(game => {
            const gameItem = document.createElement('li');
            gameItem.value = game.gameId;

            const gameButton = document.createElement('button');
            gameButton.textContent = "Join";
            gameButton.addEventListener('click', () => {
                sendMessage({ type: MESSAGE_TYPES.JOIN_GAME, gameId: game.gameId } satisfies JoinGameMessage);
            });
            gameItem.appendChild(gameButton);

            const gameText = document.createElement('span');
            gameText.textContent = `${game.playerWhite || 'None'} (${formatMinSec(game.timeLeftWhite)}) vs ${game.playerBlack || 'None'}  (${formatMinSec(game.timeLeftBlack)}). ${game.numberOfSpectators} spectators`;
            gameItem.appendChild(gameText);

            gameListElement.appendChild(gameItem);
        });
    }
}
const refreshGameListButton = document.getElementById('refreshGameList');
refreshGameListButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.GAME_LIST }));

export function sendChat(message: string) {
    sendMessage({ type: MESSAGE_TYPES.CHAT,  message: message } satisfies ChatMessage);
}

const createGame = document.getElementById('createGame');
createGame!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CREATE_GAME }));


// game screen
const sendChatButton = document.getElementById('sendChat');
const chatEntry = document.getElementById('chatEntry') as HTMLInputElement;
sendChatButton!.addEventListener('click', () => {
    if (chatEntry.value.trim() !== '') {
        sendChat(chatEntry.value);
        chatEntry.value = '';
    }
});
chatEntry!.addEventListener('keypress', function (event) {
    if (event.key === "Enter") {
        sendChatButton?.click();
    }
});

const quitGameButton = document.getElementById('quitGame');
quitGameButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.QUIT_GAME }));

const flipBoardButton = document.getElementById('flipBoard');
flipBoardButton!.addEventListener('click', flipBoard);

const rewindButton = document.getElementById('rewind');
rewindButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.REWIND }));

const drawButton = document.getElementById('draw');
drawButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.DRAW }));

const claimWhiteButton = document.getElementById('claimWhite');
claimWhiteButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, position: PieceColor.WHITE } satisfies ChangePositionMessage));
const claimBlackButton = document.getElementById('claimBlack');
claimBlackButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, position: PieceColor.BLACK } satisfies ChangePositionMessage));
const claimSpectatorButton = document.getElementById('claimSpectator');
claimSpectatorButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, position: PieceColor.NONE } satisfies ChangePositionMessage));


// Connect when page loads
window.addEventListener('DOMContentLoaded', connectWebSocket);

// handle back/forward
window.addEventListener("popstate", (event) => {
    const gameId = parseInt(window.location.pathname.slice(1)); // Remove leading '/'
    fromHistory = true;
    if (isNaN(gameId)) {
        sendMessage({ type: MESSAGE_TYPES.QUIT_GAME });
    } else {
        sendMessage({ type: MESSAGE_TYPES.JOIN_GAME, gameId: gameId } satisfies JoinGameMessage);
    }
});