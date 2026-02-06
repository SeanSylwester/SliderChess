import { MESSAGE_TYPES, GameInfo, Message, JoinGameMessage,  ChangeNameMessage, CreateGameMessage, GameScore, GameResultCause, PieceColor } from "../shared/types.js";
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
const nClientsSpan = document.getElementById('nClients') as HTMLSpanElement;
const nGamesSpan = document.getElementById('nGames') as HTMLSpanElement;
export let gameList: GameInfo[] = [];
export function getGame(gameId: number): GameInfo | undefined {
    return gameList.find(el => el.gameId === gameId);
}
const gameListElement = document.getElementById('gameList')!;
function formatDateTime(datems: number) {
    const date = new Date(datems);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-based
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}
export function updateGameList(newGameList: GameInfo[], nClients: number): void {
    gameListElement.innerHTML = ''; // Clear existing list
    newGameList.sort((a, b) => b.creationTime - a.creationTime);
    let nActive = 0;
    for (const game of newGameList){
        if (game.isActive) nActive++;
        // transfer over our stored password to games with matching IDs
        const oldGameInfo = getGame(game.gameId);
        if (oldGameInfo && oldGameInfo.password) game.password = oldGameInfo.password;
        

        const gameItem = document.createElement('li');
        gameItem.value = game.gameId;

        const gameButton = document.createElement('button');
        gameButton.textContent = game.isActive ? 'Join' : 'View';
        gameButton.addEventListener('click', () => requestJoinGame(game.gameId));
        gameItem.appendChild(gameButton);

        if (game.hasPassword && game.isActive) {
            const lock = document.createElement('span');
            lock.textContent = ' 🔒';
            gameItem.appendChild(lock);
        }

        const gameText = document.createElement('span');
        function wrapStrong(s: string, wrap: boolean) {
            return wrap ? `<strong>${s}</strong>` : s;
        }
        let nameWhite =  game.playerWhite !== null ? `${game.playerWhite}` : `<em>${game.lastNameWhite ? game.lastNameWhite : 'None'}</em>`;
        let nameBlack =  game.playerBlack !== null ? `${game.playerBlack}` : `<em>${game.lastNameBlack ? game.lastNameBlack : 'None'}</em>`;

        const timeWhite = game.useTimeControl ?  ` (${formatMinSec(game.timeLeftWhite)})` : ''
        const timeBlack = game.useTimeControl ?  ` (${formatMinSec(game.timeLeftBlack)})` : ''
        if (game.isActive) {
            nameWhite = wrapStrong(nameWhite, game.currentTurn === PieceColor.WHITE);
            nameBlack = wrapStrong(nameBlack, game.currentTurn === PieceColor.BLACK);
            gameText.innerHTML = ` [${formatDateTime(game.creationTime)}] ${nameWhite}${timeWhite} vs ${nameBlack}${timeBlack}. ${game.numberOfSpectators} Spectators`;
        } else {
            const score = GameScore.get(game.result)!;
            const result = game.result.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
            nameWhite = wrapStrong(nameWhite, ['1-0', '1/2-1/2'].includes(score));
            nameBlack = wrapStrong(nameBlack, ['0-1', '1/2-1/2'].includes(score));
            gameText.innerHTML = ` [${formatDateTime(game.creationTime)}] ${nameWhite} vs ${nameBlack}: ${score} (${result})`;
        }
        gameItem.appendChild(gameText);

        gameListElement.append(gameItem);
    }
    gameList = newGameList
    nClientsSpan.textContent = `${nClients}`;
    nGamesSpan.textContent = `${nActive}`;
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

const useTimeControl = document.getElementById('useTimeControl') as HTMLInputElement;
useTimeControl!.addEventListener('change', (event) => {
    createTimeInput.disabled = !useTimeControl.checked;
    createIncrementInput.disabled = !useTimeControl.checked;
});

function setTime(id: string) {
    const [timeStr, incStr] = id.slice(4).split('p');
    createTimeInput.value = timeStr;
    createIncrementInput.value = incStr;
}
const timeButtons = document.querySelectorAll('.timeControlButton');
timeButtons!.forEach(button => {
    button.addEventListener('click', (event) => {
        event.preventDefault();
        setTime(button.id);
    });
});

const createConfirmButton = document.getElementById('createConfirmButton');
createConfirmButton!.addEventListener('click', (event) => {
    event.preventDefault();
    sendMessage({ type: MESSAGE_TYPES.CREATE_GAME, 
                  useTimeControl: useTimeControl.checked,
                  initialTime: 60*parseFloat(createTimeInput.value),
                  increment: parseFloat(createIncrementInput.value),
                  password: createPasswordInput.value } satisfies CreateGameMessage);
    createGameDialog.close();
});
const createCancelButton = document.getElementById('createCancelButton');
createCancelButton!.addEventListener('click', (event) => createGameDialog.close());
