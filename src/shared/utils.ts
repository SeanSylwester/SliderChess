import { Piece, PieceColor, PieceType } from '../shared/types.js'
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
