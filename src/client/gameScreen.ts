import { MESSAGE_TYPES,  Message, ChatMessage, ChangePositionMessage, PieceColor, GamePasswordMessage, GameResultCause, Rules, RulesMessage, GlobalChatMessage } from "../shared/types.js";
import { handleButton, localGameState, myColor, setRules } from "./gameLogic.js";
import { sendMessage, fromHistory, myGameId } from "./client.js";
import { getGame, gameList } from "./lobbyScreen.js"
import { flipBoard, updateBoardDimensions } from "./drawBoard.js";


const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
gameScreen!.style.display = 'none';
export function showGame(gameId: number, password: string): void {
    lobbyScreen!.style.display = 'none';
    gameScreen!.style.display = '';
    if (!fromHistory) window.history.pushState({}, '', window.location.origin + `/${gameId}`);
    chatLog.scrollTop = chatLog.scrollHeight;

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
            lastNameWhite: '?',
            lastNameBlack: '?',
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
    updateBoardDimensions();
    hideRulesAgreement();
}




// chat
let showGlobal = false;
const chatLog = document.getElementById('chatLog') as HTMLTextAreaElement;
const chatDiv = document.getElementById('chatDiv') as HTMLDivElement;
const chatContainer = document.getElementById('chatContainer') as HTMLDivElement;
function setChatHeight(): void {
    chatContainer.style.height = `${chatDiv.offsetHeight}px`;
}
const resizeObserver = new ResizeObserver(setChatHeight);
resizeObserver.observe(chatLog);
setChatHeight();

export function updateChat(message: string): void {
    if (!localGameState) {
        return;
    }
    localGameState.chatLog.push(message);
    chatLog.value += "\n" + message;
    chatLog.scrollTop = chatLog.scrollHeight;
}

const sendChatButton = document.getElementById('sendChat') as HTMLButtonElement;
const chatEntry = document.getElementById('chatEntry') as HTMLInputElement;
sendChatButton!.addEventListener('click', () => {
    if (chatEntry.value.trim() !== '') {
        if (showGlobal) sendMessage({ type: MESSAGE_TYPES.GLOBAL_CHAT,  message: chatEntry.value } satisfies GlobalChatMessage);
        else sendMessage({ type: MESSAGE_TYPES.CHAT,  message: chatEntry.value } satisfies ChatMessage);
        chatEntry.value = '';
    }
});
chatEntry!.addEventListener('keypress', function (event) {
    if (event.key === "Enter") {
        sendChatButton?.click();
    }
});

const showGlobalButton = document.getElementById('showGlobalChat') as HTMLButtonElement;
const globalChatLog = document.getElementById('globalChatLog')! as HTMLTextAreaElement;
const gameChatName = document.getElementById('gameChatName') as HTMLSpanElement;
const globalChatDiv = document.getElementById('globalChatDiv') as HTMLDivElement;
const chatEntryContainer = document.getElementById('chatEntryContainer') as HTMLDivElement;
const globalChatEntryContainer = document.getElementById('globalChatEntryContainer') as HTMLDivElement;
showGlobalButton!.addEventListener('click', () => {
    showGlobal = !showGlobal;
    gameChatName.textContent = showGlobal ? 'Global' : 'Game'
    showGlobalButton.textContent = showGlobal ? 'Show Game' : 'Show Global'
    moveGlobalChat(showGlobal);
});
export function moveGlobalChat(toGameScreen: boolean): void {
    if (toGameScreen) {
        chatLog.hidden = true;
        chatDiv.insertBefore(globalChatLog, chatEntryContainer);
    } else {
        chatLog.hidden = false;
        globalChatDiv.insertBefore(globalChatLog, globalChatEntryContainer);
    }
}




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
const claimWhiteButton = document.getElementById('claimWhite') as HTMLButtonElement;
claimWhiteButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, position: PieceColor.WHITE } satisfies ChangePositionMessage));
const claimBlackButton = document.getElementById('claimBlack') as HTMLButtonElement;
claimBlackButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, position: PieceColor.BLACK } satisfies ChangePositionMessage));
const claimSpectatorButton = document.getElementById('claimSpectator') as HTMLButtonElement;
claimSpectatorButton!.addEventListener('click', () => sendMessage({ type: MESSAGE_TYPES.CHANGE_POSITION, position: PieceColor.NONE } satisfies ChangePositionMessage));

