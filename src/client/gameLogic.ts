import { GameState, PieceType, Piece, PieceColor, MESSAGE_TYPES, MovePieceMessage, Rules, Message } from "../shared/types.js";
import { sendMessage } from "./client.js";
import { inCheck, checkCastle, moveOnBoard, checkPromotion, getValidMoves, anyValidMoves, rotateTileOnBoard, swapTilesOnBoard, getPiecesOnTile, gameInfoFromGameState, getDefaultBoard } from '../shared/utils.js'
import { gameList, getGame, showLobby } from "./lobbyScreen.js";
import { disableRules, hideRulesAgreement, updateGameButtons, updateNames, updatePositionButtons, updateRulesAgreement } from "./gameScreen.js";
import { drawPromotionSelector, waitForPromo } from "./promotionSelector.js";
import { canvas, checkIfTile, clearLastMoveHighlight, clearMoveHighlight, clearSquareHighlight, ctx, drawSquare, flip, getBoardRowCol, highlightLastMove, highlightMove, highlightSquare, renderFullBoard, setFlip } from "./drawBoard.js";
import { syncTime } from "./timer.js";

export let localGameState: GameState | undefined = undefined;



// click events
export function handleMouseUpEvent(event: MouseEvent): void {
    event.preventDefault();
    if (event.button !== 2) {
        handleClick(event.offsetX, event.offsetY, false);
    }
}
export function handleContextMenuEvent(event: MouseEvent): void {
    event.preventDefault();
    handleClick(event.offsetX, event.offsetY, true);
}
export function handleMouseMoveEvent(event: MouseEvent): void {
    handleHover(event.offsetX, event.offsetY)
}
export function handleTouchMoveEvent(event: TouchEvent): void {
    // prevents scrolling
    event.preventDefault();
    const bcr = canvas.getBoundingClientRect();
    handleHover(event.touches[0].clientX - bcr.x, 
                event.touches[0].clientY - bcr.y);
}

canvas.addEventListener('mouseup', handleMouseUpEvent);
canvas.addEventListener('contextmenu', handleContextMenuEvent);
canvas.addEventListener('mousemove', handleMouseMoveEvent);
canvas.addEventListener('touchmove', handleTouchMoveEvent);





// UI stuff
export const chatLogElement = document.getElementById("chatLog") as HTMLTextAreaElement;
export const movesLogDiv = document.getElementById('movesLogDiv') as HTMLDivElement;
export const movesLogColumnNum = document.getElementById('movesLogColumnNum') as HTMLDivElement;
export const movesLogColumnWhite = document.getElementById('movesLogColumnWhite') as HTMLDivElement;
export const movesLogColumnBlack = document.getElementById('movesLogColumnBlack') as HTMLDivElement;

export function updateChat(message: string): void {
    if (!localGameState) {
        return;
    }
    localGameState.chatLog.push(message);
    chatLogElement.value += "\n" + message;
    chatLogElement.scrollTop = chatLogElement.scrollHeight;
}

function appendToMovesLog(notation: string, moveNum: number): void {
    if (!localGameState) {
        console.error("No local game state to log move to");
        return;
    }
    
    if (moveNum % 2 === 1) {
        movesLogColumnNum.innerHTML += `${Math.floor(moveNum / 2) + 1}.<br>`;
        movesLogColumnWhite.innerHTML += `${notation}<br>`;
    } else {
        movesLogColumnBlack.innerHTML += `${notation}<br>`;
    }
    movesLogDiv.scrollTop = movesLogDiv.scrollHeight;
}

function redrawMovesLog(): void {
    if (!localGameState) {
        console.error("No local game state to log move to");
        return;
    }
    movesLogColumnNum.innerHTML = '';
    movesLogColumnWhite.innerHTML = '';
    movesLogColumnBlack.innerHTML = '';

    for (let i = 0; i < localGameState.movesLog.length; i++) {
        appendToMovesLog(localGameState.movesLog.at(i)!.notation, i + 1);
    }
    boldMovePointer(localGameState.movesLog.length - 1);
}

