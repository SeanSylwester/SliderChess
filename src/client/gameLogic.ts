import { GameState, PieceType, Piece, PieceColor, MESSAGE_TYPES, MovePieceMessage } from "../shared/types.js";
import { sendMessage, sendChat } from "./client.js";
import { sameColor, oppositeColor, col0ToFile, inCheck, findKing, formatMinSec, swapTilesOnBoard, rotateTileOnBoard, getPiecesOnTile, setPiecesOnTile } from '../shared/utils.js'

const canvas = document.getElementById("board") as HTMLCanvasElement;
canvas.addEventListener('click', handleClick);

const chatLogElement = document.getElementById("chatLog") as HTMLTextAreaElement;

const ctx = canvas.getContext("2d")!;
ctx.font = "24px Arial";
const textSpace = 20;
const textMargin = 4;
const canvasWidth = canvas.width - textSpace;
const canvasHeight = canvas.height - textSpace;
const pitch = canvasWidth / 8; // size of each square
const tilePct = 0.2; // percentage of the square on each side for selecting a tile instead
const piecesImg = document.getElementById("piecesSpriteSheet") as HTMLImageElement;
const fillStyles = ["#f0d9b5", "#b58863"]; // light and dark squares
let flip = false;
let localGameState: GameState | null = null;
let myColor = PieceColor.NONE;
let selectedSquare: {row: number, col: number, isTile: boolean} | null = null;
let validSquares: ReturnType<typeof getValidMoves> | null;
const knightMoves = [[-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1]];
const bishopDirections = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
const rookDirections = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const kingQueenDirections = bishopDirections.concat(rookDirections);

const whitePlayerInfoText = document.getElementById('whitePlayerInfo')!;
const claimWhiteButton = document.getElementById('claimWhite')! as HTMLButtonElement;
const blackPlayerInfoText = document.getElementById('blackPlayerInfo')!;
const claimBlackButton = document.getElementById('claimBlack')! as HTMLButtonElement;
const spectatorInfoText = document.getElementById('spectatorInfo')!;

const initialTimeBottomText = document.getElementById('initialTimeBottom')! as HTMLSpanElement;
const incrementBottomText = document.getElementById('incrementBottom')! as HTMLSpanElement;
const timeLeftBottomText = document.getElementById('timeLeftBottom')! as HTMLSpanElement;
const initialTimeTopText = document.getElementById('initialTimeTop')! as HTMLSpanElement;
const incrementTopText = document.getElementById('incrementTop')! as HTMLSpanElement;
const timeLeftTopText = document.getElementById('timeLeftTop')! as HTMLSpanElement;
const clockPeriod = 100; // in ms

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

