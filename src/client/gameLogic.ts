import { GameState, PieceType, Piece, PieceColor, MESSAGE_TYPES, MovePieceMessage, Message, CompressedGameState } from "../shared/types.js";
import { sendMessage } from "./client.js";
import { inCheck, checkCastle, moveOnBoard, checkPromotion, getValidMoves, anyValidMoves, rotateTileOnBoard, swapTilesOnBoard, getPiecesOnTile, gameInfoFromGameState, getDefaultBoard, getPieceOnBoard, getFEN, parseFEN, decompressMovesLog } from '../shared/utils.js'
import { gameList, getGame } from "./lobbyScreen.js";
import { disableRules, updateCaptures, updateGameButtons, updateNames, updatePositionButtons } from "./gameScreen.js";
import { drawPromotionSelector, waitForPromo } from "./promotionSelector.js";
import { canvas, checkIfTile, ctx, drawSquare, getBoardRowCol, highlightSquare, renderFullBoard, setFlip } from "./drawBoard.js";
import { syncTime } from "./timer.js";


function getDefaultGameState(): GameState {
    return {
        playerWhiteName: null,
        playerBlackName: null,
        spectatorNames: [],
        id: 0,
        password: '',
        board: getDefaultBoard(),
        chatLog: [],
        movesLog: [],
        currentTurn: PieceColor.WHITE,
        useTimeControl: true,
        initialTimeWhite: 0,
        initialTimeBlack: 0,
        incrementWhite: 0,
        incrementBlack: 0,
        timeLeftWhite: 0,
        timeLeftBlack: 0,
        clockRunning: false,
        KW: true,
        QW: true,
        KB: true,
        QB: true,
        drawWhite: false,
        drawBlack: false,
        rules: {
            ruleMoveOwnKing: true,
            ruleMoveOwnKingInCheck: true,
            ruleMoveOpp: true,
            ruleUndoTileMove: true,
            ruleMoveOppKing: true,
            ruleMoveOppCheck: true,
            ruleDoubleMovePawn: true,
            ruleCastleNormal: false,
            ruleCastleMoved: false,
            ruleEnPassantTile: false,
            ruleEnPassantTileHome: false,
            ruleIgnoreAll: false
        },
        rulesLocked: false,
        halfmoveClock: 0,
        arrayFEN: [],
        creationTime: 0,
        isActive: true
    };
}
export let localGameState = getDefaultGameState();



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
const chatLogElement = document.getElementById("chatLog") as HTMLTextAreaElement;
const movesLogDiv = document.getElementById('movesLogDiv') as HTMLDivElement;
const movesLogColumnNum = document.getElementById('movesLogColumnNum') as HTMLDivElement;
const movesLogColumnWhite = document.getElementById('movesLogColumnWhite') as HTMLDivElement;
const movesLogColumnBlack = document.getElementById('movesLogColumnBlack') as HTMLDivElement;
const copyButton = document.getElementById('copy')! as HTMLButtonElement;
copyButton.addEventListener('click', async () => {
    await navigator.clipboard.writeText(getMovesLog());
    copyButton.disabled = true;
    setTimeout(() => copyButton.disabled = false, 1000);
});

function getMovesLog(): string {
    const nums = movesLogColumnNum.innerHTML.trim().split('<br>');
    const white = movesLogColumnWhite.innerHTML.trim().split('<br>');
    const black = movesLogColumnBlack.innerHTML.trim().split('<br>');
    if (nums.length !== white.length || ![0, 1].includes(white.length - black.length)) {
        console.error('Error getting moves log', nums.length, white.length, black.length, nums, white, black);
        return '';
    }

    let s = '';
    for (let i = 0; i < nums.length; i++) {
        s += `${nums[i]} ${i < white.length ? white[i] : ''} ${i < black.length ? black[i] : ''} `;
    }
    return s.replace(/\<.*?\>/g, '');
}
function appendToMovesLog(notation: string, moveNum: number): void {
    if (moveNum % 2 === 1) {
        movesLogColumnNum.innerHTML += `${Math.floor(moveNum / 2) + 1}.<br>`;
        movesLogColumnWhite.innerHTML += `${notation}<br>`;
    } else {
        movesLogColumnBlack.innerHTML += `${notation}<br>`;
    }
    movesLogDiv.scrollTop = movesLogDiv.scrollHeight;
}