function boldMovePointer(moveNum: number): void {
    let lines;
    movesLogColumnBlack.innerHTML = movesLogColumnBlack.innerHTML.replace(/\<\/?strong\>/g, '');
    movesLogColumnWhite.innerHTML = movesLogColumnWhite.innerHTML.replace(/\<\/?strong\>/g, '');
    if (moveNum % 2) {
        lines = movesLogColumnBlack.innerHTML.trim().split('<br>');
    } else {
        lines = movesLogColumnWhite.innerHTML.trim().split('<br>');
    }

    const lineNum = Math.floor(moveNum / 2);
    const line = lines.at(lineNum);
    if (!line) return;


    const newLine = `<strong>${line}</strong>`;
    lines.splice(lineNum, 1, newLine);

    if (moveNum % 2) {
        movesLogColumnBlack.innerHTML = lines.join('<br>');
    } else {
        movesLogColumnWhite.innerHTML = lines.join('<br>');
    }
}




// game logic
export let myColor = PieceColor.NONE;
let selectedSquare: {row: number, col: number, isTile: boolean} | null = null;
let validSquares: ReturnType<typeof getValidMoves> | null;
let hover: {uRow: number, uCol: number, prevWasValid: boolean} | null = null;  // grabs initial hover tile from handleClick, then updated on mousemove from handleHover
export let movePointer = Number.POSITIVE_INFINITY;  // will be set to max value once we have a gameState

export function initLocalGameState(gameState: GameState, yourColor: PieceColor): void {
    localGameState = gameState;
    myColor = yourColor;
    if (myColor === PieceColor.WHITE) {
        setFlip(false);
    } else if (myColor === PieceColor.BLACK) {
        setFlip(true);
    }
    updateGameButtons(!gameState.isActive || yourColor === PieceColor.NONE);
    updatePositionButtons(!gameState.isActive);

    document.getElementById('gameIdDisplay')!.textContent = `${gameState.id}`;
    updateNames(gameState.playerWhiteName, gameState.playerBlackName, gameState.spectatorNames, !gameState.isActive);
    syncTime(gameState.clockRunning, gameState.timeLeftWhite, gameState.timeLeftBlack, gameState.initialTimeWhite, gameState.initialTimeBlack, gameState.incrementWhite, gameState.incrementBlack);
    chatLogElement.value = gameState.chatLog.join("\n");
    chatLogElement.scrollTop = chatLogElement.scrollHeight;
    redrawMovesLog();

    // start with the loaded board, and repoint to the loaded board on move()
    // updateMovePointer can pull focus to the alternate board
    boardToRender = localGameState.board
    movePointer = Number.POSITIVE_INFINITY;

    renderFullBoard();
    highlightLastMove();
    selectedSquare = null;
    validSquares = null;
    // updateRules(gameState.rules, myClientId);  // server will send a separate message to negotiate rules

    // if we don't have this game in our list, create it locally 
    if (!getGame(localGameState.id)) {
        const game = gameInfoFromGameState(gameState);
        game.password = gameState.password;
        gameList.push(game);
    }
    if (myColor === PieceColor.NONE) disableRules();
}

export function clearLocalGameState(): void {
    localGameState = undefined;
    myColor = PieceColor.NONE;
    movePointer = Number.POSITIVE_INFINITY;
    selectedSquare = null;
    setFlip(false);
    chatLogElement.value = "";
    // clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function setRules(rules: Rules): void {
    if (localGameState) localGameState.rules = rules;
}

