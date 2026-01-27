import { GameState, PieceType, Piece, PieceColor, MESSAGE_TYPES } from "../shared/types.js";
import { sendMessage, sendChat } from "./client.js";
import { sameColor, oppositeColor, col0ToFile, inCheck, findKing } from '../shared/utils.js'

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
const piecesImg = document.getElementById("piecesSpriteSheet") as HTMLImageElement;
const fillStyles = ["#f0d9b5", "#b58863"]; // light and dark squares
let flip = false;
let localGameState: GameState | null = null;
let myColor = PieceColor.NONE;
let selectedSquare: {row: number, col: number} | null = null;
let validSquares: {toRow: number, toCol: number}[] | null = null;
const knightMoves = [[-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1]];
const bishopDirections = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
const rookDirections = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const kingQueenDirections = bishopDirections.concat(rookDirections);


export function initLocalGameState(gameState: GameState, yourColor: PieceColor): void {
    localGameState = gameState;
    myColor = yourColor;
    if (myColor === PieceColor.WHITE) {
        flip = false;
    } else if (myColor === PieceColor.BLACK) {
        flip = true;
    }

    document.getElementById('gameIdDisplay')!.textContent = `${gameState.id}`;
    updateNames(gameState.playerWhiteName, gameState.playerBlackName, gameState.spectatorNames);
    updateTimes(gameState.timeLeftWhite, gameState.timeLeftBlack, gameState.initialTimeWhite, gameState.initialTimeBlack, gameState.incrementWhite, gameState.incrementBlack);
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
    document.getElementById('whitePlayerInfo')!.textContent = playerWhiteName ? playerWhiteName : '';
    (document.getElementById('claimWhite')! as HTMLButtonElement).disabled = (playerWhiteName !== null);

    document.getElementById('blackPlayerInfo')!.textContent = playerBlackName ? playerBlackName : '';
    (document.getElementById('claimBlack')! as HTMLButtonElement).disabled = (playerBlackName !== null);

    document.getElementById('spectatorInfo')!.textContent = spectatorNames.join(', ');
}
export function updateTimes( timeLeftWhite?: number, timeLeftBlack?: number, initialTimeWhite?: number, initialTimeBlack?: number, incrementWhite?: number, incrementBlack?: number): void {
    if (!localGameState) {
        return;
    }
    // TODO
}
export function updateChat(chatLog: string[]): void {
    if (!localGameState) {
        return;
    }
    localGameState.chatLog.push(...chatLog);
    chatLog.forEach(msg => {
        chatLogElement.value += "\n" + msg;
    })
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
    console.log(`Clicked on row ${Math.floor(event.offsetY / pitch)}, col ${Math.floor((event.offsetX - textSpace) / pitch)}`);
    // transmute to unflipped row/col index, which matches the board[row][col]
    if (flip) {
        col = 7 - Math.floor((event.offsetX - textSpace) / pitch);
        row = Math.floor(event.offsetY / pitch);
    } else {
        col = Math.floor((event.offsetX - textSpace) / pitch);
        row = 7 - Math.floor(event.offsetY / pitch);
    }


    const piece = localGameState.board[row][col];
    console.log(`Clicked on ${col0ToFile(col)}${row+1}: ${PieceColor[piece.color]} ${PieceType[piece.type]}`);

    if (selectedSquare === null) {
        // selecting a new piece
        const piece = localGameState.board[row][col];
        if (piece.color === myColor) {
            selectedSquare = {row, col};
            validSquares = getValidMoves(localGameState.board, row, col);
            highlightSquare(row, col, "rgb(255 0 0 / 75%)");
            validSquares.forEach(square => {
                highlightSquare(square.toRow, square.toCol, "rgb(255 0 0 / 25%)");
            })
        } 
    } else {
        // try to move piece if we think it's valid. If it's not my turn or it's an invalid move, the server will reject it. Regardless, clear the highlight
        if (validSquares?.some(square => square.toRow === row && square.toCol === col)) {
            requestMovePiece(selectedSquare.row, selectedSquare.col, row, col);
        }
        drawSquare(selectedSquare.row, selectedSquare.col);
        if (validSquares) {
            validSquares.forEach(square => {
                drawSquare(square.toRow, square.toCol);
            })
        }
        selectedSquare = null;
        validSquares = null;

        // redo the last move highligh
        highlightLastMove();
    }
}

export function wouldBeInCheck(playerColor: PieceColor, board: Piece[][], fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // TODO: I don't know if mutating the board is okay here
    const temp = board[toRow][toCol];
    board[toRow][toCol] = board[fromRow][fromCol];
    board[fromRow][fromCol] = {type: PieceType.EMPTY, color: PieceColor.NONE};
    const check = inCheck(playerColor, board);
    board[fromRow][fromCol] = board[toRow][toCol];
    board[toRow][toCol] = temp;

    return check;
}

