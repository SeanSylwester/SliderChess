import { GameState, PieceType, Piece, PieceColor, MESSAGE_TYPES, MovePieceMessage, ChatMessage, Rules, RulesMessage, Message } from "../shared/types.js";
import { sendMessage } from "./client.js";
import { col0ToFile, inCheck, formatMinSec, checkCastle, moveOnBoard, checkPromotion, getValidMoves, anyValidMoves, rotateTileOnBoard, swapTilesOnBoard, getPiecesOnTile } from '../shared/utils.js'


// init canvas
const canvas = document.getElementById("board") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
ctx.font = "24px Arial";
ctx.lineWidth = 2;

// click events
function hanelMouseUpEvent(event: MouseEvent): void {
    event.preventDefault();
    if (event.button !== 2) {
        handleClick(event.offsetX, event.offsetY, false);
    }
}
function handleContextMenuEvent(event: MouseEvent): void {
    event.preventDefault();
    handleClick(event.offsetX, event.offsetY, true);
}
function handleMouseMoveEvent(event: MouseEvent): void {
    handleHover(event.offsetX, event.offsetY)
}
function handleTouchMoveEvent(event: TouchEvent): void {
    // prevents scrolling
    event.preventDefault();
    const bcr = canvas.getBoundingClientRect();
    handleHover(event.touches[0].clientX - bcr.x, 
                event.touches[0].clientY - bcr.y);
}

canvas.addEventListener('mouseup', hanelMouseUpEvent);
canvas.addEventListener('contextmenu', handleContextMenuEvent);
canvas.addEventListener('mousemove', handleMouseMoveEvent);
canvas.addEventListener('touchmove', handleTouchMoveEvent);



