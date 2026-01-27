import { MESSAGE_TYPES, SCREENS, GameInfo, Message, JoinGameMessage, ChatMessage, ChangePositionMessage, PieceColor } from "../shared/types.js";
import { flipBoard, movePiece, initLocalGameState as initLocalGameState, clearLocalGameState, updateChat } from "./gameLogic.js";
let ws: WebSocket;
let fromHistory = false;

function connectWebSocket(): void {
    // Extract game ID from URL, if available
    const gameId = parseInt(window.location.pathname.slice(1)); // Remove leading '/'

    ws = new WebSocket('ws://localhost:3000');

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        if (!isNaN(gameId)) {
            fromHistory = true;
            ws.send(JSON.stringify({ type: MESSAGE_TYPES.JOIN_GAME, data: { gameId: gameId } } as JoinGameMessage));
        }
    };

    ws.onmessage = (event: MessageEvent) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
            case MESSAGE_TYPES.CHANGE_NAME:
                console.log('Received name list:', message.data);
                playerNameEntry.value = message.data.name;
                break;
            case MESSAGE_TYPES.GAME_LIST:
                console.log('Received game list:', message.data);
                updateGameList(message.data.gameList);
                break;
            case MESSAGE_TYPES.GAME_STATE:
                console.log('Received game state:', message.data);
                initLocalGameState(message.data.gameState, message.data.yourColor);
                break;
            case MESSAGE_TYPES.JOIN_GAME:
                console.log('Joining game room:', message.data.gameId);
                showScreen(SCREENS.GAME_ROOM, message.data.gameId);
                break;
            case MESSAGE_TYPES.QUIT_GAME:
                console.log('Quitting game room');
                clearLocalGameState();
                showScreen(SCREENS.LOBBY);
                break;
            case MESSAGE_TYPES.MOVE_PIECE:
                console.log('Moving piece:', message.data);
                movePiece(message.data.fromRow, message.data.fromCol, message.data.toRow, message.data.toCol, message.data.notation);
                break;
            case MESSAGE_TYPES.CHAT:
                console.log('Received chat message:', message.data.message);
                updateChat(message.data.message);
                break;
            default:
                const responseElement = document.getElementById('response');
                if (responseElement) {
                    responseElement.textContent = message.data || JSON.stringify(message);
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

export function sendMessage(message: Message): void {
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
    sendMessage({ type: MESSAGE_TYPES.CHANGE_NAME, data: { name: nameInput.value } } as Message);
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
                sendMessage({ type: MESSAGE_TYPES.JOIN_GAME, data: { gameId: game.gameId } } as JoinGameMessage);
            });
            gameItem.appendChild(gameButton);

            const gameText = document.createElement('span');
            let wmin = Math.floor(game.timeLeftWhite / 60);
            let bmin = Math.floor(game.timeLeftBlack / 60);
            let wsec = (game.timeLeftWhite % 60).toString().padStart(2, '0');
            let bsec = (game.timeLeftBlack % 60).toString().padStart(2, '0');
            gameText.textContent = `${game.playerWhite || 'None'} (${wmin}:${wsec}) vs ${game.playerBlack || 'None'}  (${bmin}:${bsec}). ${game.numberOfSpectators} spectators`;
            gameItem.appendChild(gameText);

            gameListElement.appendChild(gameItem);
        });
    }
}
const refreshGameListButton = document.getElementById('refreshGameList');
refreshGameListButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.GAME_LIST } as Message));

export function sendChat(message: string) {
    sendMessage({ type: MESSAGE_TYPES.CHAT, data: { message: message } } as ChatMessage);
}

const createGame = document.getElementById('createGame');
createGame!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CREATE_GAME } as Message));


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
quitGameButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.QUIT_GAME } as Message));

const flipBoardButton = document.getElementById('flipBoard');
flipBoardButton!.addEventListener('click', flipBoard);

const rewindButton = document.getElementById('rewind');
rewindButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.REWIND } as Message));

const drawButton = document.getElementById('draw');
drawButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.DRAW } as Message));

const claimWhiteButton = document.getElementById('claimWhite');
claimWhiteButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, data: { position: PieceColor.WHITE } } as ChangePositionMessage));
const claimBlackButton = document.getElementById('claimBlack');
claimBlackButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, data: { position: PieceColor.BLACK } } as ChangePositionMessage));
const claimSpectatorButton = document.getElementById('claimSpectator');
claimSpectatorButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, data: { position: PieceColor.NONE } } as ChangePositionMessage));


// Connect when page loads
window.addEventListener('DOMContentLoaded', connectWebSocket);

// handle back/forward
window.addEventListener("popstate", (event) => {
    const gameId = parseInt(window.location.pathname.slice(1)); // Remove leading '/'
    fromHistory = true;
    if (isNaN(gameId)) {
        sendMessage({ type: MESSAGE_TYPES.QUIT_GAME } as Message);
    } else {
        sendMessage({ type: MESSAGE_TYPES.JOIN_GAME, data: { gameId: gameId } } as JoinGameMessage);
    }
});