function redrawMovesLog(): void {
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

export function setNames(playerWhiteName: string | null, playerBlackName: string | null, spectatorNames: string[], yourColor: PieceColor): void {
    localGameState.playerWhiteName = playerWhiteName;
    localGameState.playerBlackName = playerBlackName;
    localGameState.spectatorNames = spectatorNames;
    updateNames(localGameState.playerWhiteName, localGameState.playerBlackName, localGameState.spectatorNames, !localGameState.isActive);

    if (myColor !== yourColor) {
        if (yourColor === PieceColor.WHITE) {
            setFlip(false);
        } else if (yourColor === PieceColor.BLACK) {
            setFlip(true);
        }
    }
    myColor = yourColor;
    updateGameButtons(!localGameState.isActive || yourColor === PieceColor.NONE);
}




// game logic
export let myColor = PieceColor.NONE;
let selectedSquare: {row: number, col: number, isTile: boolean} | null = null;
let validSquares: ReturnType<typeof getValidMoves> | null;
let hover: {uRow: number, uCol: number, prevWasValid: boolean} | null = null;  // grabs initial hover tile from handleClick, then updated on mousemove from handleHover
export let movePointer = Number.POSITIVE_INFINITY;  // will be set to max value once we have a gameState
let captures: Piece[] = [];

export function initLocalGameState(compressedGameState: CompressedGameState, yourColor: PieceColor): void {
    localGameState = {...localGameState, ...compressedGameState};
    captures = [];

    // reconstruct from compressedMovesLog: movesLog, board, arrayFEN, QW, KW, QB, KB, halfmoveClock
    localGameState.movesLog = decompressMovesLog(compressedGameState.compressedMovesLog);
    localGameState.board = getDefaultBoard();
    localGameState.currentTurn = PieceColor.WHITE;
    const {fen} = getFEN(localGameState.board, localGameState.currentTurn, true, true, true, true, 0, 1);
    localGameState.arrayFEN = [fen];
    for (const [i, move] of localGameState.movesLog.entries()) {
        moveOnBoard(localGameState.board, move.fromRow, move.fromCol, move.toRow, move.toCol, move.isTile, move.promotions);

        // update arrayFEN
        localGameState.currentTurn = localGameState.currentTurn === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;
        [localGameState.QW, localGameState.KW, localGameState.QB, localGameState.KB] = checkCastle(localGameState.board, localGameState.QW, localGameState.KW, localGameState.QB, localGameState.KB, localGameState.rules);
        
        if ((move.oldPiece.type !== PieceType.EMPTY && move.oldPiece.type !== PieceType.TILE) || move.newPiece.type === PieceType.PAWN) {
            localGameState.halfmoveClock = 0;
        } else {
            localGameState.halfmoveClock += 1;
        }
        
        const {fen} = getFEN(localGameState.board, localGameState.currentTurn, localGameState.QW, localGameState.KW, localGameState.QB, localGameState.KB, localGameState.halfmoveClock, Math.floor((i + 1) / 2) + 1 );
        localGameState.arrayFEN.push(fen);

        // append captured pieces
        if (move.oldPiece.color !== PieceColor.NONE) {
            captures.push(move.oldPiece);
        }
    }
    delete (localGameState as any).compressedMovesLog;

    myColor = yourColor;
    if (myColor === PieceColor.WHITE) {
        setFlip(false);
    } else if (myColor === PieceColor.BLACK) {
        setFlip(true);
    }
    updateCaptures(captures);
    updateGameButtons(!localGameState.isActive || yourColor === PieceColor.NONE);
    updatePositionButtons(!localGameState.isActive);

    document.getElementById('gameIdDisplay')!.textContent = `${localGameState.id}`;
    updateNames(localGameState.playerWhiteName, localGameState.playerBlackName, localGameState.spectatorNames, !localGameState.isActive);
    syncTime(localGameState.clockRunning, localGameState.timeLeftWhite, localGameState.timeLeftBlack, localGameState.initialTimeWhite, localGameState.initialTimeBlack, localGameState.incrementWhite, localGameState.incrementBlack);
    chatLogElement.value = localGameState.chatLog.join("\n");
    chatLogElement.scrollTop = chatLogElement.scrollHeight;
    redrawMovesLog();

    // start with the loaded board, and repoint to the loaded board on move()
    // updateMovePointer can pull focus to the alternate board
    boardToRender = localGameState.board;
    movePointer = Number.POSITIVE_INFINITY;

    renderFullBoard();
    selectedSquare = null;
    validSquares = null;
    // updateRules(gameState.rules, myClientId);  // server will send a separate message to negotiate rules

    // if we don't have this game in our list, create it locally 
    if (!getGame(localGameState.id)) {
        const game = gameInfoFromGameState(localGameState);
        game.password = localGameState.password;
        gameList.push(game);
    }
    if (myColor === PieceColor.NONE) disableRules();
}

export function clearLocalGameState(): void {
    localGameState = getDefaultGameState();;
    myColor = PieceColor.NONE;
    movePointer = Number.POSITIVE_INFINITY;
    selectedSquare = null;
    setFlip(false);
    chatLogElement.value = "";
    // clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function handleClick(offsetX: number, offsetY: number, isRightClick: boolean): Promise<void> {
    if (myColor === PieceColor.NONE || movePointer !== Number.POSITIVE_INFINITY) {
        hover = null;
        selectedSquare = null;
        validSquares = null;
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
            validSquares = getValidMoves(localGameState.board, uRow, uCol, isTile, myColor, false, localGameState.movesLog.at(-1), localGameState.QW, localGameState.KW, localGameState.QB, localGameState.KB, localGameState.rules, localGameState.arrayFEN);
            // if it's a tile move, start the hover logic and highlight the bottom left corner 
            if (isTile) {
                hover = {uRow: uRow, uCol: uCol, prevWasValid: true};
                handleHover(offsetX, offsetY);
                highlightSquare(uRow, uCol, "rgb(255 0 0 / 75%)", false);
            }

            // highlight the select square/tile
            highlightSquare(uRow, uCol, "rgb(255 0 0 / 75%)", isTile);

            // highlight the valid moves
            validSquares.forEach(square => {
                highlightSquare(square.toRow, square.toCol, "rgb(255 0 0 / 25%)", square.isTileSwap);
            })
            ctx.stroke();
        } 
    } else {
        // try to move piece if we think it's valid. If it's an invalid move, the server will reject it. 
        let forceRedraw = true;
        if (localGameState.rules.ruleIgnoreAll || (myColor === localGameState.currentTurn && validSquares?.some(square => square.toRow === uRow && square.toCol === uCol))) {
            // if promotion(s) detected, show the dialog(s) and wait for the user to click
            const promoLocations = checkPromotion(localGameState.board, selectedSquare.row, selectedSquare.col, uRow, uCol, isTile);
            let promos: {row: number; col: number, piece: Piece}[] = [];
            if (promoLocations.length) {
                for (const promo of promoLocations) {
                    drawPromotionSelector(promo.row, promo.col);
                    const pieceType: PieceType = await waitForPromo();

                    // waitForPromo returns and empty piece if they click off -> cancel the selection 
                    if (pieceType === PieceType.EMPTY) break;
                    else promos.push({row: promo.row, col: promo.col, piece: {type: pieceType, color: myColor}});
                }
            }
            if (promos.length === promoLocations.length) {
                requestMovePiece(selectedSquare.row, selectedSquare.col, uRow, uCol, isTile, promos);
                forceRedraw = false;
            }
        } 
        
        // redraw the board on cancel (click invalid or cancel promo) to clear all the highlights
        if (forceRedraw) renderFullBoard();

        hover = null;
        selectedSquare = null;
        validSquares = null;
    }
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
        drawSquare(hover.uRow, hover.uCol, true, getPiecesOnTile(hover.uRow, hover.uCol, localGameState.board))
        drawSquare(selectedSquare!.row, selectedSquare!.col, true, getPiecesOnTile(selectedSquare!.row, selectedSquare!.col, localGameState.board)) // highlight done later
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
            // highlight the valid rotation squares
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

function requestMovePiece(fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]): void {
    if (localGameState.isActive) {
        // time stuff is ignored on the server
        sendMessage({ type: MESSAGE_TYPES.MOVE_PIECE, fromRow, fromCol, toRow, toCol, isTile, promotions, notation: '', timeLeftWhite: localGameState.timeLeftWhite, timeLeftBlack: localGameState.timeLeftBlack, clockRunning: localGameState.clockRunning } satisfies MovePieceMessage);
        move(fromRow, fromCol, toRow, toCol, '', isTile, promotions);  // optimistically do the move. Server will send game state for us to draw if it's rejected
    }
}