// Rules
const ruleMoveOwnKing = document.getElementById("ruleMoveOwnKing") as HTMLInputElement;
ruleMoveOwnKing.addEventListener('change', sendRules);
const ruleMoveOwnKingInCheck = document.getElementById("ruleMoveOwnKingInCheck") as HTMLInputElement;
ruleMoveOwnKingInCheck.addEventListener('change', sendRules);
const ruleMoveOpp = document.getElementById("ruleMoveOpp") as HTMLInputElement;
ruleMoveOpp.addEventListener('change', sendRules);
const ruleMoveOppKing = document.getElementById("ruleMoveOppKing") as HTMLInputElement;
ruleMoveOppKing.addEventListener('change', sendRules);
const ruleMoveOppCheck = document.getElementById("ruleMoveOppCheck") as HTMLInputElement;
ruleMoveOppCheck.addEventListener('change', sendRules);
const ruleDoubleMovePawn = document.getElementById("ruleDoubleMovePawn") as HTMLInputElement;
ruleDoubleMovePawn.addEventListener('change', sendRules);
const ruleCastleNormal = document.getElementById("ruleCastleNormal") as HTMLInputElement;
ruleCastleNormal.addEventListener('change', sendRules);
const ruleCastleMoved = document.getElementById("ruleCastleMoved") as HTMLInputElement;
ruleCastleMoved.addEventListener('change', sendRules);
const ruleEnPassantTile = document.getElementById("ruleEnPassantTile") as HTMLInputElement;
ruleEnPassantTile.addEventListener('change', sendRules);
const ruleEnPassantTileHome = document.getElementById("ruleEnPassantTileHome") as HTMLInputElement;
ruleEnPassantTileHome.addEventListener('change', sendRules);
const ruleIgnoreAll = document.getElementById("ruleIgnoreAll") as HTMLInputElement;
ruleIgnoreAll.addEventListener('change', sendRules);
function getRules(): Rules {
    return {ruleMoveOwnKing: ruleMoveOwnKing.checked,
            ruleMoveOwnKingInCheck: ruleMoveOwnKingInCheck.checked,
            ruleMoveOpp: ruleMoveOpp.checked,
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
    sendMessage({type: MESSAGE_TYPES.RULES, rules: getRules() } satisfies RulesMessage);
}
export function updateRules(rules: Rules): void {
    ruleMoveOwnKing.checked = rules.ruleMoveOwnKing;
    ruleMoveOwnKingInCheck.checked = rules.ruleMoveOwnKingInCheck;
    ruleMoveOpp.checked = rules.ruleMoveOpp;
    ruleMoveOppKing.checked = rules.ruleMoveOppKing;
    ruleMoveOppCheck.checked = rules.ruleMoveOppCheck;
    ruleDoubleMovePawn.checked = rules.ruleDoubleMovePawn;
    ruleCastleNormal.checked = rules.ruleCastleNormal;
    ruleCastleMoved.checked = rules.ruleCastleMoved;
    ruleEnPassantTile.checked = rules.ruleEnPassantTile;
    ruleEnPassantTileHome.checked = rules.ruleEnPassantTileHome;
    ruleIgnoreAll.checked = rules.ruleIgnoreAll;

    ruleMoveOwnKingInCheck.disabled = ruleMoveOwnKing.checked;

    ruleMoveOppKing.disabled = ruleMoveOpp.checked;
    ruleMoveOppCheck.disabled = ruleMoveOpp.checked;

    ruleEnPassantTileHome.disabled = ruleEnPassantTile.checked;

    ruleDoubleMovePawn.disabled = true; // TODO
    ruleCastleNormal.disabled = true; // TODO
    ruleCastleMoved.disabled = true; // TODO
    ruleEnPassantTile.disabled = true; // TODO
    ruleEnPassantTileHome.disabled = true; // TODO

    if(localGameState) localGameState.rules = getRules();
}

// UI stuff
const chatLogElement = document.getElementById("chatLog") as HTMLTextAreaElement;

const whitePlayerInfoText = document.getElementById('whitePlayerInfo')!;
const claimWhiteButton = document.getElementById('claimWhite')! as HTMLButtonElement;
const blackPlayerInfoText = document.getElementById('blackPlayerInfo')!;
const claimBlackButton = document.getElementById('claimBlack')! as HTMLButtonElement;
const spectatorInfoText = document.getElementById('spectatorInfo')!;

const movesLogElement = document.getElementById('movesLog') as HTMLTextAreaElement;

export function updateNames(playerWhiteName: string | null, playerBlackName: string | null, spectatorNames: string[]): void {
    if (!localGameState) {
        return;
    }
    whitePlayerInfoText.textContent = playerWhiteName ? playerWhiteName : '';
    claimWhiteButton.disabled = (playerWhiteName !== null);

    blackPlayerInfoText.textContent = playerBlackName ? playerBlackName : '';
    claimBlackButton.disabled = (playerBlackName !== null);

    spectatorInfoText.textContent = spectatorNames.join(', ');
}

export function updateChat(message: string): void {
    if (!localGameState) {
        return;
    }
    localGameState.chatLog.push(message);
    chatLogElement.value += "\n" + message;
    chatLogElement.scrollTop = chatLogElement.scrollHeight;
}

function appendToMovesLog(notation: string): void {
    if (!localGameState) {
        console.error("No local game state to log move to");
        return;
    }
    
    // prep line with move number for a white move
    if (localGameState.movesLog.length % 2 === 1) {
        movesLogElement.value += `${Math.floor(localGameState.movesLog.length/2) + 1}. `;
    } 

    movesLogElement.value += notation;

    // add space or newline to prep for next note
    if (localGameState.movesLog.length % 2 === 0) {
        movesLogElement.value += '\n';
    }  else {
        movesLogElement.value += ' ';
    }
    movesLogElement.scrollTop = movesLogElement.scrollHeight;
}

function redrawMovesLog(): void {
    if (!localGameState) {
        console.error("No local game state to log move to");
        return;
    }
    movesLogElement.value = '';
    localGameState.movesLog.forEach((move, idx) => {
        if (idx % 2 === 0) movesLogElement.value += `${Math.floor(idx/2) + 1}. ${move.notation} `;
        else movesLogElement.value += `${move.notation}\n`;
    })
}



// Time stuff
const initialTimeBottomText = document.getElementById('initialTimeBottom')! as HTMLSpanElement;
const incrementBottomText = document.getElementById('incrementBottom')! as HTMLSpanElement;
const timeLeftBottomText = document.getElementById('timeLeftBottom')! as HTMLSpanElement;
const initialTimeTopText = document.getElementById('initialTimeTop')! as HTMLSpanElement;
const incrementTopText = document.getElementById('incrementTop')! as HTMLSpanElement;
const timeLeftTopText = document.getElementById('timeLeftTop')! as HTMLSpanElement;
const clockPeriod = 100; // in ms
const timerId = setInterval(countClock, clockPeriod);

function countClock(): void {
    if (localGameState?.clockRunning) {
        if (localGameState.currentTurn === PieceColor.WHITE) {
            localGameState.timeLeftWhite -= clockPeriod / 1000;
        } else if (localGameState.currentTurn === PieceColor.BLACK) {
            localGameState.timeLeftBlack -= clockPeriod / 1000;
        }

        if (flip) {
            timeLeftTopText.textContent = formatMinSec(localGameState.timeLeftWhite, 1);
            timeLeftBottomText.textContent = formatMinSec(localGameState.timeLeftBlack, 1);
        } else {
            timeLeftTopText.textContent = formatMinSec(localGameState.timeLeftBlack, 1);
            timeLeftBottomText.textContent = formatMinSec(localGameState.timeLeftWhite, 1);
        }
    }
}

export function updateTimeDisplay(): void{
    if (!localGameState) {
        return;
    }

    if (flip) {
        initialTimeTopText.textContent = formatMinSec(localGameState.initialTimeBlack, 0);
        initialTimeBottomText.textContent = formatMinSec(localGameState.initialTimeWhite, 0);
        incrementTopText.textContent = localGameState.incrementBlack.toString();
        incrementBottomText.textContent = localGameState.incrementWhite.toString();
        timeLeftTopText.textContent = formatMinSec(localGameState.timeLeftBlack, 1);
        timeLeftBottomText.textContent = formatMinSec(localGameState.timeLeftWhite, 1);
    } else {
        initialTimeBottomText.textContent = formatMinSec(localGameState.initialTimeWhite, 0);
        initialTimeTopText.textContent = formatMinSec(localGameState.initialTimeBlack, 0);
        incrementBottomText.textContent = localGameState.incrementWhite.toString();
        incrementTopText.textContent = localGameState.incrementBlack.toString();
        timeLeftBottomText.textContent = formatMinSec(localGameState.timeLeftWhite, 1);
        timeLeftTopText.textContent = formatMinSec(localGameState.timeLeftBlack, 1);
    }
}

export function syncTime( clockRunning: boolean, timeLeftWhite: number, timeLeftBlack: number, initialTimeWhite: number, initialTimeBlack: number, incrementWhite: number, incrementBlack: number): void {
    if (!localGameState) {
        return;
    }
    localGameState.clockRunning = clockRunning;
    localGameState.initialTimeWhite = initialTimeWhite;
    localGameState.initialTimeBlack = initialTimeBlack;
    localGameState.incrementWhite = incrementWhite;
    localGameState.incrementBlack = incrementBlack;
    localGameState.timeLeftWhite = timeLeftWhite;
    localGameState.timeLeftBlack = timeLeftBlack;
    updateTimeDisplay();
}



// drawing the board
let flip = false;
const higlightSpace = 2;
const lineSpace = 1;
const textSpace = 20;
const textMargin = 4;
const boardWidth = canvas.width - textSpace;
const boardHeight = canvas.height - textSpace;
const pitch = Math.floor(boardWidth / 8); // size of each square
const tilePct = 0.2; // percentage of the square on each side for selecting a tile instead
const piecesImg = document.getElementById("piecesSpriteSheet") as HTMLImageElement;
const fillStyles = ["#f0d9b5", "#b58863"]; // light and dark squares
const hoverAlpha = 0.5;  // transparency of pieces when hovering a tile move

export function flipBoard(): void {
    flip = !flip;
    renderFullBoard();
    highlightLastMove();
    updateTimeDisplay();
}
function getXY(unflippedRow: number, unflippedCol: number, isFlip: boolean): {x: number, y: number} {
    // in the flipped view, the columns are reversed because file h is at x=0
    // in the regular view, the rows are reversed because rank 8 is at y=0
    const {row, col} = getFlippedRowCol(unflippedRow, unflippedCol, isFlip);
    return {x: col * pitch + textSpace,
            y: row * pitch + lineSpace}
}

function getFlippedRowCol(unflippedRow: number, unflippedCol: number, isFlip: boolean): {row: number, col: number} {
    // in the flipped view, the columns are reversed because file h is at x=0
    // in the regular view, the rows are reversed because rank 8 is at y=0
    return {col: (isFlip ? 7 - unflippedCol : unflippedCol),
            row: (isFlip ? unflippedRow : 7 - unflippedRow)}
}

export function renderFullBoard(): void {
    if (!localGameState) {
        console.error("No game state to render");
        return;
    }
    // clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw the background
    drawAllBackgroundSquares();

    // draw pieces, bottom to top (rank 1-8), left to right (file a-h)
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            drawPieceRowCol(row, col, localGameState.board[row][col])
        }
    }

    // draw text around edges
    ctx.fillStyle = "black";
    ctx.textAlign = "right";
    for (let row = 0; row < 8; row++) {
        ctx.fillText((flip ? row+1 : 8-row).toString(), textSpace - textMargin, row * pitch + pitch/2 + 6);
    }
    ctx.textAlign = "center";
    for (let col = 0; col < 8; col++) {
        // 97 is 'a'
        ctx.fillText(col0ToFile(flip ? 7-col: col), col * pitch + pitch/2 + textSpace, boardHeight + textMargin);
    }

    // draw tile borders
    drawAllTileBorders();

    ctx.stroke();
}

