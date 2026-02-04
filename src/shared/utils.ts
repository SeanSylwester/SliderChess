import { Piece, PieceColor, PieceType, Move, Rules } from '../shared/types.js'
const knightMoves = [[-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1]];
const bishopDirections = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
const rookDirections = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const kingQueenDirections = bishopDirections.concat(rookDirections);

export function formatMinSec(time: number, decimals=0): string {
    return `${Math.floor(time/60)}:${(time % 60).toFixed(decimals).padStart(decimals === 0 ? 2 : 3 + decimals, '0')}`
}
export function oppositeColor(c1: PieceColor, c2: PieceColor): boolean {
    // returns true if one is black and the other is white. False if either is empty
    return (c1 === PieceColor.WHITE && c2 === PieceColor.BLACK) || (c1 === PieceColor.BLACK && c2 === PieceColor.WHITE)
}
export function sameColor(c1: PieceColor, c2: PieceColor): boolean {
    // returns true if they're both black or both white. False if either is empty
    // !sameColor returns true if it's empty, or if they're opposite colors (capture)
    return (c1 !== PieceColor.NONE && c1 === c2)
}
export function col0ToFile(colNum0: number): string {
    return String.fromCharCode(97 + colNum0);
}
export function fileToCol0(file: string): number {
    return file.charCodeAt(0) - 97;
}
export function pieceTypeFromChar(char: string): PieceType {
    switch (char) {
        case 'N':
            return PieceType.KNIGHT;
        case 'B':
            return PieceType.BISHOP;
        case 'R':
            return PieceType.ROOK;
        case 'Q':
            return PieceType.QUEEN;
        case 'K':
            return PieceType.KING;
        case 'T':
            return PieceType.TILE;
    }
    if (char.match(/[a-h]/)) return PieceType.PAWN;

    return PieceType.EMPTY;
}
export function charFromPieceType(pieceType: PieceType): string {
    switch (pieceType) {
        case PieceType.PAWN:
            return 'P'
        case PieceType.KNIGHT:
            return 'N';
        case PieceType.BISHOP:
            return 'B';
        case PieceType.ROOK:
            return 'R';
        case PieceType.QUEEN:
            return 'Q';
        case PieceType.KING:
            return 'K';
        case PieceType.TILE:
            return 'T';
    }
    return '';
}

export function getFENish(board: Piece[][], currentTurn: PieceColor, QW: boolean, KW: boolean, QB: boolean, KB: boolean ): string {
    let s = '';
    let spaces = 0;
    let piece: Piece;
    let pieceChar: string;
    for (let row = 7; row >= 0; row--) {
        for (let col = 0; col < 8; col++) {
            piece = board[row][col];
            if (piece.type === PieceType.EMPTY) {
                spaces++;
            } else {
                if (spaces) {
                    s += spaces.toString();
                }
                spaces = 0;
                
                pieceChar = charFromPieceType(piece.type);
                s += piece.color === PieceColor.WHITE ? pieceChar : pieceChar.toLowerCase();
            }
        }
        if (spaces) {
            s += spaces.toString();
        }
        spaces = 0;
        if (row) {
            s += '/'
        }
    }

    s += ` ${currentTurn === PieceColor.WHITE ? 'w' : 'b'} `

    if (KW) s += 'K';
    if (QW) s += 'Q';
    if (KB) s += 'k';
    if (QB) s += 'q';

    return s
}

