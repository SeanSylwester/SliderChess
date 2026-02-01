import { MESSAGE_TYPES, GameInfo, Message, JoinGameMessage,  ChangeNameMessage, CreateGameMessage } from "../shared/types.js";
import { formatMinSec } from '../shared/utils.js'
import { sendMessage, fromHistory } from './client.js'


const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
export function showLobby(): void {
    lobbyScreen!.style.display = 'block';
    gameScreen!.style.display = 'none';
    if (!fromHistory) window.history.pushState({}, '', window.location.origin);
}

// functions to handle joining a game (from the list or directly from an ID that we know somehow)
export function requestJoinGame(gameId: number): void {
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
export function handleRejection(gameId: number): void {
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


// player name
export const playerNameEntry = document.getElementById('playerName') as HTMLInputElement;
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


// game list
// gamesInfo is replaced each call to updateGameList after transferring over any locally stored data
export let gameList: GameInfo[] = [];
export function getGame(gameId: number): GameInfo | undefined {
    return gameList.find(el => el.gameId === gameId);
}
const gameListElement = document.getElementById('gameList')!;
export function updateGameList(newGameList: GameInfo[]): void {
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
    gameList = newGameList
}


// refresh button
const refreshGameListButton = document.getElementById('refreshGameList');
refreshGameListButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.GAME_LIST } satisfies Message));

// create game
const createGameDialog = document.getElementById('createGameDialog') as HTMLDialogElement;
const createGameButton = document.getElementById('createGame');
createGameButton!.addEventListener('click', () => createGameDialog.showModal());

const createTimeInput = document.getElementById('createTimeInput') as HTMLInputElement;
const createIncrementInput = document.getElementById('createIncrementInput') as HTMLInputElement;
const createPasswordInput = document.getElementById('createPasswordInput') as HTMLInputElement;

const createConfirmButton = document.getElementById('createConfirmButton');
createConfirmButton!.addEventListener('click', (event) => {
    event.preventDefault();
    sendMessage({ type: MESSAGE_TYPES.CREATE_GAME, 
                  initialTime: 60*parseFloat(createTimeInput.value),
                  increment: parseFloat(createIncrementInput.value),
                  password: createPasswordInput.value } satisfies CreateGameMessage);
    createGameDialog.close();
});