function drawPieceXY(x: number, y: number, piece: Piece): void {
    if (piece.type !== PieceType.EMPTY) {
        // this relies on the piece.type and piece.color enums being ordered to match the svg
        ctx.drawImage(piecesImg, 45*piece.type, 45*piece.color, 45, 45, x, y, pitch, pitch);
    }
}

function drawPieceRowCol(unflippedRow: number, unflippedCol: number, piece: Piece): void {
    if (piece.type !== PieceType.EMPTY) {
        const {x, y} = getXY(unflippedRow, unflippedCol, flip);
        drawPieceXY(x, y, piece);
    }
}

function drawAllBackgroundSquares(): void {
    let x: number;
    let y: number;

    function drawSquaresQuarter(startRow: number, startCol: number): void {
        for (let row = startRow; row < 8; row += 2) {
            for (let col = startCol; col < 8; col += 2) {
                x = col * pitch + textSpace;
                y = row * pitch + lineSpace;
                ctx.fillRect(x, y, pitch, pitch);
            }
        }
    }

    // light squares
    ctx.fillStyle = fillStyles[0];
    drawSquaresQuarter(0, 0);
    drawSquaresQuarter(1, 1);

    // dark squares
    ctx.fillStyle = fillStyles[1];
    drawSquaresQuarter(0, 1);
    drawSquaresQuarter(1, 0);
}

