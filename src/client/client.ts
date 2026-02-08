import { MESSAGE_TYPES, Message, AdminMessage, ADMIN_COMMANDS, ReconnectMessage, ChangeNameMessage, PopupMessage, RulesMessage } from "../shared/types.js";
import { move, localGameState, initLocalGameState, clearLocalGameState, updateChat } from "./gameLogic.js";
import { showLobby, handleRejection, requestJoinGame, updateGameList, playerNameEntry } from './lobbyScreen.js'
import { showGame, updatePassword, updateRules, sendRules, updateRulesAgreement } from './gameScreen.js'
import { syncTime } from "./timer.js";
let ws: WebSocket;
let reconnectAttempts = 0;
let reconnectMax = 10;
export let myGameId = 0;
export let myClientId = 0;
export let fromHistory = false;

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
        switch (message.type) {
            case MESSAGE_TYPES.CHANGE_NAME:
                playerNameEntry.value = message.name;
                if (message.clientId) myClientId = message.clientId;
                break;
            case MESSAGE_TYPES.GAME_LIST:
                updateGameList(message.gameList, message.nClients);
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
            case MESSAGE_TYPES.RULES_AGREEMENT:
                updateRulesAgreement(message.rulesAgreement, message.rulesLocked);
                break;
            case MESSAGE_TYPES.LOG_MESSAGE:
                console.log(message.log);
                break;
            case MESSAGE_TYPES.GAME_PASSWORD:
                updatePassword(message.password);
                break
            case MESSAGE_TYPES.POPUP:
                handlePopup(message);
                break;
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

const popup = document.getElementById('popup') as HTMLDialogElement;
popup.addEventListener('cancel', (event) => sendMessage({ type: MESSAGE_TYPES.POPUP, text: '', button: 'Cancel' }));
const popupP = document.getElementById('popupP') as HTMLParagraphElement;
const popupButtonsDiv = document.getElementById('popupButtonsDiv') as HTMLDivElement;
function handlePopup(message: PopupMessage): void {
    popupP!.textContent = message.text;
    popupButtonsDiv.innerHTML = '';
    for (const button of message.button) {
        const b = document.createElement('button');
        b.style.margin = '2px';
        b.textContent = button;
        b.addEventListener('click', (event) => {
            event.preventDefault();
            sendMessage({ type: MESSAGE_TYPES.POPUP, text: message.text, button: button })
            popup.close();
        });
        popupButtonsDiv.appendChild(b);
    }
    popup.showModal();
}

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