let storedOldPiece: Piece = {type: PieceType.EMPTY, color: PieceColor.NONE};
export function move(fromRow: number, fromCol: number, toRow: number, toCol: number, notation: string, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]): void {
    // on the opponent's turn do this whole routine, but on my turn, this can be called either by the server confirming the move, OR us optimistically pre-moving
    // wait for server confirmation to log the move and actually change the current turn
    const preMove = localGameState.currentTurn === myColor && !notation;
    const oppMove = localGameState.currentTurn !== myColor;

    let oldPiece: Piece;
    let newPiece: Piece;
    if (preMove || oppMove) {
        // if we've been scrolling, then point to the gameState board and redraw to prep for this move
        if (movePointer !== Number.POSITIVE_INFINITY) {
            movePointer = Number.POSITIVE_INFINITY;
            boardToRender = localGameState.board;
            updateCaptures(captures);
        }

        // do the move!
        ({oldPiece, newPiece} = moveOnBoard(localGameState.board, fromRow, fromCol, toRow, toCol, isTile, promotions));
        storedOldPiece = oldPiece;

        // check if castling is still allowed
        [localGameState.QW, localGameState.KW, localGameState.QB, localGameState.KB] = checkCastle(localGameState.board, localGameState.QW, localGameState.KW, localGameState.QB, localGameState.KB, localGameState.rules);
    } else {
        ({oldPiece, newPiece} = getPieceOnBoard(localGameState.board, fromRow, fromCol, toRow, toCol, isTile));
        // we already did the move, so the actual newPiece that we want is in the oldPiece slot, and we saved the oldPiece that we want
        newPiece = oldPiece;
        oldPiece = storedOldPiece;
    }

    // server confirming our pre-move OR opponent's move
    if (!preMove) {
        // log the move
        localGameState.movesLog.push({oldPiece: oldPiece, newPiece: newPiece, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: notation, isTile: isTile, promotions: promotions});
        appendToMovesLog(notation, localGameState.movesLog.length);
        boldMovePointer(localGameState.movesLog.length - 1);
        
        // Update the current turn
        localGameState.currentTurn = (localGameState.currentTurn === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE);

        // update arrayFEN (ignore the move clocks)
        const {fen} = getFEN(localGameState.board, localGameState.currentTurn, localGameState.QW, localGameState.KW, localGameState.QB, localGameState.KB, 0, 0);
        localGameState.arrayFEN.push(fen);

        // check for checkmate/stalemate/timer
        let checkmate = false;
        let stalemate = false;
        if (!anyValidMoves(myColor, localGameState.board, localGameState.movesLog.at(-1), localGameState.rules, localGameState.arrayFEN)) {
            if (inCheck(myColor, localGameState.board)) {
                checkmate = true;
            } else {
                stalemate = true;
            }
        }
        if (checkmate || stalemate || (localGameState.useTimeControl && (localGameState.timeLeftBlack < 0 || localGameState.timeLeftWhite < 0))) {
            sendMessage({ type: MESSAGE_TYPES.GAME_OVER } satisfies Message);
        }

        // append captured pieces
        if (oldPiece.color !== PieceColor.NONE) {
            captures.push(oldPiece);
            updateCaptures(captures);
        }
    }

    // always redraw
    renderFullBoard();
}