function drawAllTileBorders(): void {
    ctx.strokeStyle = '#000000';
    for (let row = 0; row < 8; row+=2) {
        for (let col = 0; col < 8; col+=2) {
            drawTileBorder(row, col);
        }
    }
}
function drawTileBorder(unflippedRow: number, unflippedCol: number): void {
    let {row, col} = getFlippedRowCol(unflippedRow, unflippedCol, flip);
    ctx.strokeStyle = '#000000';
    row -= row % 2;
    col -= col % 2;

    const x = col * pitch + textSpace;
    const y = row * pitch + lineSpace;
    ctx.strokeRect(x, y, 2*pitch, 2*pitch);
}

export function drawSquare(unflippedRow: number, unflippedCol: number, isTile: boolean, piece: Piece | null | Piece[], alpha=1): void {  
    //console.log(`(${row}, ${col}), ${isTile}, ${piece}`);
    if (isTile) {
        // force index to the bottom left corner
        unflippedRow -= unflippedRow % 2;
        unflippedCol -= unflippedCol % 2;

        if (Array.isArray(piece)) {
            drawSquare(unflippedRow, unflippedCol, false, piece[0], alpha);
            drawSquare(unflippedRow+1, unflippedCol, false, piece[1], alpha);
            drawSquare(unflippedRow+1, unflippedCol+1, false, piece[2], alpha);
            drawSquare(unflippedRow, unflippedCol+1, false, piece[3], alpha);
        } else {
            drawSquare(unflippedRow, unflippedCol, false, null, alpha);
            drawSquare(unflippedRow+1, unflippedCol, false, null, alpha);
            drawSquare(unflippedRow+1, unflippedCol+1, false, null, alpha);
            drawSquare(unflippedRow, unflippedCol+1, false, null, alpha);
        }
    } else {
        // x and y point to the top left corner of the square (flipped or not)
        const {x, y} = getXY(unflippedRow, unflippedCol, flip);

        // draw square background
        ctx.fillStyle = fillStyles[1 - (unflippedRow + unflippedCol) % 2];
        ctx.fillRect(x, y, pitch, pitch);

        // grab piece from the board, or use the argument
        if (!piece && localGameState) {
            piece = localGameState.board[unflippedRow][unflippedCol];
        }

        // draw piece (if we found one)
        if (piece && !Array.isArray(piece)) {
            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = alpha;
            drawPieceXY(x, y, piece);
            ctx.globalAlpha = prevAlpha;
        }

        // redraw tile border
        drawTileBorder(unflippedRow, unflippedCol);
    }
}

