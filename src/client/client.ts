import { MESSAGE_TYPES, Message, AdminMessage, ADMIN_COMMANDS, ReconnectMessage, ChangeNameMessage } from "../shared/types.js";
import { move, initLocalGameState as initLocalGameState, clearLocalGameState, updateChat, syncTime, updateRules, sendRules, localGameState } from "./gameLogic.js";
import { showLobby, handleRejection, requestJoinGame, updateGameList, playerNameEntry } from './lobbyScreen.js'
import { showGame, updatePassword } from './gameScreen.js'
let ws: WebSocket;
let reconnectAttempts = 0;
let reconnectMax = 10;
export let myGameId = 0;
export let myClientId = 0;
export let fromHistory = false;
let debugClient = false;
(window as any).debugClient = debugClient

function connectWebSocket(): void {
    // Extract game ID from URL, if available
    const gameId = parseInt(window.location.pathname.slice(1)); // Remove leading '/'

    const wsUrl = window.location.hostname === 'localhost' ? 'wss://localhost:10000' : 'wss://sliderchess.onrender.com';
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        (window as any).ws = ws;
        if (reconnectAttempts) {
            console.log('Successfully reconnected to the WebSocket server!');
            if (localGameState) console.log('Trying to reconnect to my game');
            reconnectAttempts = 0;
            sendMessage({ type: MESSAGE_TYPES.RECONNECT, clientId: myClientId, clientName: playerNameEntry.value, gameState: localGameState } satisfies ReconnectMessage);
        } else {
            console.log('Connected to WebSocket server');
            sendMessage({ type: MESSAGE_TYPES.CHANGE_NAME, name: '' } satisfies ChangeNameMessage);  // sync my name with the server
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
                if (message.clientId) myClientId = message.clientId;
                break;
            case MESSAGE_TYPES.GAME_LIST:
                updateGameList(message.gameList);
                break;
            case MESSAGE_TYPES.GAME_STATE:
                initLocalGameState(message.gameState, message.yourColor);
                break;
            case MESSAGE_TYPES.JOIN_GAME:
                showGame(message.gameId, message.password);
                myGameId = gameId;
                fromHistory = false;
                break;
            case MESSAGE_TYPES.REJECT_JOIN_GAME:
                handleRejection(message.gameId);
                break;
            case MESSAGE_TYPES.QUIT_GAME:
                clearLocalGameState();
                showLobby();
                myGameId = 0;
                fromHistory = false;
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
        if (!reconnectAttempts) {
            updateChat('Disconnected from server. Attempting to reconnect...');
            console.log('Disconnected from server');
        }
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

// Connect when page loads
window.addEventListener('DOMContentLoaded', () => {connectWebSocket();});

// handle back/forward
window.addEventListener("popstate", (event) => {
    const gameId = parseInt(window.location.pathname.slice(1)); // Remove leading '/'
    fromHistory = true;
    if (isNaN(gameId)) {
        sendMessage({ type: MESSAGE_TYPES.QUIT_GAME } satisfies Message);
    } else {
        requestJoinGame(gameId);
    }
});