export function handleButton(type: typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES]): void {
    switch (type) {
        case MESSAGE_TYPES.QUIT_GAME:
            sendMessage({ type: type } satisfies Message);
            break;
        case MESSAGE_TYPES.REWIND:
        case MESSAGE_TYPES.UNLOCK_RULES:
        case MESSAGE_TYPES.PAUSE:
        case MESSAGE_TYPES.DRAW:
        case MESSAGE_TYPES.SURRENDER:
            if (localGameState.isActive && myColor !== PieceColor.NONE) {
                sendMessage({ type: type } satisfies Message);
            }
            break;
    }
}




// archived game scrolling
export let boardToRender = getDefaultBoard();
function scrollToMove(moveNum: number): void {
    boardToRender = getDefaultBoard();
    captures = [];
    for (let i = 0; i < Math.min(moveNum + 1, localGameState.movesLog.length); i++) {
        const move = localGameState.movesLog.at(i)!;
        moveOnBoard(boardToRender, move.fromRow, move.fromCol, move.toRow, move.toCol, move.isTile, move.promotions);

        // append captured pieces
        if (move.oldPiece.color !== PieceColor.NONE) {
            captures.push(move.oldPiece);
        }
    }
    updateCaptures(captures);
    renderFullBoard();
}
function updateMovePointer(delta: number): void {
    const present = localGameState.movesLog.length - 1;
    if (movePointer === Number.POSITIVE_INFINITY) movePointer = present;

    movePointer = Math.min(present, Math.max(movePointer + delta, 0));
    scrollToMove(movePointer);
    boldMovePointer(movePointer);

    // if we skip to max or step to the latest, then exit scrolling mode
    if (movePointer === present) {
        movePointer = Number.POSITIVE_INFINITY;
        boardToRender = localGameState.board;
    }
}
const backwardButton = document.getElementById('backward')! as HTMLButtonElement;
backwardButton.addEventListener('click', () => updateMovePointer(-1));
const forwardButton = document.getElementById('forward')! as HTMLButtonElement;
forwardButton.addEventListener('click', () => updateMovePointer(1));
const backwardAllButton = document.getElementById('backwardAll')! as HTMLButtonElement;
backwardAllButton.addEventListener('click', () => updateMovePointer(Number.NEGATIVE_INFINITY));
const forwardAllButton = document.getElementById('forwardAll')! as HTMLButtonElement;
forwardAllButton.addEventListener('click', () => updateMovePointer(Number.POSITIVE_INFINITY));

