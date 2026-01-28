import { Piece, PieceColor, PieceType, Move } from '../shared/types.js'
const knightMoves = [[-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1]];
const bishopDirections = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
const rookDirections = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const kingQueenDirections = bishopDirections.concat(rookDirections);

export function formatMinSec(time: number, decimals=0): string {
    return `${Math.floor(time/60)}:${(time % 60).toFixed(decimals).padStart(decimals === 0 ? 2 : 3 + decimals, '0')}`
}
export function oppositeColor(c1: PieceColor, c2: PieceColor) {
    // returns true if one is black and the other is white. False if either is empty
    return (c1 === PieceColor.WHITE && c2 === PieceColor.BLACK) || (c1 === PieceColor.BLACK && c2 === PieceColor.WHITE)
}
export function sameColor(c1: PieceColor, c2: PieceColor) {
    // returns true if they're both black or both white. False if either is empty
    // !sameColor returns true if it's empty, or if they're opposite colors (capture)
    return (c1 !== PieceColor.NONE && c1 === c2)
}
export function col0ToFile(colNum0: number) {
    return String.fromCharCode(97 + colNum0);
}

export function findKing(playerColor: PieceColor, board: Piece[][]): [row: number, col: number] {
    // TODO: I should probably just track the location of the king, because this runs a lot...

    let row: number;
    let col: number;
    for (row = 0; row < 8; row++) {
        for (col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece.type === PieceType.KING && piece.color === playerColor) {
                return [row, col];
            }
        }
    }
    return [-1, -1];  // this should really never happen...
}

export function getPieceChar(piece: Piece, isCapture: boolean, fromCol: number): string {
    // arguments are only used for pawn moves. Can set to anything if you're sure it's not a pawn
    return piece.type === PieceType.PAWN ? (isCapture ? col0ToFile(fromCol) : '') : (piece.type === PieceType.KNIGHT ? 'N' : PieceType[piece.type][0]);
}

export function getPiecesOnTile(row: number, col: number, board: Piece[][]): Piece[] {
    // order is clockwise starting from the bottom left
    return [board[row][col], 
            board[row+1][col],
            board[row+1][col+1], 
            board[row][col+1]];
}
export function setPiecesOnTile(row: number, col: number, board: Piece[][], pieces: Piece[]): void {
    // order is clockwise starting from the bottom left
    board[row][col] = pieces[0];
    board[row+1][col] = pieces[1];
    board[row+1][col+1] = pieces[2];
    board[row][col+1] = pieces[3];
}
export function rotateTileOnBoard(fromRow: number, fromCol: number, toRow: number, toCol: number, board: Piece[][], reverse: boolean): void {
    // mutates board
    let rotation: number;
    const pieces = getPiecesOnTile(fromRow, fromCol, board);
    if (toRow % 2 && toCol % 2) {
        rotation = 2;
    } else if (toRow % 2) {
        rotation = reverse ? 1 : 3;
    } else if (toCol % 2) {
        rotation = reverse ? 3 : 1;
    } else {
        rotation = 0;
    }
    setPiecesOnTile(fromRow, fromCol, board, pieces.slice(rotation).concat(pieces.slice(0, rotation)));
}
export function swapTilesOnBoard(fromRow: number, fromCol: number, toRow: number, toCol: number, board: Piece[][]): void {
    // mutates board
    let temp = getPiecesOnTile(toRow, toCol, board);
    setPiecesOnTile(toRow, toCol, board, getPiecesOnTile(fromRow, fromCol, board));
    setPiecesOnTile(fromRow, fromCol, board, temp);
}

export function inCheck(playerColor: PieceColor, board: Piece[][]): boolean {
    if (playerColor === PieceColor.NONE) {
        console.error("Invalid player color for checking for check")
        return false;
    }

    const [kingRow, kingCol] = findKing(playerColor, board);
    if (kingRow < 0 || kingCol < 0) {
        console.error(`Could not find king of color ${playerColor}`);
        return false;
    }


    // check for knight checks
    for (const knightMove of knightMoves) {
        const toRow = kingRow + knightMove[0];
        const toCol = kingCol + knightMove[1];
        if (toRow >= 0 && toRow <= 7 && toCol >= 0 && toCol <= 7) {
            const piece = board[toRow][toCol];
            if (piece.type === PieceType.KNIGHT && piece.color !== playerColor) {
                return true;
            }
        }
    }

    // check for other checks, first bishop/queen, then rook/queen
    const pieceTypesList = [[PieceType.BISHOP, PieceType.QUEEN], [PieceType.ROOK, PieceType.QUEEN]];
    const directionsList = [bishopDirections, rookDirections];
    for (let list = 0; list < 2; list++) {
        for (const direction of directionsList[list]) {
            for (let i = 1; i <= 7; i++) {
                const toRow = kingRow + i*direction[0];
                const toCol = kingCol + i*direction[1];
                if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7 || playerColor === board[toRow][toCol].color) {
                    // walked off the board or into a friendly piece
                    break;
                } 
                const piece = board[toRow][toCol]
                if (piece.type !== PieceType.EMPTY) {
                    // found a piece! If it's an enemy piece of the right type, return true, otherwise end search in this direction
                    if (pieceTypesList[list].includes(piece.type) && oppositeColor(playerColor, piece.color)) {
                        return true;
                    }
                    break;
                }

            }
        }
    }

    return false;
}