function highlightSquare(unflippedRow: number, unflippedCol: number, style: string, isTile: boolean): void {
    let {row, col} = getFlippedRowCol(unflippedRow, unflippedCol, flip);
    if (isTile) {
        // force draw index to the top left corner
        row -= row % 2;
        col -= col % 2;   
    } 

    ctx.strokeStyle = style;
    ctx.strokeRect(col * pitch + textSpace + ctx.lineWidth/2 + higlightSpace, 
                   row * pitch + ctx.lineWidth/2 + higlightSpace + lineSpace, 
                   (isTile ? 2 : 1)*pitch - ctx.lineWidth - 2*higlightSpace, 
                   (isTile ? 2 : 1)*pitch - ctx.lineWidth - 2*higlightSpace);
}

function highlightLastMove(): void {
    if (!localGameState || localGameState.movesLog.length === 0) {
        return;
    }
    
    const localLastMove = localGameState.movesLog.at(-1)!;
    highlightSquare(localLastMove.fromRow, localLastMove.fromCol, "rgb(0 255 0 / 25%)", localLastMove.isTile);
    highlightSquare(localLastMove.toRow, localLastMove.toCol, "rgb(0 255 0 / 75%)", localLastMove.isTile);
    if (localLastMove.isTile) {
        highlightSquare(localLastMove.fromRow, localLastMove.fromCol, "rgb(0 255 0 / 25%)", false);
        highlightSquare(localLastMove.toRow, localLastMove.toCol, "rgb(0 255 0 / 75%)", false);
    }
}

function clearLastMoveHighlight(): void {
    if (!localGameState || localGameState.movesLog.length === 0) {
        return;
    }
    const localLastMove = localGameState.movesLog.at(-1)!;
    drawSquare(localLastMove.fromRow, localLastMove.fromCol, localLastMove.isTile, null);
    drawSquare(localLastMove.toRow, localLastMove.toCol, localLastMove.isTile, null);
}







// promotion selector
const promoPadding = 8;
const promoPieceSize = pitch - 2 * promoPadding;
const promoPiecesOrder = [PieceType.QUEEN, PieceType.ROOK, PieceType.BISHOP, PieceType.KNIGHT];
const promoBoxWidth = pitch - 2 * promoPadding;
const promoBoxHeight = 4 * pitch - 2 * promoPadding;
const promoDy = promoPieceSize + promoPadding;
const promoBackground = "#d2b08c";
let promoX = 0;
let promoY = 0;
function drawPromotionSelector(unflippedRow: number, unflippedCol: number) {
    const color = unflippedRow === 0 ? PieceColor.BLACK : PieceColor.WHITE
    const {x, y} = getXY(unflippedRow, unflippedCol, flip);
    promoX = x;
    promoY = y;

    const direction = (unflippedRow === 0 && !flip || unflippedRow === 7 && flip) ? -1 : 1
    
    // Draw background box
    ctx.fillStyle = promoBackground;
    ctx.strokeStyle = '#000000';
    if (direction === 1) {
        ctx.fillRect(promoX + promoPadding, promoY + promoPadding, promoBoxWidth, promoBoxHeight);
        ctx.strokeRect(promoX + promoPadding, promoY + promoPadding, promoBoxWidth, promoBoxHeight);
    } else {
        ctx.fillRect(promoX + promoPadding, promoY + pitch - promoPadding, promoBoxWidth, -promoBoxHeight);
        ctx.strokeRect(promoX + promoPadding, promoY + pitch - promoPadding, promoBoxWidth, -promoBoxHeight);
    }
    
    // Draw each promotion option
    promoPiecesOrder.forEach((pieceType, idx) => {
        const promoYi = promoY + promoPadding + direction * idx * pitch;
        
        // this relies on the piece.type and piece.color enums being ordered to match the svg
        ctx.drawImage(piecesImg, 45*pieceType, 45*color, 45, 45, promoX + promoPadding, promoYi, promoPieceSize, promoPieceSize);
    });
}