export function getDefaultBoard(): Piece[][] {
    // note: the column order looks flipped because the rows are upside down. a1 is the top left of this array, but ends up bottom left.
    return [
        [{ type: PieceType.ROOK, color: PieceColor.WHITE }, { type: PieceType.KNIGHT, color: PieceColor.WHITE }, { type: PieceType.BISHOP, color: PieceColor.WHITE }, { type: PieceType.QUEEN, color: PieceColor.WHITE }, { type: PieceType.KING, color: PieceColor.WHITE }, { type: PieceType.BISHOP, color: PieceColor.WHITE }, { type: PieceType.KNIGHT, color: PieceColor.WHITE }, { type: PieceType.ROOK, color: PieceColor.WHITE }],
        [{ type: PieceType.PAWN, color: PieceColor.WHITE }, { type: PieceType.PAWN, color: PieceColor.WHITE }, { type: PieceType.PAWN, color: PieceColor.WHITE }, { type: PieceType.PAWN, color: PieceColor.WHITE }, { type: PieceType.PAWN, color: PieceColor.WHITE }, { type: PieceType.PAWN, color: PieceColor.WHITE }, { type: PieceType.PAWN, color: PieceColor.WHITE }, { type: PieceType.PAWN, color: PieceColor.WHITE }],
        [{ type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }],
        [{ type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }],
        [{ type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }],
        [{ type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }, { type: PieceType.EMPTY, color: PieceColor.NONE }],
        [{ type: PieceType.PAWN, color: PieceColor.BLACK }, { type: PieceType.PAWN, color: PieceColor.BLACK }, { type: PieceType.PAWN, color: PieceColor.BLACK }, { type: PieceType.PAWN, color: PieceColor.BLACK }, { type: PieceType.PAWN, color: PieceColor.BLACK }, { type: PieceType.PAWN, color: PieceColor.BLACK }, { type: PieceType.PAWN, color: PieceColor.BLACK }, { type: PieceType.PAWN, color: PieceColor.BLACK }],
        [{ type: PieceType.ROOK, color: PieceColor.BLACK }, { type: PieceType.KNIGHT, color: PieceColor.BLACK }, { type: PieceType.BISHOP, color: PieceColor.BLACK }, { type: PieceType.QUEEN, color: PieceColor.BLACK }, { type: PieceType.KING, color: PieceColor.BLACK }, { type: PieceType.BISHOP, color: PieceColor.BLACK }, { type: PieceType.KNIGHT, color: PieceColor.BLACK }, { type: PieceType.ROOK, color: PieceColor.BLACK }],
    ];
}