const timerId = setInterval(countClock, clockPeriod);
const drawButton = document.getElementById('draw') as HTMLButtonElement;
export function initLocalGameState(gameState: GameState, yourColor: PieceColor): void {
    localGameState = gameState;
    myColor = yourColor;
    if (myColor === PieceColor.WHITE) {
        flip = false;
        drawButton.disabled = false;
    } else if (myColor === PieceColor.BLACK) {
        flip = true;
        drawButton.disabled = false;
    } else {
        drawButton.disabled = true;
    }

    document.getElementById('gameIdDisplay')!.textContent = `${gameState.id}`;
    updateNames(gameState.playerWhiteName, gameState.playerBlackName, gameState.spectatorNames);
    syncTime(gameState.clockRunning, gameState.timeLeftWhite, gameState.timeLeftBlack, gameState.initialTimeWhite, gameState.initialTimeBlack, gameState.incrementWhite, gameState.incrementBlack);
    chatLogElement.value = gameState.chatLog.join("\n");
    chatLogElement.scrollTop = chatLogElement.scrollHeight;
    fullMovesLog();
    renderFullBoard();
    highlightLastMove();
}
export function clearLocalGameState(): void {
    localGameState = null;
    myColor = PieceColor.NONE;
    selectedSquare = null;
    flip = false;
    chatLogElement.value = "";
    // clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function updateNames(playerWhiteName: string | null, playerBlackName: string | null, spectatorNames: string[]): void {
    if (!localGameState) {
        return;
    }
    console.log(playerWhiteName);
    whitePlayerInfoText.textContent = playerWhiteName ? playerWhiteName : '';
    claimWhiteButton.disabled = (playerWhiteName !== null);

    blackPlayerInfoText.textContent = playerBlackName ? playerBlackName : '';
    claimBlackButton.disabled = (playerBlackName !== null);

    spectatorInfoText.textContent = spectatorNames.join(', ');
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
export function updateChat(message: string): void {
    if (!localGameState) {
        return;
    }
    localGameState.chatLog.push(message);
    chatLogElement.value += "\n" + message;
    chatLogElement.scrollTop = chatLogElement.scrollHeight;
}

function handleClick(event: MouseEvent): void {
    if (!localGameState) {
        console.error("No board to get piece from");
        return;
    }
    if (myColor === PieceColor.NONE) {
        return;
    }

    let col: number;
    let row: number;
    //console.log(`Clicked on row ${Math.floor(event.offsetY / pitch)}, col ${Math.floor((event.offsetX - textSpace) / pitch)}`);
    // transmute to unflipped row/col index, which matches the board[row][col]
    if (flip) {
        col = 7 - Math.floor((event.offsetX - textSpace) / pitch);
        row = Math.floor(event.offsetY / pitch);
    } else {
        col = Math.floor((event.offsetX - textSpace) / pitch);
        row = 7 - Math.floor(event.offsetY / pitch);
    }

    const xSquareOffset = (event.offsetX - textSpace) % pitch;
    const ySquareOffset = event.offsetY % pitch;
    // force isTile if our current selection is a tile, or if we try to highlight an empty square
    const isTile = selectedSquare?.isTile || (!selectedSquare && localGameState.board[row][col].type === PieceType.EMPTY) 
                        || (xSquareOffset < pitch*tilePct || xSquareOffset > pitch*(1-tilePct)) && (ySquareOffset < pitch*tilePct || ySquareOffset > pitch*(1-tilePct));
    // for tiles, make the selected square the bottom left corner unless it's a rotation, i.e. make the row and column even, rounding down
    if (isTile) {
        // don't do this correction if it's the second click within the same tile
        if (selectedSquare === null || !selectedSquare.isTile || ![0, 1].includes(row - selectedSquare.row) || ![0, 1].includes(col - selectedSquare.col)) {
            row -= row % 2;
            col -= col % 2;
        }
    }
    console.log(`(${row}, ${col}) ${isTile}`);

    const piece = localGameState.board[row][col];
    //console.log(`Clicked on ${col0ToFile(col)}${row+1}: ${PieceColor[piece.color]} ${PieceType[piece.type]}`);

    if (selectedSquare === null) {
        // selecting a new piece
        if (isTile || localGameState.board[row][col].color === myColor) {
            selectedSquare = {row, col, isTile};
            validSquares = getValidMoves(localGameState.board, row, col, isTile, false);
            highlightSquare(row, col, "rgb(255 0 0 / 75%)", isTile, true);
            validSquares.forEach(square => {
                highlightSquare(square.toRow, square.toCol, "rgb(255 0 0 / 25%)", square.isTile);
            })
        } 
    } else {
        // try to move piece if we think it's valid. If it's not my turn or it's an invalid move, the server will reject it. Regardless, clear the highlight
        if (validSquares?.some(square => square.toRow === row && square.toCol === col)) {
            requestMovePiece(selectedSquare.row, selectedSquare.col, row, col, isTile, checkPromotion(localGameState.board, selectedSquare.row, selectedSquare.col, row, col, isTile));
        }
        drawSquare(selectedSquare.row, selectedSquare.col, selectedSquare.isTile);
        if (validSquares) {
            validSquares.forEach(square => {
                drawSquare(square.toRow, square.toCol, square.isTile);
            })
        }
        selectedSquare = null;
        validSquares = null;

        // redo the last move highlight
        highlightLastMove();
    }
}

function checkPromotion(board: Piece[][], fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean): {row: number, col: number, piece: Piece}[] {
    const tileColorFallback = myColor;  // TODO: I need to pass this in if I want this to work as a util
    const piece = isTile ? { type: PieceType.TILE, color: tileColorFallback } : board[fromRow][fromCol];

    let promotions: {row: number, col: number, piece: Piece}[] = [];
    if (isTile) {
        const isRotation = toRow % 2 || toCol % 2;
        if ([0, 6].includes(fromRow) || (!isRotation && [0, 6].includes(toRow))) {
            if (isRotation) rotateTileOnBoard(fromRow, fromCol, toRow, toCol, board, false);
            else swapTilesOnBoard(fromRow, fromCol, toRow, toCol, board);

            for (const testCol of [fromCol, fromCol+1]) {
                const testRow = (fromRow === 0 || toRow === 0) ? 0 : 7;
                const piece = board[testRow][testCol];
                if (piece.type === PieceType.PAWN && piece.color === (testRow === 0 ? PieceColor.BLACK : PieceColor.WHITE)) {
                    promotions.push({row: testRow, col: testCol, piece: {type: PieceType.QUEEN, color: piece.color}});
                }
            }
            
            if (isRotation) rotateTileOnBoard(fromRow, fromCol, toRow, toCol, board, true);
            else swapTilesOnBoard(fromRow, fromCol, toRow, toCol, board);
        }
    } else if (piece.type === PieceType.PAWN && ((piece.color === PieceColor.WHITE && toRow === 7) || (piece.color === PieceColor.BLACK && toRow === 0))) {
        // TODO: choose piece type to promote to
        promotions.push({row: toRow, col: toCol, piece: {type: PieceType.QUEEN, color: piece.color}});
    }

    return promotions;
}

export function wouldBeInCheck(playerColor: PieceColor, board: Piece[][], fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean): boolean {
    // TODO: I don't know if mutating the board is okay here.
    let check: boolean;
    if (isTile) {
        if (toRow % 2 || toCol % 2) {
            rotateTileOnBoard(fromRow, fromCol, toRow, toCol, board, false);
            check = inCheck(playerColor, board);
            rotateTileOnBoard(fromRow, fromCol, toRow, toCol, board, true);
        } else {
            swapTilesOnBoard(fromRow, fromCol, toRow, toCol, board);
            check = inCheck(playerColor, board);
            swapTilesOnBoard(fromRow, fromCol, toRow, toCol, board); 
        }      
    } else {
        const temp = board[toRow][toCol];
        board[toRow][toCol] = board[fromRow][fromCol];
        board[fromRow][fromCol] = {type: PieceType.EMPTY, color: PieceColor.NONE};
        check = inCheck(playerColor, board);
        board[fromRow][fromCol] = board[toRow][toCol];
        board[toRow][toCol] = temp;
    }

    return check;
}

export function getValidMoves(board: Piece[][], fromRow: number, fromCol: number, isTile: boolean, returnFirst: boolean): { toRow: number, toCol: number, isTile: boolean }[] {
    const tileColorFallback = myColor; // TODO: I need to pass this in if I want this to work as a util
    const piece = isTile ? { type: PieceType.TILE, color: tileColorFallback } : board[fromRow][fromCol];
    let validMoves: { toRow: number, toCol: number, isTile: boolean }[] = [];

    // need to check every possible move for if we'd be (still) in check afterwards
    function pushValidIfNotCheck(toRow: number, toCol: number, isTile=false, markAsTile=false): void {
        if (!wouldBeInCheck(piece.color, board, fromRow, fromCol, toRow, toCol, isTile)) {
            validMoves.push({ toRow: toRow, toCol: toCol, isTile: markAsTile });
        }
    }

    switch (piece.type) {
        case PieceType.TILE:
            // first, check if we can move this piece at all (no kings or piece of different color)
            const pieces = getPiecesOnTile(fromRow, fromCol, board);
            const hasPieces = pieces.some(piece => piece.type !== PieceType.EMPTY);
            if (!pieces.some(piece => piece.type === PieceType.KING || oppositeColor(tileColorFallback, piece.color))) {
                // orthogonal directions
                for (const direction of rookDirections) {
                    const toRow = fromRow + 2*direction[0];
                    const toCol = fromCol + 2*direction[1];
                    if (toRow >= 0 && toRow <= 7 && toCol >= 0 && toCol <= 7 ) {
                        const pieces = getPiecesOnTile(toRow, toCol, board);
                        if ((hasPieces || pieces.some(piece => piece.type !== PieceType.EMPTY)) 
                                && !pieces.some(piece => piece.type === PieceType.KING || oppositeColor(tileColorFallback, piece.color))) {
                            pushValidIfNotCheck(toRow, toCol, true, true);
                        }
                    }
                }

                // rotations
                if (hasPieces) {
                    pushValidIfNotCheck(fromRow+1, fromCol, true, false);
                    pushValidIfNotCheck(fromRow+1, fromCol+1, true, false);
                    pushValidIfNotCheck(fromRow, fromCol+1, true, false);
                }
            }
            break;

        case PieceType.PAWN:
            const direction = (piece.color === PieceColor.WHITE) ? 1 : -1;
            
            // check one square forward
            const toRow = fromRow + direction;
            if (toRow >= 0 && toRow <= 7 && board[toRow][fromCol].type === PieceType.EMPTY) {
                pushValidIfNotCheck(toRow, fromCol);
                if (returnFirst && validMoves.length) {return validMoves}

                // also check 2 squares forward if we're in the starting position and the next square is empty
                const toRow2 = fromRow + 2 * direction;
                if (toRow2 >= 0 && toRow2 <= 7
                        && fromRow === (piece.color === PieceColor.WHITE ? 1 : 6)
                        && board[toRow2][fromCol].type === PieceType.EMPTY) {
                    pushValidIfNotCheck(toRow2, fromCol); 
                    if (returnFirst && validMoves.length) {return validMoves}
                }
            }

            // check captures
            for (const colOffset of [-1, 1]) {
                const toCol = fromCol + colOffset;
                if (toRow >= 0 && toRow <= 7 && toCol >= 0 && toCol <= 7 
                        && oppositeColor(piece.color, board[toRow][toCol].color)) {
                    pushValidIfNotCheck(toRow, toCol); 
                    if (returnFirst && validMoves.length) {return validMoves}
                }
            }

            // check for en passant
            // this pawn must be in the correct row (white: 5, black: 4)
            if (((piece.color === PieceColor.WHITE && fromRow === 4) || (piece.color === PieceColor.BLACK && fromRow === 3)) 
                    && localGameState && localGameState.movesLog.length > 0) {
                const localLastMove = localGameState!.movesLog.at(-1)!;
                // the last pawn must be in an adjacent column, have moved two rows, and have moved to the correct row (white: 4, black: 5)
                if (localLastMove.newPiece.type === PieceType.PAWN && Math.abs(fromCol - localLastMove.toCol) === 1 && Math.abs(localLastMove.fromRow - localLastMove.toRow) === 2 
                        && ((localLastMove.newPiece.color === PieceColor.WHITE && localLastMove.toRow === 3) || (localLastMove.newPiece.color === PieceColor.BLACK && fromRow === 4))) {
                    pushValidIfNotCheck(toRow, localLastMove.toCol); 
                }
            }
            

            break;

        case PieceType.KNIGHT:
            for (const knightMove of knightMoves) {
                const toRow = fromRow + knightMove[0];
                const toCol = fromCol + knightMove[1];
                if (toRow >= 0 && toRow <= 7 && toCol >= 0 && toCol <= 7
                        && !sameColor(piece.color, board[toRow][toCol].color)) {
                    pushValidIfNotCheck(toRow, toCol); 
                    if (returnFirst && validMoves.length) {return validMoves}
                }
            }
            break;

        case PieceType.BISHOP:
        case PieceType.ROOK:
        case PieceType.QUEEN:
        case PieceType.KING:
            const directions = piece.type === PieceType.BISHOP ? bishopDirections : (piece.type === PieceType.ROOK ? rookDirections : kingQueenDirections);
            const steps = piece.type === PieceType.KING ? 1 : 7;
            for (const direction of directions) {
                for (let i = 1; i <= steps; i++) {
                    const toRow = fromRow + i*direction[0];
                    const toCol = fromCol + i*direction[1];
                    if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7 || sameColor(piece.color, board[toRow][toCol].color)) {
                        // walked off the board or into a friendly piece
                        break;
                    } 
                    pushValidIfNotCheck(toRow, toCol); 
                    if (returnFirst && validMoves.length) {return validMoves}
                    
                    if (oppositeColor(piece.color, board[toRow][toCol].color)) {
                        // capture! No more valid moves in this direction
                        break;
                    }
                }
            }

            // check for castling
            if (piece.type === PieceType.KING) {
                if (piece.color === PieceColor.WHITE) {
                    if (localGameState!.canCastleKingsideWhite 
                            && board[0][5].type === PieceType.EMPTY && board[0][6].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 0, 4, 0, 5, false)) {
                        pushValidIfNotCheck(0, 6);
                    }
                    if (localGameState!.canCastleQueensideWhite 
                            && board[0][1].type === PieceType.EMPTY && board[0][2].type === PieceType.EMPTY && board[0][3].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 0, 4, 0, 3, false)) {
                        pushValidIfNotCheck(0, 2);
                    }
                } else {
                    if (localGameState!.canCastleKingsideBlack 
                            && board[7][5].type === PieceType.EMPTY && board[7][6].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 7, 4, 7, 5, false)) {
                        pushValidIfNotCheck(7, 6);
                    }
                    if (localGameState!.canCastleQueensideBlack
                            && board[7][1].type === PieceType.EMPTY && board[7][2].type === PieceType.EMPTY && board[7][3].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 7, 4, 7, 3, false)) {
                        pushValidIfNotCheck(7, 2);
                    }
                }
            }

            break;

        default:
            console.error(`Invalid piece type ${PieceType[piece.type]} (from ${fromRow}, ${fromCol}) for validMoves()`);
            return [];
    }
    return validMoves;
}