function waitForPromo(): Promise<PieceType> {
    return new Promise(resolve => {
        // Handle click on the promotion selector
        function handleClickPromotion(event: MouseEvent): void {
            canvas.removeEventListener('mouseup', handleClickPromotion);
            canvas.addEventListener('mouseup', hanelMouseUpEvent);

            canvas.addEventListener('mousemove', handleMouseMoveEvent);
            canvas.addEventListener('contextmenu', handleContextMenuEvent);
            canvas.addEventListener('touchmove', handleTouchMoveEvent);

            const top = promoY !== lineSpace;
            
            // Check if click is within the selector box
            if (event.offsetX < promoX || event.offsetX > promoX + pitch
                || ( top && (event.offsetY > (promoY + pitch) || event.offsetY < promoY - 3 * pitch))
                || (!top && (event.offsetY < promoY || event.offsetY > promoY + 4 * pitch))) {
                // clicked outside of box: return empty
                resolve(PieceType.EMPTY);
            } else {
                if (top) resolve(promoPiecesOrder[Math.floor((promoY + pitch - event.offsetY) / pitch)]);
                else resolve(promoPiecesOrder[Math.floor((event.offsetY - promoY) / promoDy)]);
            }
            
        }

        canvas.removeEventListener('mouseup', hanelMouseUpEvent);
        canvas.addEventListener('mouseup', handleClickPromotion);

        canvas.removeEventListener('mousemove', handleMouseMoveEvent);
        canvas.removeEventListener('contextmenu', handleContextMenuEvent);
        canvas.removeEventListener('touchmove', handleTouchMoveEvent);
        
    });
}






// game logic stuff
const drawButton = document.getElementById('draw') as HTMLButtonElement;
const surrenderButton = document.getElementById('surrender') as HTMLButtonElement;
export let localGameState: GameState | undefined = undefined;
let myColor = PieceColor.NONE;
let selectedSquare: {row: number, col: number, isTile: boolean} | null = null;
let validSquares: ReturnType<typeof getValidMoves> | null;
let hover: {uRow: number, uCol: number, prevWasValid: boolean} | null = null;  // grabs initial hover tile from handleClick, then updated on mousemove from handleHover

export function initLocalGameState(gameState: GameState, yourColor: PieceColor): void {
    localGameState = gameState;
    myColor = yourColor;
    if (myColor === PieceColor.WHITE) {
        flip = false;
        drawButton.disabled = false;
        surrenderButton.disabled = false;
    } else if (myColor === PieceColor.BLACK) {
        flip = true;
        drawButton.disabled = false;
        surrenderButton.disabled = false;
    } else {
        drawButton.disabled = true;
        surrenderButton.disabled = true;
    }

    document.getElementById('gameIdDisplay')!.textContent = `${gameState.id}`;
    updateNames(gameState.playerWhiteName, gameState.playerBlackName, gameState.spectatorNames);
    syncTime(gameState.clockRunning, gameState.timeLeftWhite, gameState.timeLeftBlack, gameState.initialTimeWhite, gameState.initialTimeBlack, gameState.incrementWhite, gameState.incrementBlack);
    chatLogElement.value = gameState.chatLog.join("\n");
    chatLogElement.scrollTop = chatLogElement.scrollHeight;
    redrawMovesLog();
    renderFullBoard();
    highlightLastMove();
    selectedSquare = null;
    validSquares = null;
}