export function getMovesFromNotation(notationString: string): string[] | string {
    // this will try to skip numbers (like 1.) and will fail on any other notation it doesn't recognize
    // first, replace newlines with spaces
    const noN = notationString.trim().replace(/\n/g, ' ');

    // then split by spaces
    const movesAndNums = noN.split(' ');

    // then, walk through trying to parse each move
    const moveRe = /^(?<move>[a-h1-8xTKQRBNO=-]+)[+#]?$/;
    const numRe = /^\d*\.?/
    const moves: string[] = [];
    for (const moveOrNum of movesAndNums) {
        const match = moveRe.exec(moveOrNum.trim());
        if (match === null) {
            if (!numRe.exec(moveOrNum.trim())) {
                return `Notation parsing failed, and it does not seem to be a move number: ${moveOrNum}`;
            } else {
                continue
            }
        }
        moves.push(match.groups!.move);
    }

    return moves
}

export function getBoardFromMessage(notationString: string, newBoard: Piece[][]): {movesLog: Move[], color: PieceColor, QW: boolean, KW: boolean, QB: boolean, KB: boolean, halfmoveClock: number, mapFEN: Map<string, number>} | string {
    const moves = getMovesFromNotation(notationString);
    if (typeof(moves) === 'string') {
        return moves;
    }

    let QW = true;
    let KW = true;
    let QB = true;
    let KB = true;
    let halfmoveClock = 0;
    const mapFEN = new Map<string, number>();
    const fen = getFENish(newBoard, PieceColor.WHITE, QW, KW, QB, KB);
    mapFEN.set(fen, 1);
    let movesLog: Move[] = [];

    // now do all the moves on a new board with no movement rules
    const rules: Rules = {
        ruleMoveOwnKing: true,
        ruleMoveOwnKingInCheck: true,
        ruleMoveOpp: true,
        ruleMoveOppKing: true,
        ruleMoveOppCheck: true,
        ruleDoubleMovePawn: true,
        ruleCastleNormal: false,
        ruleCastleMoved: false,
        ruleEnPassantTile: false,
        ruleEnPassantTileHome: false,
        ruleIgnoreAll: true,  // ignore all rules and hope for the best
    }

    const promoRe = /=(?<piece>[QRBN])/;
    const tilePromoRe = /(?<col>[a-h])=(?<piece>[QRBN])/g;  // there could be 2
    const tileRe = /^T(?<fromCol>[a-h])(?<fromRow>[1-8])(?<toCol>[a-h])(?<toRow>[1-8])/
    const pieceToRe = /(?<col>[a-h])(?<row>[1-8])$/; // always the last 2
    const pieceFromRe = /[NBRQK]?(?<col>[a-h]?)(?<row>[1-8]?)$/; // x and last 2 characters removed first!
    let color = PieceColor.WHITE;
    for (const move of moves) {
        if (move[0] === 'O') {
            const row = color === PieceColor.WHITE ? 0 : 7;
            let rookFromCol: number;
            let rookToCol: number;
            let kingFromCol = 4;
            let kingToCol: number;
            if (move === 'O-O') {
                rookFromCol = 7;
                rookToCol = 5;
                kingToCol = 6;
            } else if (move === 'O-O-O') {
                rookFromCol = 0;
                rookToCol = 3;
                kingToCol = 2;
            } else {
                return `Failed to parse castle: ${move}`;
            }
            newBoard[row][kingFromCol] = { type: PieceType.EMPTY, color: PieceColor.NONE };
            newBoard[row][rookFromCol] = { type: PieceType.EMPTY, color: PieceColor.NONE };
            newBoard[row][kingToCol] = { type: PieceType.KING, color: color };
            newBoard[row][rookToCol] = { type: PieceType.ROOK, color: color };
            movesLog.push({oldPiece: { type: PieceType.EMPTY, color: PieceColor.NONE },
                           newPiece: { type: PieceType.KING, color: color },
                           fromRow: row, fromCol: 4, toRow: row, toCol: kingToCol, notation: move, isTile: false, promotions: []});
        } else if (move[0] === 'T') {
            // guaranteed to be like Ta1c1 or Ta1b1, possibly with promotion
            const matchTile = tileRe.exec(move);
            if (!matchTile) {
                return `Failed to parse tile move: ${move}`;
            }
            // all are required, so if there's a match then all of these will be here
            const fromCol = fileToCol0(matchTile.groups!.fromCol);
            const fromRow = Number(matchTile.groups!.fromRow) - 1;
            const toCol = fileToCol0(matchTile.groups!.toCol);
            const toRow = Number(matchTile.groups!.toRow) - 1;

            if (Math.max(fromCol, fromRow, toCol, toRow) > 7 || Math.min(fromCol, fromRow, toCol, toRow) < 0 || fromRow % 2 || fromCol % 2) {
                return `Parsed tile move invalid: ${move}`;
            }

            // do the move
            if (toRow % 2 || toCol % 2) {
                rotateTileOnBoard(fromRow, fromCol, toRow, toCol, newBoard, false);
            } else {
                swapTilesOnBoard(fromRow, fromCol, toRow, toCol, newBoard);
            }

            // handle promotions (could be 2)
            const promotions: {row: number, col: number, piece: Piece}[] = [];
            if (move.includes('=')) {
                const promos = [...move.matchAll(tilePromoRe)];
                if (!promos) {
                    return `Failed to parse tile move with promotion: ${move}`;
                }
                for (const promo of promos) {
                    const promoRow = ((toRow - toRow % 2) === 6 || fromRow === 6) ? 7 : 0;
                    const promoCol = fileToCol0(promo.groups!.col)
                    newBoard[promoRow][promoCol] = {type: pieceTypeFromChar(promo.groups!.piece), color: color};
                    promotions.push({ row: promoRow, col: promoCol, piece: newBoard[promoRow][promoCol] })
                }
            }
            movesLog.push({oldPiece: { type: PieceType.TILE, color: PieceColor.NONE },
                           newPiece: { type: PieceType.TILE, color: PieceColor.NONE },
                           fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: move, isTile: true, promotions: promotions});
        } else {
            const pieceType = pieceTypeFromChar(move[0]);
            // can ignore the capture completely
            let moveNoX = move.replace(/x/g, '');

            // strip out the promotion for now, read it from move later
            if (moveNoX.includes('=')) {
                moveNoX = moveNoX.substring(0, moveNoX.indexOf('='))
            }
            // Ng1f3 Ngf3 N1f3 Nf3 
            // e5 ed5
            
            // destination is always the last 2
            const matchTo = moveNoX.match(pieceToRe);
            let toRow: number;
            let toCol: number;
            if (matchTo) {
                toRow = Number(matchTo.groups!.row) - 1;
                toCol = fileToCol0(matchTo.groups!.col);
            } else {
                return `Failed to parse piece move destination: ${move}`;
            }

            // parse what we can from the string before the destination
            // Ng1 Ng N1 N
            // '' e
            let parsedFromCol: number | null = null;
            let parsedFromRow: number | null = null;
            if (pieceType === PieceType.PAWN) {
                if (moveNoX.length === 3) {
                    parsedFromCol = fileToCol0(moveNoX[0]);
                } else if (moveNoX.length !== 2) {
                    return `Failed to parse pawn move: ${move}`;
                }
            } else {
                const matchFrom = moveNoX.substring(0, moveNoX.length-2).match(pieceFromRe);
                if (!matchFrom) {
                    return `Failed to parse piece move source: ${move}`;
                }
                parsedFromCol = matchFrom.groups!.col ? fileToCol0(matchFrom.groups!.col) : null;
                parsedFromRow = matchFrom.groups!.row ? Number(matchFrom.groups!.row) - 1 : null;    
            }


            // find pieces that can move here
            const possiblePieces = getPiecesThatCanReach(toRow, toCol, pieceType, color, newBoard, undefined);
            if (!possiblePieces) {
                return `Couldn't find a valid piece to move to this spot ${move}`;
            }

            let foundOne = false;
            let fromRow: number;
            let fromCol: number;
            for (const possiblePiece of possiblePieces) {
                if ((parsedFromRow && parsedFromRow !== possiblePiece.fromRow) || (parsedFromCol && parsedFromCol !== possiblePiece.fromCol)) {
                    continue
                }
                if (foundOne) {
                    return `Found 2 or more pieces that could move to this spot ${move}`;
                }
                foundOne = true;
                fromRow = possiblePiece.fromRow;
                fromCol = possiblePiece.fromCol;
            }
            if (!foundOne) {
                return `None of the possible pieces match the notation ${move}`;
            }
            const oldPiece = newBoard[fromRow!][fromCol!];
            if (pieceType === PieceType.PAWN && oldPiece.type === PieceType.EMPTY) {
                // TODO: en passant
            }
            newBoard[fromRow!][fromCol!] = { type: PieceType.EMPTY, color: PieceColor.NONE };
            newBoard[toRow][toCol] =  {type: pieceType, color: color};

            // handle promotion
            const matchPromo = promoRe.exec(move);
            let promotions: {row: number, col: number, piece: Piece}[] = [];
            if (matchPromo) {
                newBoard[toRow][toCol] = { type: pieceTypeFromChar(matchPromo.groups!.piece), color: color };
                promotions.push({ row: toRow, col: toCol, piece: newBoard[toRow][toCol] });
            }
            movesLog.push({oldPiece: oldPiece, newPiece: newBoard[toRow][toCol], fromRow: fromRow!, fromCol: fromCol!, 
                           toRow: toRow, toCol: toCol, notation: move, isTile: false, promotions: promotions});
        }
        color = color === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;
        [QW, KW, QB, KB] = checkCastle(newBoard, QW, KW, QB, KB, rules);

        // keep track of half-moves for the 50 move rule if no capture or pawn move
        const oldPiece = movesLog.at(-1)!.oldPiece;
        const newPiece = movesLog.at(-1)!.newPiece;
        if ((oldPiece.type !== PieceType.EMPTY && oldPiece.type !== PieceType.TILE) || newPiece.type === PieceType.PAWN) {
            halfmoveClock = 0;
        } else {
            halfmoveClock += 1;
        }

        // keep track of the number of times we've been in each position for 3 fold repetition
        const fen = getFENish(newBoard, PieceColor.WHITE, QW, KW, QB, KB);
        if (mapFEN.has(fen)) {
            mapFEN.set(fen, mapFEN.get(fen)! + 1)
        } else {
            mapFEN.set(fen, 1);
        }
    }

    return {movesLog, color, QW, KW, QB, KB, halfmoveClock, mapFEN};
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

export function getPieceChar(piece: Piece, fromCol: number): string {
    // arguments are only used for pawn moves. Can set to anything if you're sure it's not a pawn
    return piece.type === PieceType.PAWN ? '' : (piece.type === PieceType.KNIGHT ? 'N' : PieceType[piece.type][0]);
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
                    // check for king checks for all directions, but only on i=1
                    if ((pieceTypesList[list].includes(piece.type) || (i === 1 && piece.type === PieceType.KING)) && oppositeColor(playerColor, piece.color)) {
                        return true;
                    }
                    break;
                }
                
            }
        }
    }

    // check for pawn checks
    const pawnAttackRow = kingRow + (playerColor === PieceColor.WHITE ? 1 : -1);
    if (pawnAttackRow >= 0 && pawnAttackRow <= 7) {
        const pawnAttackCols = [kingCol + 1, kingCol - 1];
        for (const pawnAttackCol of pawnAttackCols) {
            if (pawnAttackCol >= 0 && pawnAttackCol <= 7 && 
                    board[pawnAttackRow][pawnAttackCol].type === PieceType.PAWN && 
                    oppositeColor(playerColor, board[pawnAttackRow][pawnAttackCol].color)) {
                return true;
            }
        }
    }

    return false;
}