const quitGameButton = document.getElementById('quitGame') as HTMLButtonElement;
quitGameButton!.addEventListener('click', () => handleButton(MESSAGE_TYPES.QUIT_GAME));

const flipBoardButton = document.getElementById('flipBoard') as HTMLButtonElement;
flipBoardButton!.addEventListener('click', flipBoard);

const rewindButton = document.getElementById('rewind') as HTMLButtonElement;
rewindButton!.addEventListener('click', () => handleButton(MESSAGE_TYPES.REWIND));

const unlockRulesButton = document.getElementById('unlockRules') as HTMLButtonElement;
unlockRulesButton!.addEventListener('click', () => handleButton(MESSAGE_TYPES.UNLOCK_RULES));

const pauseButton = document.getElementById('pause') as HTMLButtonElement;
pauseButton!.addEventListener('click', () => handleButton(MESSAGE_TYPES.PAUSE));

const drawButton = document.getElementById('draw') as HTMLButtonElement;
drawButton!.addEventListener('click', () => handleButton(MESSAGE_TYPES.DRAW));

const surrenderButton = document.getElementById('surrender') as HTMLButtonElement;
surrenderButton!.addEventListener('click', () => handleButton(MESSAGE_TYPES.SURRENDER));

export function updateGameButtons(disable: boolean): void {
    rewindButton.disabled = disable;
    unlockRulesButton.disabled = disable;
    pauseButton.disabled = disable;
    drawButton.disabled = disable;
    surrenderButton.disabled = disable;
}
export function updatePositionButtons(disable: boolean): void {
    claimWhiteButton.disabled = disable;
    claimBlackButton.disabled = disable;
    claimSpectatorButton.disabled = disable;
}

const whitePlayerInfoText = document.getElementById('whitePlayerInfo')!;
const blackPlayerInfoText = document.getElementById('blackPlayerInfo')!;
const spectatorInfoText = document.getElementById('spectatorInfo')!;
export function updateNames(playerWhiteName: string | null, playerBlackName: string | null, spectatorNames: string[], disable: boolean): void {
    whitePlayerInfoText.textContent = playerWhiteName ? playerWhiteName : '';
    claimWhiteButton.disabled = disable || (playerWhiteName !== null);

    blackPlayerInfoText.textContent = playerBlackName ? playerBlackName : '';
    claimBlackButton.disabled = disable || (playerBlackName !== null);

    spectatorInfoText.textContent = spectatorNames.join(', ');
    claimSpectatorButton.disabled = disable;
}




// Rules
const ruleMoveOwnKing = document.getElementById("ruleMoveOwnKing") as HTMLInputElement;
const ruleMoveOwnKingDisagree = document.getElementById("ruleMoveOwnKingDisagree") as HTMLInputElement;
ruleMoveOwnKing.addEventListener('change', sendRules);

const ruleMoveOwnKingInCheck = document.getElementById("ruleMoveOwnKingInCheck") as HTMLInputElement;
const ruleMoveOwnKingInCheckDisagree = document.getElementById("ruleMoveOwnKingInCheckDisagree") as HTMLInputElement;
ruleMoveOwnKingInCheck.addEventListener('change', sendRules);

const ruleMoveOpp = document.getElementById("ruleMoveOpp") as HTMLInputElement;
const ruleMoveOppDisagree = document.getElementById("ruleMoveOppDisagree") as HTMLInputElement;
ruleMoveOpp.addEventListener('change', sendRules);

const ruleUndoTileMove = document.getElementById("ruleUndoTileMove") as HTMLInputElement;
const ruleUndoTileMoveDisagree = document.getElementById("ruleUndoTileMoveDisagree") as HTMLInputElement;
ruleUndoTileMove.addEventListener('change', sendRules);

