import { Piece, PieceColor, PieceType } from '../shared/types.js'
const knightMoves = [[-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1]];
const bishopDirections = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
const rookDirections = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const kingQueenDirections = bishopDirections.concat(rookDirections);

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
    console.log(`Found king at ${kingRow}, ${kingCol}`);


    // check for knight checks
    for (const knightMove of knightMoves) {
        const toRow = kingRow + knightMove[0];
        const toCol = kingCol + knightMove[1];
        if (toRow >= 0 && toRow <= 7 && toCol >= 0 && toCol <= 7) {
            const piece = board[toRow][toCol];
            if (piece.type === PieceType.KNIGHT && piece.color !== playerColor) {
                console.log(`Found check from knight at ${toRow}, ${toCol}`)
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
                        console.log(`Found check from ${PieceType[piece.type]} at ${toRow}, ${toCol}`)
                        return true;
                    }
                    break;
                }

            }
        }
    }

    return false;
}