export function pawnOnHomeRow(color: PieceColor, row: number): boolean {
    if (color === PieceColor.NONE) return false;
    return row === (color === PieceColor.WHITE ? 1 : 6);
}

export function pieceCanMoveTo(fromRow: number, fromCol: number, toRow: number, toCol: number, board: Piece[][], lastMove: Move | undefined): boolean {
    // this function ignores checks. Don't use it in getValidMoves() or the rules may cause an infinite loop!
    const piece = board[fromRow][fromCol];

    if (fromRow === toRow && fromCol === toCol) return true;

    // make sure it's not your own piece!
    if (board[toRow][toCol].color === piece.color) return false;

    // quick check on direction and number of steps to rule out the obvious 
    const steps = [Math.abs(fromRow - toRow), Math.abs(fromCol - toCol)].sort();
    switch (piece.type) {
        case PieceType.TILE:
            console.error("Don't call pieceCanMoveTo() on tiles!");
            return false;

        case PieceType.PAWN:
            const direction = (piece.color === PieceColor.WHITE) ? 1 : -1;
            const dCol = Math.abs(fromCol - toCol);
            // reject if it's not (1 row ahead and <=1 change in col OR 2 rows ahead in the same column if we're starting from the home row)
            if (!(toRow === fromRow + direction && dCol <= 1
                 || (toRow === fromRow + 2*direction && dCol === 0 && pawnOnHomeRow(piece.color, fromRow)))) return false;
            break;

        case PieceType.KNIGHT:
            // must have [+-1, +-2]. Nothing to check after this
            if (steps[0] !== 1 || steps[1] !== 2) return false;
            else return true;

        case PieceType.BISHOP:
            if (steps[0] !== steps[1]) return false;
            break;

        case PieceType.ROOK:
            if (steps[0] !== 0) return false;
            break;

        case PieceType.KING:
            // 1 step in any direction, or 2 steps on the home row from column 4 to either 2 or 6
            const kingHomeRow = piece.color === PieceColor.WHITE ? 0 : 7;
            if (!(steps[1] === 1 || (steps[1] === 2 && fromRow === kingHomeRow && toRow === kingHomeRow && fromCol == 4 && [2, 6].includes(toCol)))) return false;
            break;

        case PieceType.QUEEN:
            if (steps[0] !== steps[1] && steps[0] !== 0) return false;
            break;

        default:
            console.error(`Invalid piece type ${PieceType[piece.type]} (from ${fromRow}, ${fromCol}) for pieceCanMoveTo()`);
            return false;
    }

    // now we know that if we walk in the right direction, we'll eventually hit the target if nothing is in the way
    if (piece.type === PieceType.PAWN) {
        const direction = (piece.color === PieceColor.WHITE) ? 1 : -1;
        
        if (toRow === fromRow + direction) {
            // one row forward, check moving forward or capturing diagonally
            // moving: make sure it's empty
            if (fromCol === toCol && board[toRow][toCol].type !== PieceType.EMPTY) return false;

            // direct captures
            for (const colOffset of [-1, 1]) {
                if (toCol === fromCol + colOffset && !oppositeColor(piece.color, board[toRow][toCol].color)) {
                    // it was a diagonal move but it wasn't a direct capture, check for en passant
                    // must be in the correct row (white: 5, black: 4), and there must have been a last move
                    if (((piece.color === PieceColor.WHITE && fromRow !== 4) || (piece.color === PieceColor.BLACK && fromRow !== 3)) || !lastMove) return false;

                    // the last pawn must be in an adjacent column, have moved two rows, and have moved to the correct row (white: 4, black: 5)
                    if (lastMove.newPiece.type !== PieceType.PAWN || Math.abs(fromCol - lastMove.toCol) !== 1 || Math.abs(lastMove.fromRow - lastMove.toRow) !== 2 
                            || ((lastMove.newPiece.color === PieceColor.WHITE && lastMove.toRow !== 3) || (lastMove.newPiece.color === PieceColor.BLACK && fromRow !== 4))) return false;
                }
            }

                    
        } else if (toRow === fromRow + 2*direction && fromCol === toCol){
            // also check 2 squares forward if we're in the starting position and the next square is empty
            // TODO: make pawn double move rule work
            if (!pawnOnHomeRow(piece.color, fromRow)) return false;
            if (board[toRow][fromCol].type !== PieceType.EMPTY) return false;
            if (board[fromRow + direction][fromCol].type !== PieceType.EMPTY) return false;
        } else {
            console.error(`Messed up checking pawn move from (${fromRow}, ${fromCol}) to (${toRow}, ${toCol})`)
            return false;
        }
        return true;
    } else {
        // bishop, rook, king, queen
        const dirRow = Math.sign(toRow - fromRow);
        const dirCol = Math.sign(toCol - fromCol);

        for (let i = 1; i <= steps[1]; i++) {
            const testRow = fromRow + i*dirRow;
            const testCol = fromCol + i*dirCol;
            if (testRow === toRow && testCol === toCol) return true;
            if (board[testRow][testCol].type !== PieceType.EMPTY) return false;
        }

        console.error(`Error in pieceCanMoveTo: didn't walk into the target square... ${PieceType[piece.type]} from (${fromRow}, ${fromCol}) to (${toRow}, ${toCol})`);
        return false;
    }
}