export function clearLocalGameState(): void {
    localGameState = undefined;
    myColor = PieceColor.NONE;
    selectedSquare = null;
    flip = false;
    chatLogElement.value = "";
    // clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function handleClick(offsetX: number, offsetY: number, isRightClick: boolean): Promise<void> {
    if (!localGameState) {
        console.error("No board to get piece from");
        return;
    }
    if (myColor === PieceColor.NONE) {
        return;
    }

    let unflippedCol: number;
    let unflippedRow: number;
    //console.log(`Clicked on row ${Math.floor(event.offsetY / pitch)}, col ${Math.floor((event.offsetX - textSpace) / pitch)}`);
    // transmute to unflipped row/col index, which matches the board[row][col]
    if (flip) {
        unflippedCol = 7 - Math.floor((offsetX - textSpace) / pitch);
        unflippedRow = Math.floor((offsetY - lineSpace) / pitch);
    } else {
        unflippedCol = Math.floor((offsetX - textSpace) / pitch);
        unflippedRow = 7 - Math.floor((offsetY - lineSpace) / pitch);
    }

    const xSquareOffset = (offsetX - textSpace) % pitch;
    const ySquareOffset = (offsetY - 1) % pitch;
    // force isTile if it's a right click, our current selection is a tile, or if we try to highlight an empty square, or if it's along the edge of a square. 
    let isTile = isRightClick || selectedSquare?.isTile 
                        || (!selectedSquare && localGameState.board[unflippedRow][unflippedCol].type === PieceType.EMPTY) 
                        || (xSquareOffset < pitch*tilePct || xSquareOffset > pitch*(1-tilePct)) && (ySquareOffset < pitch*tilePct || ySquareOffset > pitch*(1-tilePct));
    
                        // If the first click wasn't a tile, force this false also
    if (selectedSquare && !selectedSquare.isTile) isTile = false;

    // for tiles, make the selected square the bottom left corner (unless it's a rotation), i.e. make the row and column even, rounding down
    if (isTile) {
        // don't do this correction if it's the second click within the same tile so that we can capture rotation
        if (selectedSquare === null || !selectedSquare.isTile || ![0, 1].includes(unflippedRow - selectedSquare.row) || ![0, 1].includes(unflippedCol - selectedSquare.col)) {
            unflippedRow -= unflippedRow % 2;
            unflippedCol -= unflippedCol % 2;
        }
    }
    //console.log(`(${row}, ${col}) ${isTile}`);

    //const piece = localGameState.board[unflippedRow][unflippedCol];
    //console.log(`Clicked on ${col0ToFile(col)}${row+1}: ${PieceColor[piece.color]} ${PieceType[piece.type]}`);

    if (selectedSquare === null) {
        // selecting a new piece
        if (isTile || localGameState.board[unflippedRow][unflippedCol].color === myColor) {
            selectedSquare = {row: unflippedRow, col: unflippedCol, isTile};
            validSquares = getValidMoves(localGameState.board, unflippedRow, unflippedCol, isTile, myColor, false, localGameState.movesLog.at(-1), localGameState.QW, localGameState.KW, localGameState.QB, localGameState.KB, localGameState.rules);
            // if it's a tile move, start the hover logic
            if (isTile) {
                hover = {uRow: unflippedRow, uCol: unflippedCol, prevWasValid: true};
                handleHover(offsetX, offsetY);
            }

            // also highlight the bottom left corner of the tile
            if (isTile) {
                highlightSquare(unflippedRow, unflippedCol, "rgb(255 0 0 / 75%)", false);
            }

            // highlight the select square/tile
            highlightSquare(unflippedRow, unflippedCol, "rgb(255 0 0 / 75%)", isTile);

            // highlight the valid moves
            validSquares.forEach(square => {
                highlightSquare(square.toRow, square.toCol, "rgb(255 0 0 / 25%)", square.isTile);
            })
        } 
    } else {
        // try to move piece if we think it's valid. If it's an invalid move, the server will reject it. 
        if (localGameState.rules.ruleIgnoreAll || (myColor === localGameState.currentTurn && validSquares?.some(square => square.toRow === unflippedRow && square.toCol === unflippedCol))) {
            // if promotion(s) detected, show the dialog(s) and wait for the user to click
            const promoLocations = checkPromotion(localGameState.board, selectedSquare.row, selectedSquare.col, unflippedRow, unflippedCol, isTile);
            let promos: {row: number; col: number, piece: Piece}[] = [];
            if (promoLocations.length) {
                for (const promo of promoLocations) {
                    drawPromotionSelector(promo.row, promo.col);
                    const pieceType: PieceType = await waitForPromo();
                    if (pieceType !== PieceType.EMPTY) promos.push({row: promo.row, col: promo.col, piece: {type: pieceType, color: myColor}});
                }
                renderFullBoard();
            }
            if (promos.length === promoLocations.length) {
                requestMovePiece(selectedSquare.row, selectedSquare.col, unflippedRow, unflippedCol, isTile, promos);
            }
        }
        hover = null;

        // regardless, clear the highlight
        drawSquare(selectedSquare.row, selectedSquare.col, selectedSquare.isTile, null);
        if (validSquares) {
            validSquares.forEach(square => {
                drawSquare(square.toRow, square.toCol, square.isTile, null);
            })
        }
        selectedSquare = null;
        validSquares = null;

        // redo the last move highlight
        highlightLastMove();

    }
    ctx.stroke();
}