export function getValidMoves(board: Piece[][], fromRow: number, fromCol: number, returnFirst=false): { toRow: number, toCol: number }[] {
    const piece = board[fromRow][fromCol];
    let validMoves: { toRow: number, toCol: number }[] = [];

    // need to check every possible move for if we'd be (still) in check afterwards
    function pushValidIfNotCheck(toRow: number, toCol: number): void {
        if (piece.type === PieceType.KING) {
            console.log(`Found potential move from ${fromRow}, ${fromCol} to ${toRow}, ${toCol}`);
        }
        if (!wouldBeInCheck(piece.color, board, fromRow, fromCol, toRow, toCol)) {
            if (piece.type === PieceType.KING) {
                console.log("And we wouldn't be in check :)");
            }
            validMoves.push({ toRow: toRow, toCol: toCol });
        }
    }

    switch (piece.type) {
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
                            && !wouldBeInCheck(PieceColor.WHITE, board, 0, 4, 0, 5)) {
                        pushValidIfNotCheck(0, 6);
                    }
                    if (localGameState!.canCastleQueensideWhite 
                            && board[0][1].type === PieceType.EMPTY && board[0][2].type === PieceType.EMPTY && board[0][3].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 0, 4, 0, 3)) {
                        pushValidIfNotCheck(0, 2);
                    }
                } else {
                    if (localGameState!.canCastleKingsideBlack 
                            && board[7][5].type === PieceType.EMPTY && board[7][6].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 7, 4, 7, 5)) {
                        pushValidIfNotCheck(7, 6);
                    }
                    if (localGameState!.canCastleQueensideBlack
                            && board[7][1].type === PieceType.EMPTY && board[7][2].type === PieceType.EMPTY && board[7][3].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 7, 4, 7, 3)) {
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
            if (piece.color === playerColor && getValidMoves(board, row, col, true).length > 0) {
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
export function drawSquare(row: number, col: number, piece?: Piece): void {  
    let x: number;
    let y: number;  
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
function highlightSquare(row: number, col: number, style: string): void {
    //console.log(`Highlighting square at row ${row+1}, col ${col+1}`);
    if (flip) {
        col = 7 - col;
    } else {
        row = 7 - row;
    }
    ctx.strokeStyle = style;
    ctx.lineWidth = 2;
    const avoidGhost = 1;
    ctx.strokeRect(col * pitch + textSpace + ctx.lineWidth/2 + avoidGhost, row * pitch + ctx.lineWidth/2 + avoidGhost, 
                   pitch - ctx.lineWidth - 2*avoidGhost, pitch - ctx.lineWidth - 2*avoidGhost);
}
function highlightLastMove(): void {
    if (!localGameState || localGameState.movesLog.length === 0) {
        console.log('No last move to highlight');
        return;
    }
    
    const localLastMove = localGameState.movesLog.at(-1)!;
    highlightSquare(localLastMove.fromRow, localLastMove.fromCol, "rgb(0 255 0 / 75%)");
    highlightSquare(localLastMove.toRow, localLastMove.toCol, "rgb(0 255 0 / 75%)");
}
function clearLastMoveHighlight(): void {
    if (!localGameState || localGameState.movesLog.length === 0) {
        console.log('No last move to clear');
        return;
    }
    const localLastMove = localGameState.movesLog.at(-1)!;
    drawSquare(localLastMove.fromRow, localLastMove.fromCol);
    drawSquare(localLastMove.toRow, localLastMove.toCol);
}

const movesLogElement = document.getElementById('movesLog') as HTMLTextAreaElement;
function updateMovesLog(oldPiece:Piece, newPiece: Piece, fromRow: number, fromCol: number, toRow: number, toCol: number, notation: string, checkmate: boolean, stalemate: boolean): void {
    if (!localGameState) {
        console.error("No local game state to log move to");
        return;
    }
    localGameState.movesLog.push({oldPiece: oldPiece, newPiece: newPiece, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: notation});
    
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


export function requestMovePiece(fromRow: number, fromCol: number, toRow: number, toCol: number): void {
    sendMessage({ type: MESSAGE_TYPES.MOVE_PIECE, data: { fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol } });
}
export function movePiece(fromRow: number, fromCol: number, toRow: number, toCol: number, notation: string): void {
    if (!localGameState) {
        console.error("No local game state to move piece on");
        return;
    }
    // TODO: detect castling here? like if king moves 2 spaces then also move the rook?
    const oldPiece = localGameState.board[toRow][toCol];
    const newPiece = localGameState.board[fromRow][fromCol];
    localGameState.board[toRow][toCol] = newPiece;
    localGameState.board[fromRow][fromCol] = {type: PieceType.EMPTY, color: PieceColor.NONE};

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
            drawSquare(castleRow, 0);
            drawSquare(castleRow, 3, rook);
        } else {
            const rook = localGameState.board[castleRow][7];
            localGameState.board[castleRow][5] = localGameState.board[castleRow][7];
            localGameState.board[castleRow][7] = { type: PieceType.EMPTY, color: PieceColor.NONE };
            drawSquare(castleRow, 7);
            drawSquare(castleRow, 5, rook);
        }
    }


    clearLastMoveHighlight();

    // clear the origin square, then highlight
    drawSquare(fromRow, fromCol);
    highlightSquare(fromRow, fromCol, "rgb(0 255 0 / 75%)");

    // draw the destination square, then highlight
    drawSquare(toRow, toCol, newPiece);
    highlightSquare(toRow, toCol, "rgb(0 255 0 / 75%)");

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
    updateMovesLog(oldPiece, newPiece, fromRow, fromCol, toRow, toCol, notation, checkmate, stalemate)
}