export function getPiecesThatCanReach(toRow: number, toCol: number, pieceType: PieceType, color: PieceColor, board: Piece[][], lastMove: Move | undefined): {fromRow: number, fromCol: number}[] {
    const spots: {fromRow: number, fromCol: number}[] = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (row === toRow && col === toCol) continue
            const piece = board[row][col];
            if (piece.type === pieceType && piece.color === color && pieceCanMoveTo(row, col, toRow, toCol, board, lastMove)) {
                spots.push({ fromRow: row, fromCol: col });
            }
        }
    }

    return spots;
}

export function pieceGivingCheck(kingColor: PieceColor, row: number, col: number, board: Piece[][]): boolean {
    const [kingRow, kingCol] = findKing(kingColor, board);
    return pieceCanMoveTo(row, col, kingRow, kingCol, board, undefined);  // don't care about en passant for this, so lastMove isn't needed
}

export function getMoveDisambiguationStr(fromRow: number, fromCol: number, toRow: number, toCol: number, pieceType: PieceType, pieceColor: PieceColor, board: Piece[][]): string {
    let sameRow = false;
    let sameCol = false;
    const otherFroms = getPiecesThatCanReach(toRow, toCol, pieceType, pieceColor, board, undefined);
    if (otherFroms.length <= 1) return '';  // no disambiguation needed

    for (const otherFrom of otherFroms) {
        // skip the piece that's moving
        if (otherFrom.fromRow === fromRow && otherFrom.fromCol === fromCol) continue;

        if (otherFrom.fromRow === fromRow) sameRow = true;
        if (otherFrom.fromCol === fromCol) sameCol = true;
    }
    // if different column than all others, use that
    // if column matches, but we have a unique row, then use that
    // if all else fails, use both
    const disambiguation = (!sameCol) ? `${col0ToFile(fromCol)}`
                         : (!sameRow) ? `${fromRow+1}` 
                         : `${col0ToFile(fromCol)}${fromRow+1}`;

    return disambiguation;
}