export function moveNotation(oldPiece: Piece, newPiece: Piece, fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[], isCheck: boolean, enPassant: boolean): string {
    // check notation
    const check = isCheck ? '+' : '';
    
    // castle notation
    let castle = '';
    if (newPiece.type === PieceType.KING && fromCol === 4) {
        if (toCol === 2) {
            castle = 'O-O-O';
        } else if (toCol === 6) {
            castle = 'O-O';
        }
    }

    // promotion notation
    let promotionNotation = '';
    for (const promo of promotions) {
        promotionNotation += `${isTile ? col0ToFile(promo.col) : ''}=${getPieceChar(promo.piece, false, promo.col)}`
    }

    // put it together
    let notation: string;
    if (isTile) {
        notation = `T${col0ToFile(fromCol)}${fromRow+1}${col0ToFile(toCol)}${toRow+1}${promotionNotation}${check}`;
    } else {
        const capture = (!enPassant && oldPiece.type === PieceType.EMPTY) ? '' : 'x';
        const pieceChar = getPieceChar(newPiece, capture === 'x', fromCol);
        notation = castle === '' ? `${pieceChar}${capture}${col0ToFile(toCol)}${toRow+1}${promotionNotation}${check}` : castle;
    }

    return notation;
}


export function checkCastle(board: Piece[][], QW: boolean, KW: boolean, QB: boolean, KB: boolean): [boolean, boolean, boolean, boolean] {
    // keep track of if castling is allowed by just checking if the pieces aren't there
    // call like this: 
    // [this.QW, this.KW, this.QB, this.KB] = this.checkCastle(this.board, this.QW, this.KW, this.QB, this.KB);
    if (board[0][0].type !== PieceType.ROOK || board[0][0].color !== PieceColor.WHITE) QW = false;
    if (board[0][7].type !== PieceType.ROOK || board[0][7].color !== PieceColor.WHITE) KW = false;
    if (board[0][4].type !== PieceType.KING || board[0][4].color !== PieceColor.WHITE) {QW = false; KW = false;}
    if (board[7][0].type !== PieceType.ROOK || board[7][0].color !== PieceColor.BLACK) QB = false;
    if (board[7][7].type !== PieceType.ROOK || board[7][7].color !== PieceColor.BLACK) KB = false;
    if (board[0][4].type !== PieceType.KING || board[0][4].color !== PieceColor.WHITE) {QB = false; KB = false;}    

    return [QW, KW, QB, KB];
}

export function moveOnBoard(board: Piece[][], fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]): {oldPiece: Piece, newPiece: Piece, enPassant: boolean}{
    // Move the piece
    let oldPiece: Piece;
    let newPiece: Piece;
    if (isTile) {
        oldPiece = {type: PieceType.TILE, color: PieceColor.NONE};
        newPiece = {type: PieceType.TILE, color: PieceColor.NONE};
        if (toRow % 2 || toCol % 2) {
            rotateTileOnBoard(fromRow, fromCol, toRow, toCol, board, false);
        } else {
            swapTilesOnBoard(fromRow, fromCol, toRow, toCol, board);
        }
    } else {
        oldPiece = board[toRow][toCol];
        newPiece = board[fromRow][fromCol];
        board[toRow][toCol] = newPiece;
        board[fromRow][fromCol] = {type: PieceType.EMPTY, color: PieceColor.NONE};
    }

    // handle promotions
    promotions.forEach(promo => {
        board[promo.row][promo.col] = promo.piece;
    });

    // detect en passant and remove the captured pawn
    const enPassant = newPiece.type === PieceType.PAWN && fromCol !== toCol && oldPiece.type === PieceType.EMPTY
    if (enPassant){
        board[fromRow][toCol] = { type: PieceType.EMPTY, color: PieceColor.NONE };
    }

    // detect castle (king moves twice) and move the rook. It should be guaranteed to be there by the canCastle stuff
    const castling = newPiece.type === PieceType.KING && Math.abs(fromCol - toCol) === 2
    if (castling) {
        const castleRow = newPiece.color === PieceColor.WHITE ? 0 : 7;
        if (fromCol > toCol) {
            // queenside, move a
            board[castleRow][3] = board[castleRow][0];
            board[castleRow][0] = { type: PieceType.EMPTY, color: PieceColor.NONE };
        } else {
            board[castleRow][5] = board[castleRow][7];
            board[castleRow][7] = { type: PieceType.EMPTY, color: PieceColor.NONE };
        }
    }


    return {oldPiece: oldPiece, newPiece: newPiece, enPassant: enPassant};
}