export function anyValidMoves(playerColor: PieceColor, board: Piece[][]): boolean {
    if (playerColor === PieceColor.NONE) {
        console.error("Invalid player color for checking for moves")
        return true;
    }

    let row: number;
    let col: number;
    for (row = 0; row < 8; row++) {
        for (col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece.color === playerColor && (getValidMoves(board, row, col, false, true).length > 0 || getValidMoves(board, row, col, true, true).length > 0)) {
                return true;
            }
        }
    }

    return false;
}


export function flipBoard(): void {
    flip = !flip;
    renderFullBoard();
    highlightLastMove();
    updateTimeDisplay();
}
export function renderFullBoard(): void {
    if (!localGameState) {
        console.error("No game state to render");
        return;
    }
    // clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw squares and pieces
    let piece: {type: PieceType, color: number};
    let x: number;
    let y: number;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            // draw squares
            if (flip) {
                x = (7 - col) * pitch + textSpace;
                y = (7 - row) * pitch;
            } else {
                x = col * pitch + textSpace;
                y = row * pitch;
            }
            ctx.fillStyle = fillStyles[(row + col) % 2];
            ctx.fillRect(x, y, pitch, pitch);

            // draw pieces (note the flipped row order since rank 1 is on the bottom of the screen)
            piece = localGameState.board[7 - row][col];
            if (piece.type !== PieceType.EMPTY) {
                // this relies on the piece.type and piece.color enums being ordered to match the svg
                ctx.drawImage(piecesImg, 45*piece.type, 45*piece.color, 45, 45, x, y, pitch, pitch);
            }
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
        ctx.fillText(col0ToFile(flip ? 7-col: col), col * pitch + pitch/2 + textSpace, canvasHeight + textMargin);
    }

    ctx.stroke();
}
export function drawSquare(row: number, col: number, isTile: boolean, piece?: Piece): void {  
    //console.log(`(${row}, ${col}), ${isTile}, ${piece}`);
    if (isTile) {
        // patch fix to make sure that tiles are always drawn correctly
        row -= row % 2;
        col -= col % 2;
    }
    let x: number;
    let y: number; 
    if (isTile) {
        drawSquare(row, col, false);
        drawSquare(row+1, col, false);
        drawSquare(row, col+1, false);
        drawSquare(row+1, col+1, false);
    } 
    if (flip) {
        x = (7 - col) * pitch + textSpace;
        y = row * pitch;
    } else {
        x = col * pitch + textSpace;
        y = (7 - row) * pitch;
    }
    ctx.fillStyle = fillStyles[1 - (row + col) % 2];
    ctx.fillRect(x, y, pitch, pitch);

    if (!piece && localGameState) {
        piece = localGameState.board[row][col];
    }
    if (piece) {
        ctx.drawImage(piecesImg, 45*piece.type, 45*piece.color, 45, 45, x, y, pitch, pitch);
    }
    ctx.stroke();
}
function highlightSquare(row: number, col: number, style: string, isTile: boolean, firstTile?: boolean): void {
    //console.log(`Highlighting ${isTile ? 'tile' : 'square'} at row ${row+1}, col ${col+1}`);
    if (isTile) {
        // patch fix to make sure that tiles are always drawn correctly
        row -= row % 2;
        col -= col % 2;
    }

    // avoids re-mapping the row/col on recursive calls
    if (firstTile !== false) {
        if (flip) {
            col = 7 - col;
            if (isTile) col -= 1;
        } else {
            row = 7 - row;
            if (isTile) row -= 1;
        }
    }
    ctx.strokeStyle = style;
    ctx.lineWidth = 2;
    const avoidGhost = 1;
    if (isTile) {
        ctx.strokeRect(col * pitch + textSpace + ctx.lineWidth/2 + avoidGhost, row * pitch + ctx.lineWidth/2 + avoidGhost, 
                    2*pitch - ctx.lineWidth - 2*avoidGhost, 2*pitch - ctx.lineWidth - 2*avoidGhost);
        
        // highlight the bottom left corner of the tile
        if (firstTile) {
            // patch fix to highlight the correct one on the flipped view
            highlightSquare(row + (flip ? 0 : 1), col + (flip ? 1 : 0), 'rgb(255 0 0 / 75%)', false, false);
        }
    } else {
        ctx.strokeRect(col * pitch + textSpace + ctx.lineWidth/2 + avoidGhost, row * pitch + ctx.lineWidth/2 + avoidGhost, 
                    pitch - ctx.lineWidth - 2*avoidGhost, pitch - ctx.lineWidth - 2*avoidGhost);
    }
}
function highlightLastMove(): void {
    if (!localGameState || localGameState.movesLog.length === 0) {
        console.log('No last move to highlight');
        return;
    }
    
    const localLastMove = localGameState.movesLog.at(-1)!;
    highlightSquare(localLastMove.fromRow, localLastMove.fromCol, "rgb(0 255 0 / 75%)", localLastMove.isTile);
    highlightSquare(localLastMove.toRow, localLastMove.toCol, "rgb(0 255 0 / 75%)", localLastMove.isTile);
}
function clearLastMoveHighlight(): void {
    if (!localGameState || localGameState.movesLog.length === 0) {
        console.log('No last move to clear');
        return;
    }
    const localLastMove = localGameState.movesLog.at(-1)!;
    drawSquare(localLastMove.fromRow, localLastMove.fromCol, localLastMove.isTile);
    drawSquare(localLastMove.toRow, localLastMove.toCol, localLastMove.isTile);
}