const ruleMoveOppKing = document.getElementById("ruleMoveOppKing") as HTMLInputElement;
const ruleMoveOppKingDisagree = document.getElementById("ruleMoveOppKingDisagree") as HTMLInputElement;
ruleMoveOppKing.addEventListener('change', sendRules);

const ruleMoveOppCheck = document.getElementById("ruleMoveOppCheck") as HTMLInputElement;
const ruleMoveOppCheckDisagree = document.getElementById("ruleMoveOppCheckDisagree") as HTMLInputElement;
ruleMoveOppCheck.addEventListener('change', sendRules);

const ruleDoubleMovePawn = document.getElementById("ruleDoubleMovePawn") as HTMLInputElement;
const ruleDoubleMovePawnDisagree = document.getElementById("ruleDoubleMovePawnDisagree") as HTMLInputElement;
ruleDoubleMovePawn.addEventListener('change', sendRules);

const ruleCastleNormal = document.getElementById("ruleCastleNormal") as HTMLInputElement;
const ruleCastleNormalDisagree = document.getElementById("ruleCastleNormalDisagree") as HTMLInputElement;
ruleCastleNormal.addEventListener('change', sendRules);

const ruleCastleMoved = document.getElementById("ruleCastleMoved") as HTMLInputElement;
const ruleCastleMovedDisagree = document.getElementById("ruleCastleMovedDisagree") as HTMLInputElement;
ruleCastleMoved.addEventListener('change', sendRules);

const ruleEnPassantTile = document.getElementById("ruleEnPassantTile") as HTMLInputElement;
const ruleEnPassantTileDisagree = document.getElementById("ruleEnPassantTileDisagree") as HTMLInputElement;
ruleEnPassantTile.addEventListener('change', sendRules);

const ruleEnPassantTileHome = document.getElementById("ruleEnPassantTileHome") as HTMLInputElement;
const ruleEnPassantTileHomeDisagree = document.getElementById("ruleEnPassantTileHomeDisagree") as HTMLInputElement;
ruleEnPassantTileHome.addEventListener('change', sendRules);

const ruleIgnoreAll = document.getElementById("ruleIgnoreAll") as HTMLInputElement;
const ruleIgnoreAllDisagree = document.getElementById("ruleIgnoreAllDisagree") as HTMLInputElement;
ruleIgnoreAll.addEventListener('change', sendRules);