export function moveNotation(oldPiece: Piece, newPiece: Piece, fromRow: number, fromCol: number, toRow: number, toCol: number, disambiguation: string, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[], isCheck: boolean, enPassant: boolean): string {
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
        promotionNotation += `${isTile ? col0ToFile(promo.col) : ''}=${getPieceChar(promo.piece, promo.col)}`
    }

    // put it together
    let notation: string;
    if (isTile) {
        notation = `T${col0ToFile(fromCol)}${fromRow+1}${col0ToFile(toCol)}${toRow+1}${promotionNotation}${check}`;
    } else {
        const capture = (!enPassant && oldPiece.type === PieceType.EMPTY) ? '' : 'x';
        const pieceChar = getPieceChar(newPiece, fromCol);
        notation = castle === '' ? `${pieceChar}${disambiguation}${capture}${col0ToFile(toCol)}${toRow+1}${promotionNotation}${check}` : castle;
    }

    return notation;
}


export function checkCastle(board: Piece[][], QW: boolean, KW: boolean, QB: boolean, KB: boolean, rules: Rules): [boolean, boolean, boolean, boolean] {
    // TODO: make castling rules work

    // keep track of if castling is allowed by just checking if the pieces aren't there
    // call like this: 
    // [this.QW, this.KW, this.QB, this.KB] = this.checkCastle(this.board, this.QW, this.KW, this.QB, this.KB);
    if (board[0][0].type !== PieceType.ROOK || board[0][0].color !== PieceColor.WHITE) QW = false;
    if (board[0][7].type !== PieceType.ROOK || board[0][7].color !== PieceColor.WHITE) KW = false;
    if (board[0][4].type !== PieceType.KING || board[0][4].color !== PieceColor.WHITE) {QW = false; KW = false;}
    if (board[7][0].type !== PieceType.ROOK || board[7][0].color !== PieceColor.BLACK) QB = false;
    if (board[7][7].type !== PieceType.ROOK || board[7][7].color !== PieceColor.BLACK) KB = false;
    if (board[7][4].type !== PieceType.KING || board[7][4].color !== PieceColor.BLACK) {QB = false; KB = false;}    

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
    // Note: this will accidentally remove pawns in "ignore all rules" mode. Ignoring this for now because it's so niche, but I added a check to make sure that it's at least a pawn of the other color
    const enPassant = newPiece.type === PieceType.PAWN && fromCol !== toCol && oldPiece.type === PieceType.EMPTY 
                    && oppositeColor(newPiece.color, board[fromRow][toCol].color) && board[fromRow][toCol].type === PieceType.PAWN;
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

export function checkPromotion(board: Piece[][], fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean): {row: number, col: number}[] {
    const piece = isTile ? { type: PieceType.TILE, color: PieceColor.NONE } : board[fromRow][fromCol];

    let promotions: { row: number, col: number }[] = [];
    if (isTile) {
        const isRotation = toRow % 2 || toCol % 2;
        if ([0, 6].includes(fromRow) || (!isRotation && [0, 6].includes(toRow))) {
            if (isRotation) rotateTileOnBoard(fromRow, fromCol, toRow, toCol, board, false);
            else swapTilesOnBoard(fromRow, fromCol, toRow, toCol, board);

            for (const testCol of [fromCol, fromCol+1]) {
                const testRow = (fromRow === 0 || toRow === 0) ? 0 : 7;
                const piece = board[testRow][testCol];
                if (piece.type === PieceType.PAWN && piece.color === (testRow === 0 ? PieceColor.BLACK : PieceColor.WHITE)) {
                    promotions.push({ row: testRow, col: testCol });
                }
            }
            
            if (isRotation) rotateTileOnBoard(fromRow, fromCol, toRow, toCol, board, true);
            else swapTilesOnBoard(fromRow, fromCol, toRow, toCol, board);
        }
    } else if (piece.type === PieceType.PAWN && ((piece.color === PieceColor.WHITE && toRow === 7) || (piece.color === PieceColor.BLACK && toRow === 0))) {
        promotions.push({ row: toRow, col: toCol });
    }

    return promotions;
}


export function wouldBeInCheck(playerColor: PieceColor, board: Piece[][], fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean): boolean {
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


export function tileCanMove(row: number, col: number, board: Piece[][], playerColor: PieceColor, isInCheck: boolean, rules: Rules): boolean {
    // make sure we're targetting a tile
    row -= row % 2;
    col -= col % 2;

    // TODO: make tile moving rules work
    const pieces = getPiecesOnTile(row, col, board);
    for (const [idx, piece] of pieces.entries()) {
        // disallow moving own king
        if (rules.ruleMoveOwnKing && piece.type === PieceType.KING && sameColor(piece.color, playerColor)) return false;

        // disallow moving own king but only in check
        if (rules.ruleMoveOwnKingInCheck && isInCheck && piece.type === PieceType.KING && sameColor(piece.color, playerColor)) return false;

        // disallow moving opponent pieces
        if (rules.ruleMoveOpp && oppositeColor(piece.color, playerColor)) return false;

        // disallow moving opponent's king
        if (rules.ruleMoveOppKing && piece.type === PieceType.KING && oppositeColor(piece.color, playerColor)) return false;

        // disallow moving a piece that's giving check
        if (rules.ruleMoveOppCheck && oppositeColor(piece.color, playerColor)) {
            // [0, 0], [1, 0], [1, 1], [0, 1]
            const pieceRow = row + ([1, 2].includes(idx) ? 1 : 0);
            const pieceCol = col + ([2, 3].includes(idx) ? 1 : 0);
            if (pieceGivingCheck(playerColor, pieceRow, pieceCol, board)) return false;
        }
    }
    return true;
}


export function getValidMoves(board: Piece[][], fromRow: number, fromCol: number, isTile: boolean, tileColorFallback: PieceColor, returnFirst: boolean, lastMove: Move | undefined, QW: boolean, KW: boolean, QB: boolean, KB: boolean, rules: Rules): { toRow: number, toCol: number, isTile: boolean }[] {
    const piece = isTile ? { type: PieceType.TILE, color: tileColorFallback } : board[fromRow][fromCol];
    let validMoves: { toRow: number, toCol: number, isTile: boolean }[] = [];

    // need to check every possible move for if we'd be (still) in check afterwards
    const isInCheck = inCheck(isTile ? tileColorFallback : piece.color, board);
    function pushValidIfNotCheck(toRow: number, toCol: number, isTile=false, markAsTile=false): void {
        if (!wouldBeInCheck(piece.color, board, fromRow, fromCol, toRow, toCol, isTile)) {
            validMoves.push({ toRow: toRow, toCol: toCol, isTile: markAsTile });
        }
    }

    switch (piece.type) {
        case PieceType.TILE:
            // first, check if we can move this piece at all (no kings or piece of different color)
            const hasPieces = tileHasPieces(fromRow, fromCol, board);
            if (tileCanMove(fromRow, fromCol, board, tileColorFallback, isInCheck, rules)) {
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
                    if (toRow >= 0 && toRow <= 7 && toCol >= 0 && toCol <= 7 
                            && (hasPieces || tileHasPieces(toRow, toCol, board)) 
                            && tileCanMove(toRow, toCol, board, tileColorFallback, isInCheck, rules)) {
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
                // TODO: make pawn double move rule work
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
            // TODO: make castling rules work
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
            console.error(`Invalid piece type ${PieceType[piece.type]} (from ${fromRow}, ${fromCol}) for getValidMoves()`);
            return [];
    }
    return validMoves;
}

export function anyValidMoves(playerColor: PieceColor, board: Piece[][], lastMove: Move | undefined, rules: Rules): boolean {
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
                if (getValidMoves(board, row, col, false, playerColor, true, lastMove, false, false, false, false, rules).length > 0) return true;
            }
        }
    }

    // tile moves
    for (row = 0; row < 8; row += 2) {
        for (col = 0; col < 8; col += 2) {
            if (getValidMoves(board, row, col, true, playerColor, true, lastMove, false, false, false, false, rules).length > 0) return true;
        }
    }

    return false;
}