async function handleClick(offsetX: number, offsetY: number, isRightClick: boolean): Promise<void> {
    if (!localGameState) {
        console.error("No board to get piece from");
        return;
    }
    if (myColor === PieceColor.NONE) {
        return;
    }

    let {uRow, uCol} = getBoardRowCol(offsetX, offsetY);
    const tileClick = checkIfTile(offsetX, offsetY);

    // force isTile if it's a right click, our current selection is a tile, or if we try to highlight an empty square, or if it's along the edge of a square. 
    let isTile = isRightClick || selectedSquare?.isTile 
                        || (!selectedSquare && localGameState.board[uRow][uCol].type === PieceType.EMPTY) 
                        || tileClick;
    
    // If the first click wasn't a tile, force this false also
    if (selectedSquare && !selectedSquare.isTile) isTile = false;

    // for tiles, make the selected square the bottom left corner (unless it's a rotation), i.e. make the row and column even, rounding down
    if (isTile) {
        // don't do this correction if it's the second click within the same tile so that we can capture rotation
        if (selectedSquare === null || !selectedSquare.isTile || ![0, 1].includes(uRow - selectedSquare.row) || ![0, 1].includes(uCol - selectedSquare.col)) {
            uRow -= uRow % 2;
            uCol -= uCol % 2;
        }
    }
    //console.log(`(${row}, ${col}) ${isTile}`);

    //const piece = localGameState.board[unflippedRow][unflippedCol];
    //console.log(`Clicked on ${col0ToFile(col)}${row+1}: ${PieceColor[piece.color]} ${PieceType[piece.type]}`);

    if (selectedSquare === null) {
        // selecting a new piece
        if (isTile || localGameState.board[uRow][uCol].color === myColor) {
            selectedSquare = {row: uRow, col: uCol, isTile};
            validSquares = getValidMoves(localGameState.board, uRow, uCol, isTile, myColor, false, localGameState.movesLog.at(-1), localGameState.QW, localGameState.KW, localGameState.QB, localGameState.KB, localGameState.rules);
            // if it's a tile move, start the hover logic
            if (isTile) {
                hover = {uRow: uRow, uCol: uCol, prevWasValid: true};
                handleHover(offsetX, offsetY);
            }

            // also highlight the bottom left corner of the tile
            if (isTile) {
                highlightSquare(uRow, uCol, "rgb(255 0 0 / 75%)", false);
            }

            // highlight the select square/tile
            highlightSquare(uRow, uCol, "rgb(255 0 0 / 75%)", isTile);

            // highlight the valid moves
            validSquares.forEach(square => {
                highlightSquare(square.toRow, square.toCol, "rgb(255 0 0 / 25%)", square.isTile);
            })
        } 
    } else {
        // try to move piece if we think it's valid. If it's an invalid move, the server will reject it. 
        if (localGameState.rules.ruleIgnoreAll || (myColor === localGameState.currentTurn && validSquares?.some(square => square.toRow === uRow && square.toCol === uCol))) {
            // if promotion(s) detected, show the dialog(s) and wait for the user to click
            const promoLocations = checkPromotion(localGameState.board, selectedSquare.row, selectedSquare.col, uRow, uCol, isTile);
            let promos: {row: number; col: number, piece: Piece}[] = [];
            if (promoLocations.length) {
                for (const promo of promoLocations) {
                    drawPromotionSelector(promo.row, promo.col);
                    const pieceType: PieceType = await waitForPromo();
                    if (pieceType !== PieceType.EMPTY) promos.push({row: promo.row, col: promo.col, piece: {type: pieceType, color: myColor}});
                }
                renderFullBoard();  // TODO: redraw only the promotion square(s)
            }
            if (promos.length === promoLocations.length) {
                requestMovePiece(selectedSquare.row, selectedSquare.col, uRow, uCol, isTile, promos);
            }
        }
        hover = null;

        // regardless, clear the highlight
        clearSquareHighlight(selectedSquare.row, selectedSquare.col, selectedSquare.isTile);
        if (validSquares) {
            validSquares.forEach(square => {
                clearSquareHighlight(square.toRow, square.toCol, square.isTile);
            })
        }
        selectedSquare = null;
        validSquares = null;

        // redo the last move highlight
        renderFullBoard();  // TODO: remove this once I fix the hover glitch
        highlightLastMove();

    }
    ctx.stroke();
}