const movesLogElement = document.getElementById('movesLog') as HTMLTextAreaElement;
function updateMovesLog(oldPiece:Piece, newPiece: Piece, fromRow: number, fromCol: number, toRow: number, toCol: number, notation: string, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[], checkmate: boolean, stalemate: boolean): void {
    if (!localGameState) {
        console.error("No local game state to log move to");
        return;
    }
    localGameState.movesLog.push({oldPiece: oldPiece, newPiece: newPiece, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: notation, isTile: isTile, promotions: promotions});
    
    if (localGameState.movesLog.length % 2 === 1) {
        // prep for white move
        movesLogElement.value += `${Math.floor(localGameState.movesLog.length/2) + 1}. `;
    } 

    movesLogElement.value += notation;

    // TODO: handle these on the server?
    if (checkmate) {
        movesLogElement.value = movesLogElement.value.slice(0, -1) + '#';
    } else if (stalemate) {
        movesLogElement.value += '$';
    }

    if (localGameState.movesLog.length % 2 === 0) {
        movesLogElement.value += '\n';
    }  else {
        movesLogElement.value += ' ';
    }

}
function fullMovesLog(): void {
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


export function requestMovePiece(fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]): void {
    sendMessage({ type: MESSAGE_TYPES.MOVE_PIECE, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, isTile: isTile, promotions: promotions } satisfies MovePieceMessage);
}
export function movePiece(fromRow: number, fromCol: number, toRow: number, toCol: number, notation: string, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]): void {
    if (!localGameState) {
        console.error("No local game state to move piece on");
        return;
    }

    // do the move
    let oldPiece: Piece;
    let newPiece: Piece;
    if (isTile) {
        // TODO: set these to account for castling checks
        oldPiece = {type: PieceType.TILE, color: PieceColor.NONE};
        newPiece = {type: PieceType.TILE, color: PieceColor.NONE};
        if (toRow % 2 || toCol % 2) {
            rotateTileOnBoard(fromRow, fromCol, toRow, toCol, localGameState.board, false);
        } else {
            swapTilesOnBoard(fromRow, fromCol, toRow, toCol, localGameState.board);
        }
        
    } else {
        oldPiece = localGameState.board[toRow][toCol];
        newPiece = localGameState.board[fromRow][fromCol];
        localGameState.board[toRow][toCol] = newPiece;
        localGameState.board[fromRow][fromCol] = {type: PieceType.EMPTY, color: PieceColor.NONE};
    }

    // Update the current turn
    localGameState.currentTurn = (localGameState.currentTurn === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE);

    
    // handle promotions
    promotions.forEach(promo => {
        localGameState!.board[promo.row][promo.col] = promo.piece;
    });

    // keep track of if castling is allowed
    if (newPiece.type === PieceType.ROOK) {
        if (newPiece.color === PieceColor.WHITE) {
            if (fromRow === 0) {
                if (fromCol === 0) localGameState.canCastleQueensideWhite = false;
                else if (fromCol === 7) localGameState.canCastleKingsideWhite = false;
            }
        } else {
            if (fromRow === 7) {
                if (fromCol === 0) localGameState.canCastleQueensideBlack = false;
                else if (fromCol === 7) localGameState.canCastleKingsideBlack = false;
            }
        }
    }
    if (newPiece.type === PieceType.KING) {
        if (newPiece.color === PieceColor.WHITE) {
            localGameState.canCastleQueensideWhite = false;
            localGameState.canCastleKingsideWhite = false;
        } else {
            localGameState.canCastleQueensideBlack = false;
            localGameState.canCastleKingsideBlack = false;
        }  
    }    

    // detect en passant and remove the captured pawn
    const enPassant = newPiece.type === PieceType.PAWN && fromCol !== toCol && oldPiece.type === PieceType.EMPTY
    if (enPassant){
        localGameState.board[fromRow][toCol] = { type: PieceType.EMPTY, color: PieceColor.NONE };
    }
    // detect castle (king moves twice) and move the rook. It should be guaranteed to be there by the this.canCastle stuff
    const castling = newPiece.type === PieceType.KING && Math.abs(fromCol - toCol) === 2
    if (castling) {
        const castleRow = newPiece.color === PieceColor.WHITE ? 0 : 7;
        if (fromCol > toCol) {
            // queenside, move a
            const rook = localGameState.board[castleRow][0];
            localGameState.board[castleRow][3] = localGameState.board[castleRow][0];
            localGameState.board[castleRow][0] = { type: PieceType.EMPTY, color: PieceColor.NONE };
            drawSquare(castleRow, 0, false);
            drawSquare(castleRow, 3, false, rook);
        } else {
            const rook = localGameState.board[castleRow][7];
            localGameState.board[castleRow][5] = localGameState.board[castleRow][7];
            localGameState.board[castleRow][7] = { type: PieceType.EMPTY, color: PieceColor.NONE };
            drawSquare(castleRow, 7, false);
            drawSquare(castleRow, 5, false, rook);
        }
    }


    clearLastMoveHighlight();

    // clear the origin square, then highlight
    drawSquare(fromRow, fromCol, isTile);
    highlightSquare(fromRow, fromCol, "rgb(0 255 0 / 75%)", isTile);

    // draw the destination square, then highlight
    drawSquare(toRow, toCol, isTile);
    highlightSquare(toRow, toCol, "rgb(0 255 0 / 75%)", isTile);

    // check for checkmate/stalemate
    let checkmate = false;
    let stalemate = false;
    if (!anyValidMoves(myColor, localGameState.board)) {
        if (inCheck(myColor, localGameState.board)) {
            sendChat("I'm in checkmate! :(");
            checkmate = true;
        } else {
            sendChat("I'm in stalemate! :|");
            stalemate = true;
        }
    }
    // log the move
    updateMovesLog(oldPiece, newPiece, fromRow, fromCol, toRow, toCol, notation, isTile, promotions, checkmate, stalemate)
}