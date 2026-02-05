import { MESSAGE_TYPES,  Message, ChatMessage, ChangePositionMessage, PieceColor, GamePasswordMessage, GameResultCause } from "../shared/types.js";
import { flipBoard } from "./gameLogic.js";
import { sendMessage, fromHistory, myGameId } from "./client.js";
import { getGame, gameList } from "./lobbyScreen.js"


const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
export function showGame(gameId: number, password: string): void {
    lobbyScreen!.style.display = 'none';
    gameScreen!.style.display = 'block';
    if (!fromHistory) window.history.pushState({}, '', window.location.origin + `/${gameId}`);

    updatePassword(password);
    const game = getGame(gameId);
    if (game) {
        game.password = password;
    } else {
        // set some defaults and store the password, then let updateGameList() fix it
        console.log('adding default game list entry')
        gameList.push({
            hasPassword: password !== '', 
            password: password, 
            gameId: gameId,
            playerWhite: '?',
            playerBlack: '?',
            numberOfSpectators: 0,
            timeLeftWhite: 0,
            timeLeftBlack: 0,
            creationTime: 0,
            result: GameResultCause.ONGOING,
            isActive: true,
            useTimeControl: false,
            currentTurn: PieceColor.WHITE
        });
        sendMessage({ type: MESSAGE_TYPES.GAME_LIST } satisfies Message);
    }
}


// chat
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


// password
const updatePasswordButton = document.getElementById('updateGamePassword') as HTMLButtonElement;
const passwordEntry = document.getElementById('gamePassword') as HTMLInputElement;
updatePasswordButton!.addEventListener('click', () => {
    sendMessage({ type: MESSAGE_TYPES.GAME_PASSWORD,  password: passwordEntry.value } satisfies GamePasswordMessage);
});
passwordEntry!.addEventListener('keypress', function (event) {
    if (event.key === "Enter") {
        updatePasswordButton?.click();
    }
});
export function updatePassword(password: string): void {
    passwordEntry!.value = password;
    const game = getGame(myGameId);
    if (game) game.password = password
}


// game buttons
const claimWhiteButton = document.getElementById('claimWhite');
claimWhiteButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, position: PieceColor.WHITE } satisfies ChangePositionMessage));
const claimBlackButton = document.getElementById('claimBlack');
claimBlackButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, position: PieceColor.BLACK } satisfies ChangePositionMessage));
const claimSpectatorButton = document.getElementById('claimSpectator');
claimSpectatorButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, position: PieceColor.NONE } satisfies ChangePositionMessage));

const quitGameButton = document.getElementById('quitGame');
quitGameButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.QUIT_GAME } satisfies Message));

const flipBoardButton = document.getElementById('flipBoard');
flipBoardButton!.addEventListener('click', flipBoard);

const rewindButton = document.getElementById('rewind');
rewindButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.REWIND } satisfies Message));

const pauseButton = document.getElementById('pause');
pauseButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.PAUSE } satisfies Message));

const drawButton = document.getElementById('draw');
drawButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.DRAW } satisfies Message));

const surrenderButton = document.getElementById('surrender');
surrenderButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.SURRENDER } satisfies Message));