let rulesLocked = false;
function getRules(): Rules {
    return {ruleMoveOwnKing: ruleMoveOwnKing.checked,
            ruleMoveOwnKingInCheck: ruleMoveOwnKingInCheck.checked,
            ruleMoveOpp: ruleMoveOpp.checked,
            ruleUndoTileMove: ruleUndoTileMove.checked,
            ruleMoveOppKing: ruleMoveOppKing.checked,
            ruleMoveOppCheck: ruleMoveOppCheck.checked,
            ruleDoubleMovePawn: ruleDoubleMovePawn.checked,
            ruleCastleNormal: ruleCastleNormal.checked,
            ruleCastleMoved: ruleCastleMoved.checked,
            ruleEnPassantTile: ruleEnPassantTile.checked,
            ruleEnPassantTileHome: ruleEnPassantTileHome.checked,
            ruleIgnoreAll: ruleIgnoreAll.checked};
}
export function sendRules(): void {
    const newRules = getRules();
    setRules(newRules);
    sendMessage({type: MESSAGE_TYPES.RULES, rules: newRules} satisfies RulesMessage);
}
export function disableRules(): void {
    if (rulesLocked || (localGameState && !localGameState.isActive) || myColor === PieceColor.NONE) {
        ruleMoveOwnKing.disabled = true;
        ruleMoveOwnKingInCheck.disabled = true;
        ruleMoveOpp.disabled = true;
        ruleUndoTileMove.disabled = true;
        ruleMoveOppKing.disabled = true;
        ruleMoveOppCheck.disabled = true;
        ruleDoubleMovePawn.disabled = true;
        ruleCastleNormal.disabled = true;
        ruleCastleMoved.disabled = true;
        ruleEnPassantTile.disabled = true;
        ruleEnPassantTileHome.disabled = true;
        ruleIgnoreAll.disabled = true;
    } else {
        ruleMoveOwnKing.disabled = false;
        ruleMoveOwnKingInCheck.disabled = ruleMoveOwnKing.checked;
        ruleMoveOpp.disabled = false;
        ruleUndoTileMove.disabled = ruleMoveOpp.checked;
        ruleMoveOppKing.disabled = ruleMoveOpp.checked;
        ruleMoveOppCheck.disabled = ruleMoveOpp.checked;
        ruleDoubleMovePawn.disabled = true; // TODO
        ruleCastleNormal.disabled = true; // TODO
        ruleCastleMoved.disabled = true; // TODO
        ruleEnPassantTile.disabled = true; // TODO
        ruleEnPassantTileHome.disabled = true; // TODO
        ruleIgnoreAll.disabled = false;
    }
}
export function hideRulesAgreement(): void {
    ruleMoveOwnKingDisagree.hidden = true;
    ruleMoveOwnKingInCheckDisagree.hidden = true;
    ruleMoveOppDisagree.hidden = true;
    ruleUndoTileMoveDisagree.hidden = true;
    ruleMoveOppKingDisagree.hidden = true;
    ruleMoveOppCheckDisagree.hidden = true;
    ruleDoubleMovePawnDisagree.hidden = true;
    ruleCastleNormalDisagree.hidden = true;
    ruleCastleMovedDisagree.hidden = true;
    ruleEnPassantTileDisagree.hidden = true;
    ruleEnPassantTileHomeDisagree.hidden = true;
    ruleIgnoreAllDisagree.hidden = true;
}
export function updateRulesAgreement(rulesAgreement: Rules, newRulesLocked: boolean): void {
    rulesLocked = newRulesLocked;
    if (rulesLocked || (localGameState && !localGameState.isActive) || myColor === PieceColor.NONE) {
        hideRulesAgreement();
    } else {
        ruleMoveOwnKingDisagree.hidden = rulesAgreement.ruleMoveOwnKing;
        ruleMoveOwnKingInCheckDisagree.hidden = rulesAgreement.ruleMoveOwnKingInCheck;
        ruleMoveOppDisagree.hidden = rulesAgreement.ruleMoveOpp;
        ruleUndoTileMoveDisagree.hidden = rulesAgreement.ruleUndoTileMove;
        ruleMoveOppKingDisagree.hidden = rulesAgreement.ruleMoveOppKing;
        ruleMoveOppCheckDisagree.hidden = rulesAgreement.ruleMoveOppCheck;
        ruleDoubleMovePawnDisagree.hidden = rulesAgreement.ruleDoubleMovePawn;
        ruleCastleNormalDisagree.hidden = rulesAgreement.ruleCastleNormal;
        ruleCastleMovedDisagree.hidden = rulesAgreement.ruleCastleMoved;
        ruleEnPassantTileDisagree.hidden = rulesAgreement.ruleEnPassantTile;
        ruleEnPassantTileHomeDisagree.hidden = rulesAgreement.ruleEnPassantTileHome;
        ruleIgnoreAllDisagree.hidden = rulesAgreement.ruleIgnoreAll;
    }

    disableRules();
}
export function updateRules(rules: Rules): void {
    ruleMoveOwnKing.checked = rules.ruleMoveOwnKing;
    ruleMoveOwnKingInCheck.checked = rules.ruleMoveOwnKingInCheck;
    ruleMoveOpp.checked = rules.ruleMoveOpp;
    ruleUndoTileMove.checked = rules.ruleUndoTileMove;
    ruleMoveOppKing.checked = rules.ruleMoveOppKing;
    ruleMoveOppCheck.checked = rules.ruleMoveOppCheck;
    ruleDoubleMovePawn.checked = rules.ruleDoubleMovePawn;
    ruleCastleNormal.checked = rules.ruleCastleNormal;
    ruleCastleMoved.checked = rules.ruleCastleMoved;
    ruleEnPassantTile.checked = rules.ruleEnPassantTile;
    ruleEnPassantTileHome.checked = rules.ruleEnPassantTileHome;
    ruleIgnoreAll.checked = rules.ruleIgnoreAll;

    setRules(getRules());
    disableRules();
}