const hoverAlpha = 0.5;  // transparency of pieces when hovering a tile move
function handleHover(offsetX: number, offsetY: number): void {
    if (!hover || !localGameState || !selectedSquare) return;
    // hover holds the {uRow, uCol} of the corner of the tile

    // get the current square position
    const {uRow, uCol} = getBoardRowCol(offsetX, offsetY);
    
    // only update the hover if we've moved squares
    if ((uRow === hover.uRow && uCol === hover.uCol) || uRow < 0 || uRow > 7 || uCol < 0 || uCol > 7) return;

    // clear previous hover
    if (hover.prevWasValid) {
        clearSquareHighlight(selectedSquare!.row, selectedSquare!.col, true);  // highlight done later
        clearSquareHighlight(hover.uRow, hover.uCol, true);
        highlightSquare(hover.uRow, hover.uCol, "rgb(255 0 0 / 25%)", true);
    }

    hover.uRow = uRow;
    hover.uCol = uCol;
    
    const uRowCorner = uRow - uRow % 2;
    const uColCorner = uCol - uCol % 2;

    function highlightSelectedSquare(): void {
        highlightSquare(selectedSquare!.row, selectedSquare!.col, "rgb(255 0 0 / 75%)", false);
        highlightSquare(selectedSquare!.row, selectedSquare!.col, "rgb(255 0 0 / 75%)", true);
        for (const square of validSquares!) {
            if (square.toRow - square.toRow % 2 === selectedSquare!.row && square.toCol - square.toCol % 2 === selectedSquare!.col){
                highlightSquare(square.toRow, square.toCol, "rgb(255 0 0 / 25%)", false);
            }
        }
    }

    // if this isn't a valid square, don't do the rest
    if (!validSquares?.some(square => [uRow, uRowCorner].includes(square.toRow) && [uCol, uColCorner].includes(square.toCol))) {
        hover.prevWasValid = false;
        highlightSelectedSquare();
        return;
    }
    hover.prevWasValid = true;


    const inStartTile = uRowCorner === selectedSquare!.row && uColCorner === selectedSquare!.col;

    // make move on dummy board if it's a valid square
    // draw tiles and from dummy board
    // NOTE: handleClick will redraw everything when we click off
    const dummyBoard = structuredClone(localGameState.board);
    if (inStartTile && (uRow % 2 || uCol % 2)) {
        // tile rotation
        for (const square of validSquares!) {
            if (uRow === square.toRow && uCol === square.toCol) {
                rotateTileOnBoard(selectedSquare!.row, selectedSquare!.col, uRow, uCol, dummyBoard, false);
                drawSquare(selectedSquare!.row, selectedSquare!.col, true, getPiecesOnTile(selectedSquare!.row, selectedSquare!.col, dummyBoard), hoverAlpha);
            }
        }
    }
    else {
        // tile swap
        for (const square of validSquares!) {
            if (uRowCorner === square.toRow && uColCorner === square.toCol) {
                swapTilesOnBoard(selectedSquare!.row, selectedSquare!.col, uRowCorner, uColCorner, dummyBoard);
                drawSquare(selectedSquare!.row, selectedSquare!.col, true, getPiecesOnTile(selectedSquare!.row, selectedSquare!.col, dummyBoard), hoverAlpha);
                drawSquare(uRowCorner, uColCorner, true, getPiecesOnTile(uRowCorner, uColCorner, dummyBoard), hoverAlpha);
            }
        }
    }

    // redo the highlights
    highlightSelectedSquare();
    highlightSquare(hover.uRow, hover.uCol, "rgb(255 0 0 / 25%)", true);

}

export function requestMovePiece(fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]): void {
    if (localGameState && !localGameState.isActive) {
        move(fromRow, fromCol, toRow, toCol, '', isTile, promotions);
    } else {
        sendMessage({ type: MESSAGE_TYPES.MOVE_PIECE, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, isTile: isTile, promotions: promotions } satisfies MovePieceMessage);
    }
}