function handleHover(offsetX: number, offsetY: number): void {
    if (!hover || !localGameState || !selectedSquare) return;
    // hover holds the {uRow, uCol} of the corner of the tile

    // get the current square position
    let uCol: number;
    let uRow: number;
    if (flip) {
        uCol = 7 - Math.floor((offsetX - textSpace) / pitch);
        uRow = Math.floor((offsetY - lineSpace) / pitch);
    } else {
        uCol = Math.floor((offsetX - textSpace) / pitch);
        uRow = 7 - Math.floor((offsetY - lineSpace) / pitch);
    }
    
    // only update the hover if we've moved squares
    if ((uRow === hover.uRow && uCol === hover.uCol) || uRow < 0 || uRow > 7 || uCol < 0 || uCol > 7) return;

    // clear previous hover
    if (hover.prevWasValid) {
        drawSquare(selectedSquare!.row, selectedSquare!.col, true, null);  // highlight done later
        drawSquare(hover.uRow, hover.uCol, true, null);
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
    sendMessage({ type: MESSAGE_TYPES.MOVE_PIECE, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, isTile: isTile, promotions: promotions } satisfies MovePieceMessage);
}

export function move(fromRow: number, fromCol: number, toRow: number, toCol: number, notation: string, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]): void {
    if (!localGameState) {
        console.error("No local game state to move piece on");
        return;
    }

    // do the move!
    const {oldPiece, newPiece, enPassant} = moveOnBoard(localGameState.board, fromRow, fromCol, toRow, toCol, isTile, promotions);
    drawSquare(fromRow, fromCol, isTile, null); // redraw origin
    drawSquare(toRow, toCol, isTile, newPiece); // redraw destination

    // check if castling is still allowed
    [localGameState.QW, localGameState.KW, localGameState.QB, localGameState.KB] = checkCastle(localGameState.board, localGameState.QW, localGameState.KW, localGameState.QB, localGameState.KB, localGameState.rules);

    // draw promotions
    for (const promotion of promotions) {
        drawSquare(promotion.row, promotion.col, false, null);
    }

    // detect castle (king moves twice) and draw the rook
    const castling = newPiece.type === PieceType.KING && Math.abs(fromCol - toCol) === 2
    if (castling) {
        const castleRow = newPiece.color === PieceColor.WHITE ? 0 : 7;
        if (fromCol > toCol) {
            // queenside, move a
            drawSquare(castleRow, 0, false, null);
            drawSquare(castleRow, 3, false, null);
        } else {
            drawSquare(castleRow, 7, false, null);
            drawSquare(castleRow, 5, false, null);
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
    if (checkmate || stalemate || localGameState.timeLeftBlack < 0 || localGameState.timeLeftWhite < 0) {
        sendMessage({ type: MESSAGE_TYPES.GAME_OVER } satisfies Message);
    }


    // update the move log text
    appendToMovesLog(notation);
    
    // Update the current turn
    localGameState.currentTurn = (localGameState.currentTurn === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE);

    ctx.stroke();
}
updateRules(getRules()); // call this once to run the disabling logic