export function checkPromotion(board: Piece[][], fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean): {row: number, col: number, piece: Piece}[] {
    const piece = isTile ? { type: PieceType.TILE, color: PieceColor.NONE } : board[fromRow][fromCol];

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

export function tileHasPieces(row: number, col: number, board: Piece[][]): boolean {
    const pieces = getPiecesOnTile(row, col, board);
    return pieces.some(tilePiece => tilePiece.type !== PieceType.EMPTY);
}


export function tileCanMove(row: number, col: number, board: Piece[][], enemyColor: PieceColor): boolean {
    const pieces = getPiecesOnTile(row, col, board);
    return !pieces.some(tilePiece => tilePiece.type === PieceType.KING || oppositeColor(enemyColor, tilePiece.color));
}


export function getValidMoves(board: Piece[][], fromRow: number, fromCol: number, isTile: boolean, tileColorFallback: PieceColor, returnFirst: boolean, lastMove: Move | undefined, QW: boolean, KW: boolean, QB: boolean, KB: boolean): { toRow: number, toCol: number, isTile: boolean }[] {
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
            const hasPieces = tileHasPieces(fromRow, fromCol, board);
            if (tileCanMove(fromRow, fromCol, board, tileColorFallback)) {
                // rotations of this tile
                if (hasPieces) {
                    pushValidIfNotCheck(fromRow+1, fromCol, true, false);
                    pushValidIfNotCheck(fromRow+1, fromCol+1, true, false);
                    pushValidIfNotCheck(fromRow, fromCol+1, true, false);
                }

                // swap with orthogonal directions
                for (const direction of rookDirections) {
                    const toRow = fromRow + 2*direction[0];
                    const toCol = fromCol + 2*direction[1];
                    if (toRow >= 0 && toRow <= 7 && toCol >= 0 && toCol <= 7 && (hasPieces || tileHasPieces(toRow, toCol, board)) && tileCanMove(toRow, toCol, board, tileColorFallback)) {
                        pushValidIfNotCheck(toRow, toCol, true, true);
                    }
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
            if (((piece.color === PieceColor.WHITE && fromRow === 4) || (piece.color === PieceColor.BLACK && fromRow === 3)) && lastMove) {
                // the last pawn must be in an adjacent column, have moved two rows, and have moved to the correct row (white: 4, black: 5)
                if (lastMove.newPiece.type === PieceType.PAWN && Math.abs(fromCol - lastMove.toCol) === 1 && Math.abs(lastMove.fromRow - lastMove.toRow) === 2 
                        && ((lastMove.newPiece.color === PieceColor.WHITE && lastMove.toRow === 3) || (lastMove.newPiece.color === PieceColor.BLACK && fromRow === 4))) {
                    pushValidIfNotCheck(toRow, lastMove.toCol); 
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
                    if (KW 
                            && board[0][5].type === PieceType.EMPTY && board[0][6].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 0, 4, 0, 5, false)) {
                        pushValidIfNotCheck(0, 6);
                    }
                    if (QW 
                            && board[0][1].type === PieceType.EMPTY && board[0][2].type === PieceType.EMPTY && board[0][3].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 0, 4, 0, 3, false)) {
                        pushValidIfNotCheck(0, 2);
                    }
                } else {
                    if (KB 
                            && board[7][5].type === PieceType.EMPTY && board[7][6].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 7, 4, 7, 5, false)) {
                        pushValidIfNotCheck(7, 6);
                    }
                    if (QB
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

export function anyValidMoves(playerColor: PieceColor, board: Piece[][], lastMove: Move | undefined): boolean {
    if (playerColor === PieceColor.NONE) {
        //console.error("Invalid player color for checking for moves")
        return true;
    }

    // note on castling: if castling is a valid move, then so is moving the king. Therefore, we don't need to check it here

    let row: number;
    let col: number;

    // piece moves
    for (row = 0; row < 8; row++) {
        for (col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece.color === playerColor) {
                if (getValidMoves(board, row, col, false, playerColor, true, lastMove, false, false, false, false).length > 0) return true;
            }
        }
    }

    // tile moves
    for (row = 0; row < 8; row += 2) {
        for (col = 0; col < 8; col += 2) {
            if (getValidMoves(board, row, col, true, playerColor, true, lastMove, false, false, false, false).length > 0) return true;
        }
    }

    return false;
}