export function move(fromRow: number, fromCol: number, toRow: number, toCol: number, notation: string, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]): void {
    if (!localGameState) {
        console.error("No local game state to move piece on");
        return;
    }

    // if we've been scrolling, then point to the gameState board and redraw to prep for this move
    if (movePointer !== Number.POSITIVE_INFINITY) {
        movePointer = Number.POSITIVE_INFINITY;
        boardToRender = localGameState.board;
        renderFullBoard();
    }

    // do the move!
    const {oldPiece, newPiece, enPassant} = moveOnBoard(localGameState.board, fromRow, fromCol, toRow, toCol, isTile, promotions);
    if (isTile) {
        drawSquare(fromRow, fromCol, true, getPiecesOnTile(fromRow, fromCol, localGameState.board)); // redraw origin
        drawSquare(toRow, toCol, true, getPiecesOnTile(toRow, toCol, localGameState.board)); // redraw destination
    } else {
        drawSquare(fromRow, fromCol, false, null); // redraw origin
        drawSquare(toRow, toCol, false, newPiece); // redraw destination
    }

    // check if castling is still allowed
    [localGameState.QW, localGameState.KW, localGameState.QB, localGameState.KB] = checkCastle(localGameState.board, localGameState.QW, localGameState.KW, localGameState.QB, localGameState.KB, localGameState.rules);

    // draw promotions
    for (const promotion of promotions) {
        drawSquare(promotion.row, promotion.col, false, promotion.piece);
    }

    // detect castle (king moves twice) and draw the rook
    const castling = newPiece.type === PieceType.KING && Math.abs(fromCol - toCol) === 2
    if (castling) {
        const castleRow = newPiece.color === PieceColor.WHITE ? 0 : 7;
        if (fromCol > toCol) {
            // queenside, move a
            drawSquare(castleRow, 0, false, null);
            drawSquare(castleRow, 3, false, localGameState.board[castleRow][3]);
        } else {
            drawSquare(castleRow, 7, false, null);
            drawSquare(castleRow, 5, false, localGameState.board[castleRow][5]);
        }
    }

    // log the move and handle highlights
    clearLastMoveHighlight();
    localGameState.movesLog.push({oldPiece: oldPiece, newPiece: newPiece, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: notation, isTile: isTile, promotions: promotions});
    highlightLastMove();

    // check for checkmate/stalemate/timer
    let checkmate = false;
    let stalemate = false;
    if (!anyValidMoves(myColor, localGameState.board, localGameState.movesLog.at(-1), localGameState.rules)) {
        if (inCheck(myColor, localGameState.board)) {
            checkmate = true;
        } else {
            stalemate = true;
        }
    }
    if (checkmate || stalemate || (localGameState.useTimeControl && (localGameState.timeLeftBlack < 0 || localGameState.timeLeftWhite < 0))) {
        sendMessage({ type: MESSAGE_TYPES.GAME_OVER } satisfies Message);
    }

    // update the move log text
    appendToMovesLog(notation, localGameState.movesLog.length);
    boldMovePointer(localGameState.movesLog.length - 1);
    
    // Update the current turn
    localGameState.currentTurn = (localGameState.currentTurn === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE);

    // TODO: remove this once I fix the hover glitch
    renderFullBoard();  
    highlightLastMove();

    ctx.stroke();
}

export function handleButton(type: typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES]): void {
    switch (type) {
        case MESSAGE_TYPES.QUIT_GAME:
            sendMessage({ type: type } satisfies Message);
            showLobby();  // just in case
            break;
        case MESSAGE_TYPES.REWIND:
        case MESSAGE_TYPES.UNLOCK_RULES:
        case MESSAGE_TYPES.PAUSE:
        case MESSAGE_TYPES.DRAW:
        case MESSAGE_TYPES.SURRENDER:
            if (localGameState && localGameState.isActive && myColor !== PieceColor.NONE) {
                sendMessage({ type: type } satisfies Message);
            }
            break;
    }
}




// archived game scrolling
export let boardToRender = getDefaultBoard();
function scrollToMove(moveNum: number): void {
    if (!localGameState) return;

    boardToRender = getDefaultBoard();
    for (let i = 0; i < Math.min(moveNum + 1, localGameState.movesLog.length); i++) {
        const move = localGameState.movesLog.at(i)!;
        moveOnBoard(boardToRender, move.fromRow, move.fromCol, move.toRow, move.toCol, move.isTile, move.promotions);
    }
    renderFullBoard();
    if (moveNum >= 0) highlightMove(localGameState.movesLog.at(moveNum)!)
}
export function updateMovePointer(newNum: number): void {
    if (!localGameState) return;

    if (newNum === Number.POSITIVE_INFINITY) newNum = localGameState.movesLog.length - 2;

    movePointer = Math.min(localGameState.movesLog.length - 1, Math.max(newNum, 0));
    scrollToMove(movePointer);
    boldMovePointer(movePointer);
}
const backwardButton = document.getElementById('backward')! as HTMLButtonElement;
backwardButton.addEventListener('click', () => updateMovePointer(movePointer - 1));
const forwardButton = document.getElementById('forward')! as HTMLButtonElement;
forwardButton.addEventListener('click', () => updateMovePointer(movePointer + 1));
const backwardAllButton = document.getElementById('backwardAll')! as HTMLButtonElement;
backwardAllButton.addEventListener('click', () => updateMovePointer(0));
const forwardAllButton = document.getElementById('forwardAll')! as HTMLButtonElement;
forwardAllButton.addEventListener('click', () => updateMovePointer(Number.POSITIVE_INFINITY));

