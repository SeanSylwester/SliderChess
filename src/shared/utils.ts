import { Piece, PieceColor, PieceType, Move, Rules, GameState, GameInfo, GameResultCause } from '../shared/types.js'
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
        case 'P':
            return PieceType.PAWN;  // FEN
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
    if (char.match(/[a-h]/)) return PieceType.PAWN;  // not FEN

    return PieceType.EMPTY;
}
export function charFromPieceType(pieceType: PieceType, isFEN: boolean): string {
    // returns 'E' for PieceType.EMPTY
    return pieceType === PieceType.PAWN   ? (isFEN ? 'P' : '') 
        : (pieceType === PieceType.KNIGHT ? 'N' 
                                          : PieceType[pieceType][0]);
}
export function pieceFromChar(char: string): Piece {
    const charUpper = char.toUpperCase()
    const pieceType = pieceTypeFromChar(charUpper);
    const pieceColor = ['T', 'E'].includes(charUpper) ? PieceColor.NONE : (char === charUpper ? PieceColor.WHITE : PieceColor.BLACK);
    return { type: pieceType, color: pieceColor };
}
export function charFromPiece(piece: Piece, isFEN: boolean): string {
    const pieceChar = charFromPieceType(piece.type, isFEN);
    return piece.color !== PieceColor.BLACK ? pieceChar : pieceChar.toLowerCase();
}

export function getFEN(board: Piece[][], currentTurn: PieceColor, QW: boolean, KW: boolean, QB: boolean, KB: boolean, halfmoveClock: number, fullmoveNumber: number ): {fen: string, fenNoMoves: string} {
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
                
                s += charFromPiece(piece, true);
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
    if (!KW && !QW && !KB && !QB) s += '-'

    // TODO: add en passant
    s += ' -';
    const fenNoMoves = s;

    s += ` ${halfmoveClock} ${fullmoveNumber}`;

    return {fen: s, fenNoMoves: fenNoMoves}
}
export function fenStripMoves(fen: string): string {
    return fen.split(' ').slice(0, -2).join(' ');
}
export function parseFEN(fen: string | undefined): {board: Piece[][], turn: PieceColor, QW: boolean, KW: boolean, QB: boolean, KB: boolean, halfmoveClock: number} {
    const board = getDefaultBoard();
    if (fen === undefined) {
        return {board, turn: PieceColor.WHITE, QW: true, KW: true, QB: true, KB: true, halfmoveClock: 0};
    }

    const [boardStr, turnStr, castleStr, enPassant, halfmoveClockStr, fullmoveNumberStr] = fen.split(' ');
    const turn = turnStr === 'w' ? PieceColor.WHITE : PieceColor.BLACK;
    const KW = castleStr.includes('K');
    const QW = castleStr.includes('Q');
    const KB = castleStr.includes('k');
    const QB = castleStr.includes('q');
    const halfmoveClock = parseInt(halfmoveClockStr)

    let row = 7;
    let col = 0;
    for (const c of boardStr) {
        if (c.match(/[0-8]/)) {
            for (let i = 0; i < parseInt(c); i++) {
                board[row][col++] = { type: PieceType.EMPTY, color: PieceColor.NONE };
            }
        } else if (c === '/') {
            row--;
            col = 0;
        } else {
            board[row][col++] = { type: pieceTypeFromChar(c.toUpperCase()), color: c.match(/[A-Z]/) ? PieceColor.WHITE : PieceColor.BLACK };
        }
    }
    if (row !== 0 || col != 8) {
        console.error('Potential problem parsing FEN:', fen, row, col, board);
    }

    return {board, turn, QW, KW, QB, KB, halfmoveClock};
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

export function splitMovesFromNotation(notationString: string): string[] | string {
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

export function getBoardFromMessage(notationString: string, newBoard: Piece[][], rules: Rules): {movesLog: Move[], color: PieceColor, QW: boolean, KW: boolean, QB: boolean, KB: boolean, halfmoveClock: number, mapFEN: Map<string, number>, arrayFEN: string[]} | string {
    const moves = splitMovesFromNotation(notationString);
    if (typeof(moves) === 'string') {
        return moves;
    }

    let QW = true;
    let KW = true;
    let QB = true;
    let KB = true;
    let halfmoveClock = 0;
    const mapFEN = new Map<string, number>();
    const arrayFEN: string[] = [];
    const {fen, fenNoMoves} = getFEN(newBoard, PieceColor.WHITE, QW, KW, QB, KB, 0, 1);
    arrayFEN.push(fen);
    mapFEN.set(fenNoMoves, 1);
    let movesLog: Move[] = [];

    const promoRe = /=(?<piece>[QRBN])/;
    const tilePromoRe = /(?<col>[a-h])=(?<piece>[QRBN])/g;  // there could be 2
    const tileRe = /^T(?<fromCol>[a-h])(?<fromRow>[1-8])(?<toCol>[a-h])(?<toRow>[1-8])/
    const pieceToRe = /(?<col>[a-h])(?<row>[1-8])$/; // always the last 2
    const pieceFromRe = /[NBRQK]?(?<col>[a-h]?)(?<row>[1-8]?)$/; // x and last 2 characters removed first!
    let color = PieceColor.WHITE;

    for (const move of moves) {
        const newMove: Move = {
            oldPiece: { type: PieceType.EMPTY, color: PieceColor.NONE },
            newPiece: { type: PieceType.EMPTY, color: PieceColor.NONE },
            fromRow: 0,
            fromCol: 0,
            toRow: 0,
            toCol: 0,
            notation: '',
            isTile: false,
            promotions: []
        };

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

            newMove.oldPiece = { type: PieceType.EMPTY, color: PieceColor.NONE };
            newMove.newPiece = { type: PieceType.KING, color: color };
            newMove.fromRow = row;
            newMove.fromCol = 4;
            newMove.toRow = row;
            newMove.toCol = kingToCol;
            newMove.notation = move;
            newMove.isTile = false;
            newMove.promotions = [];

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
            doTileMove(fromRow, fromCol, toRow, toCol, newBoard, false);

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
            newMove.oldPiece = { type: PieceType.TILE, color: PieceColor.NONE };
            newMove.newPiece = { type: PieceType.TILE, color: PieceColor.NONE };
            newMove.fromRow = fromRow;
            newMove.fromCol = fromCol;
            newMove.toRow = toRow;
            newMove.toCol = toCol;
            newMove.notation = move;
            newMove.isTile = true;
            newMove.promotions = promotions;

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
            const possiblePieces = getPiecesThatCanReach(toRow, toCol, pieceType, color, newBoard, movesLog.at(-1));
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
            const newPiece = newBoard[fromRow!][fromCol!];
            const oldPiece = newBoard[toRow][toCol];
            newBoard[fromRow!][fromCol!] = { type: PieceType.EMPTY, color: PieceColor.NONE };
            newBoard[toRow][toCol] =  {type: pieceType, color: color};

            // en passant: remove pawn
            if (pieceType === PieceType.PAWN && oldPiece.type === PieceType.EMPTY && move.includes('x')) {
                newBoard[fromRow!][toCol!] = { type: PieceType.EMPTY, color: PieceColor.NONE };
            } 

            // handle promotion
            const matchPromo = promoRe.exec(move);
            let promotions: {row: number, col: number, piece: Piece}[] = [];
            if (matchPromo) {
                newBoard[toRow][toCol] = { type: pieceTypeFromChar(matchPromo.groups!.piece), color: color };
                promotions.push({ row: toRow, col: toCol, piece: newBoard[toRow][toCol] });
            }

            newMove.oldPiece = oldPiece;
            newMove.newPiece = newPiece;
            newMove.fromRow = fromRow!;
            newMove.fromCol = fromCol!;
            newMove.toRow = toRow;
            newMove.toCol = toCol;
            newMove.notation = move;
            newMove.isTile = false;
            newMove.promotions = promotions;
        }
        // change turn
        color = color === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;

        // check for check, stalemate, and checkmate
        const isInCheck = inCheck(color, newBoard);
        if (!anyValidMoves(color, newBoard, newMove, rules, arrayFEN)) {
            if (isInCheck) newMove.notation += '#';  // checkmate: no moves and in check
            else newMove.notation += '$';  // stalemate: no moves but not in check
        } else if (isInCheck) newMove.notation += '+';  // check: has moves and in check
        
        // log the move!
        movesLog.push(newMove);

        // update FEN parameters (castle, half-move, full-move)
        [QW, KW, QB, KB] = checkCastle(newBoard, QW, KW, QB, KB, rules);

        if ((newMove.oldPiece.type !== PieceType.EMPTY && newMove.oldPiece.type !== PieceType.TILE) || newMove.newPiece.type === PieceType.PAWN) {
            halfmoveClock = 0;
        } else {
            halfmoveClock += 1;
        }

        // update arrayFEN and mapFEN with this move
        const {fen, fenNoMoves} = getFEN(newBoard, color, QW, KW, QB, KB, halfmoveClock, Math.floor(movesLog.length / 2) + 1 );
        arrayFEN.push(fen);
        if (mapFEN.has(fenNoMoves)) {
            mapFEN.set(fenNoMoves, mapFEN.get(fenNoMoves)! + 1)
        } else {
            mapFEN.set(fenNoMoves, 1);
        }
    }

    return {movesLog, color, QW, KW, QB, KB, halfmoveClock, mapFEN, arrayFEN};
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

export function getPiecesOnTile(row: number, col: number, board: Piece[][]): Piece[] {
    // order is clockwise starting from the bottom left
    row -= row % 2;
    col -= col % 2;
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
export function doTileMove(fromRow: number, fromCol: number, toRow: number, toCol: number, board: Piece[][], reverse: boolean): void {
    if (toRow % 2 || toCol % 2) rotateTileOnBoard(fromRow, fromCol, toRow, toCol, board, reverse);
    else swapTilesOnBoard(fromRow, fromCol, toRow, toCol, board);
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

export function tileMoveWouldUndo(fromRow: number, fromCol: number, toRow: number, toCol: number, board: Piece[][], arrayFEN: string[]): boolean {
    if (arrayFEN.length === 1) return false;

    // if the last move changed the castling permission, then it can't be undone
    const castleStr = arrayFEN.at(-1)!.split(' ').at(-4)!;
    const castleStr2 = arrayFEN.at(-2)!.split(' ').at(-4)!;
    if (castleStr !== castleStr2) return false;
    
    const KW = castleStr.includes('K');
    const QW = castleStr.includes('Q');
    const KB = castleStr.includes('k');
    const QB = castleStr.includes('q');
    const color = arrayFEN.at(-2)!.split(' ').at(-5)! === 'w' ? PieceColor.WHITE : PieceColor.BLACK;
    doTileMove(fromRow, fromCol, toRow, toCol, board, false); 
    const {fen, fenNoMoves} = getFEN(board, color, QW, KW, QB, KB, 0, 0);
    doTileMove(fromRow, fromCol, toRow, toCol, board, true); 

    return fenNoMoves === fenStripMoves(arrayFEN.at(-2)!);
}

export function tileCanMoveTo(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // simple check to see if the tiles are adjacent
    return Math.max(Math.abs(fromRow - toRow), Math.abs(fromCol - toCol)) <= 2;
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
    if (pieceType === PieceType.PAWN) return '';  // pawn moves never need to be disambiguated
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
        promotionNotation += `${isTile ? col0ToFile(promo.col) : ''}=${charFromPieceType(promo.piece.type, false)}`
    }

    // put it together
    let notation: string;
    if (isTile) {
        notation = `T${col0ToFile(fromCol)}${fromRow+1}${col0ToFile(toCol)}${toRow+1}${promotionNotation}${check}`;
    } else {
        const capture = (!enPassant && oldPiece.type === PieceType.EMPTY) ? '' : 'x';
        const pieceChar = (capture && newPiece.type === PieceType.PAWN) ? col0ToFile(fromCol) : charFromPieceType(newPiece.type, false);
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

export function getPieceOnBoard(board: Piece[][], fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean): {oldPiece: Piece, newPiece: Piece} {
    let oldPiece: Piece;
    let newPiece: Piece;
    if (isTile) {
        oldPiece = {type: PieceType.TILE, color: PieceColor.NONE};
        newPiece = {type: PieceType.TILE, color: PieceColor.NONE};
    } else {
        oldPiece = board[toRow][toCol];
        newPiece = board[fromRow][fromCol];
    }

    return {oldPiece, newPiece}
}

export function moveOnBoard(board: Piece[][], fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]): {oldPiece: Piece, newPiece: Piece, enPassant: boolean}{
    // Move the piece
    const {oldPiece, newPiece} = getPieceOnBoard(board, fromRow, fromCol, toRow, toCol, isTile);
    if (isTile) {
        doTileMove(fromRow, fromCol, toRow, toCol, board, false);
    } else {
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
            doTileMove(fromRow, fromCol, toRow, toCol, board, false);

            for (const testCol of [fromCol, fromCol+1]) {
                const testRow = (fromRow === 0 || toRow === 0) ? 0 : 7;
                const piece = board[testRow][testCol];
                if (piece.type === PieceType.PAWN && piece.color === (testRow === 0 ? PieceColor.BLACK : PieceColor.WHITE)) {
                    promotions.push({ row: testRow, col: testCol });
                }
            }
            
            doTileMove(fromRow, fromCol, toRow, toCol, board, true);
        }
    } else if (piece.type === PieceType.PAWN && ((piece.color === PieceColor.WHITE && toRow === 7) || (piece.color === PieceColor.BLACK && toRow === 0))) {
        promotions.push({ row: toRow, col: toCol });
    }

    return promotions;
}


export function wouldBeInCheck(playerColor: PieceColor, board: Piece[][], fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean): boolean {
    let check: boolean;
    if (isTile) {
        doTileMove(fromRow, fromCol, toRow, toCol, board, false);
        check = inCheck(playerColor, board);
        doTileMove(fromRow, fromCol, toRow, toCol, board, true);   
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

export function checkRules(board: Piece[][], fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean, currentTurn: PieceColor, rules: Rules, lastMove: Move | undefined, arrayFEN: string[], isInCheck: boolean): boolean {
    if (rules.ruleIgnoreAll) return true;

    // reject if they'd be in check after
    if (wouldBeInCheck(currentTurn, board, fromRow, fromCol, toRow, toCol, isTile)) return false;

    if (isTile) {
        // reject tile move if either tile is pinned (only check the "to tile" if it's not a rotation)
        if (!tileCanMove(fromRow, fromCol, board, currentTurn, isInCheck, rules)) return false;
        if ((toRow - toRow % 2 !== fromRow || toCol - toCol % 2 !== fromCol) && !tileCanMove(toRow, toCol, board, currentTurn, isInCheck, rules)) return false;
        
        // reject if it's impossible for the tile to reach (ignoring checks and rules)
        if (!tileCanMoveTo(fromRow, fromCol, toRow, toCol)) return false;
        
        // reject if it would completely undo the previous move
        if (rules.ruleUndoTileMove && tileMoveWouldUndo(fromRow, fromCol, toRow, toCol, board, arrayFEN)) return false;
    } else {
        // reject if the piece doesn't belong to the player
        if (!sameColor(board[fromRow][fromCol].color, currentTurn)) return false;

        // reject if it's impossible for the piece to reach (ignoring checks and rules)
        if (!pieceCanMoveTo(fromRow, fromCol, toRow, toCol, board, lastMove)) return false;
    }


    return true;
}


export function getValidMoves(board: Piece[][], fromRow: number, fromCol: number, isTile: boolean, currentTurn: PieceColor, returnFirst: boolean, lastMove: Move | undefined, QW: boolean, KW: boolean, QB: boolean, KB: boolean, rules: Rules, arrayFEN: string[]): { toRow: number, toCol: number, isTileSwap: boolean }[] {
    const piece = isTile ? { type: PieceType.TILE, color: currentTurn } : board[fromRow][fromCol];
    let validMoves: { toRow: number, toCol: number, isTileSwap: boolean }[] = [];

    // need to check every possible move for if we'd be (still) in check afterwards
    const isInCheck = inCheck(isTile ? currentTurn : piece.color, board);
    function pushIfRulesValid(toRow: number, toCol: number, isTile=false, isTileSwap=false): void {
        if (checkRules(board, fromRow, fromCol, toRow, toCol, isTile, currentTurn, rules, lastMove, arrayFEN, isInCheck)) {
            validMoves.push({ toRow, toCol, isTileSwap });
        }
    }

    switch (piece.type) {
        case PieceType.TILE:
            // first, check if we can move this piece at all
            const hasPieces = tileHasPieces(fromRow, fromCol, board);
            if (tileCanMove(fromRow, fromCol, board, currentTurn, isInCheck, rules)) {
                // rotations of this tile
                if (hasPieces) {
                    pushIfRulesValid(fromRow+1, fromCol, true, false);
                    pushIfRulesValid(fromRow+1, fromCol+1, true, false);
                    pushIfRulesValid(fromRow, fromCol+1, true, false);
                }

                // swap with orthogonal directions
                for (const direction of rookDirections) {
                    const toRow = fromRow + 2*direction[0];
                    const toCol = fromCol + 2*direction[1];
                    if (toRow >= 0 && toRow <= 7 && toCol >= 0 && toCol <= 7 
                            && (hasPieces || tileHasPieces(toRow, toCol, board))) {
                        pushIfRulesValid(toRow, toCol, true, true);
                    }
                }
            }
            break;

        case PieceType.PAWN:
            const direction = (piece.color === PieceColor.WHITE) ? 1 : -1;
            
            // check one square forward
            const toRow = fromRow + direction;
            if (toRow >= 0 && toRow <= 7 && board[toRow][fromCol].type === PieceType.EMPTY) {
                pushIfRulesValid(toRow, fromCol);
                if (returnFirst && validMoves.length) {return validMoves}

                // also check 2 squares forward if we're in the starting position and the next square is empty
                // TODO: make pawn double move rule work
                const toRow2 = fromRow + 2 * direction;
                if (toRow2 >= 0 && toRow2 <= 7
                        && fromRow === (piece.color === PieceColor.WHITE ? 1 : 6)
                        && board[toRow2][fromCol].type === PieceType.EMPTY) {
                    pushIfRulesValid(toRow2, fromCol); 
                    if (returnFirst && validMoves.length) {return validMoves}
                }
            }

            // check captures
            for (const colOffset of [-1, 1]) {
                const toCol = fromCol + colOffset;
                if (toRow >= 0 && toRow <= 7 && toCol >= 0 && toCol <= 7 
                        && oppositeColor(piece.color, board[toRow][toCol].color)) {
                    pushIfRulesValid(toRow, toCol); 
                    if (returnFirst && validMoves.length) {return validMoves}
                }
            }

            // check for en passant
            // this pawn must be in the correct row (white: 5, black: 4)
            if (((piece.color === PieceColor.WHITE && fromRow === 4) || (piece.color === PieceColor.BLACK && fromRow === 3)) && lastMove) {
                // the last pawn must be in an adjacent column, have moved two rows, and have moved to the correct row (white: 4, black: 5)
                if (lastMove.newPiece.type === PieceType.PAWN && Math.abs(fromCol - lastMove.toCol) === 1 && Math.abs(lastMove.fromRow - lastMove.toRow) === 2 
                        && ((lastMove.newPiece.color === PieceColor.WHITE && lastMove.toRow === 3) || (lastMove.newPiece.color === PieceColor.BLACK && fromRow === 4))) {
                    pushIfRulesValid(toRow, lastMove.toCol); 
                }
            }
            

            break;

        case PieceType.KNIGHT:
            for (const knightMove of knightMoves) {
                const toRow = fromRow + knightMove[0];
                const toCol = fromCol + knightMove[1];
                if (toRow >= 0 && toRow <= 7 && toCol >= 0 && toCol <= 7
                        && !sameColor(piece.color, board[toRow][toCol].color)) {
                    pushIfRulesValid(toRow, toCol); 
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
                    pushIfRulesValid(toRow, toCol); 
                    if (returnFirst && validMoves.length) {return validMoves}
                    
                    if (oppositeColor(piece.color, board[toRow][toCol].color)) {
                        // capture! No more valid moves in this direction
                        break;
                    }
                }
            }

            // check for castling
            // TODO: make castling rules work
            if (piece.type === PieceType.KING && !isInCheck) {
                if (piece.color === PieceColor.WHITE) {
                    if (KW 
                            && board[0][5].type === PieceType.EMPTY && board[0][6].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 0, 4, 0, 5, false)) {
                        pushIfRulesValid(0, 6);
                    }
                    if (QW 
                            && board[0][1].type === PieceType.EMPTY && board[0][2].type === PieceType.EMPTY && board[0][3].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 0, 4, 0, 3, false)) {
                        pushIfRulesValid(0, 2);
                    }
                } else {
                    if (KB 
                            && board[7][5].type === PieceType.EMPTY && board[7][6].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 7, 4, 7, 5, false)) {
                        pushIfRulesValid(7, 6);
                    }
                    if (QB
                            && board[7][1].type === PieceType.EMPTY && board[7][2].type === PieceType.EMPTY && board[7][3].type === PieceType.EMPTY 
                            && !wouldBeInCheck(PieceColor.WHITE, board, 7, 4, 7, 3, false)) {
                        pushIfRulesValid(7, 2);
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

export function anyValidMoves(playerColor: PieceColor, board: Piece[][], lastMove: Move | undefined, rules: Rules, arrayFEN: string[]): boolean {
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
                if (getValidMoves(board, row, col, false, playerColor, true, lastMove, false, false, false, false, rules, arrayFEN).length > 0) return true;
            }
        }
    }

    // tile moves
    for (row = 0; row < 8; row += 2) {
        for (col = 0; col < 8; col += 2) {
            if (getValidMoves(board, row, col, true, playerColor, true, lastMove, false, false, false, false, rules, arrayFEN).length > 0) return true;
        }
    }

    return false;
}

export function gameInfoFromGameState(game: GameState): GameInfo {
    return {
        hasPassword: game.password !== '', 
        gameId: game.id,
        playerWhite: game.playerWhiteName,
        playerBlack: game.playerBlackName,
        lastNameWhite: game.playerWhiteName,
        lastNameBlack: game.playerBlackName,
        numberOfSpectators: game.spectatorNames.length,
        timeLeftWhite: game.timeLeftWhite,
        timeLeftBlack: game.timeLeftBlack,
        creationTime: game.creationTime,
        result: GameResultCause.ONGOING,
        isActive: game.isActive,
        useTimeControl: game.useTimeControl,
        currentTurn: game.currentTurn
    };
}

export function compressMovesLog(movesLog: Move[]): string {
    const movesLogStrs: string[] = [];
    for (const move of movesLog) {
        let s = '';
        s += charFromPiece(move.oldPiece, true);
        s += charFromPiece(move.newPiece, true);
        s += `${move.fromRow}${move.fromCol}${move.toRow}${move.toCol}`;
        s += move.notation;
        //s += move.isTile ? 't' : 'f';  // redundant, use oldPiece.type === PieceType.TILE
        if (move.promotions.length) {
            s += '|'
            for (const promo of move.promotions) {
                s += `${promo.row}${promo.col}${charFromPiece(promo.piece, true)}`;
            }
        }
        movesLogStrs.push(s);
    }
    /*
    if (JSON.stringify(movesLog) !== JSON.stringify(decompressMovesLog(movesLogStrs.join(',')))) {
        console.error('Error compressing movesLog!')
        console.error(movesLog);
        console.error(movesLogStrs.join(','));
    }
    */

    return movesLogStrs.join(',');

}

export function decompressMovesLog(movesLogStr: string): Move[] {
    const movesLog: Move[] = [];

    if (!movesLogStr) return movesLog;

    for (const move of movesLogStr.trim().split(',')) {
        const oldPiece = pieceFromChar(move[0])

        const pipe = move.indexOf('|');
        const promotions: {row: number, col: number, piece: Piece}[] = [];
        if (pipe > -1) {
            const promoStr = move.slice(pipe + 1);
            for (let i = 0; i < promoStr.length; i += 3) {
                promotions.push({
                    row: parseInt(promoStr[i]),
                    col: parseInt(promoStr[i + 1]),
                    piece: pieceFromChar(promoStr[i + 2]),
                });
            }
        }

        movesLog.push({
            oldPiece: oldPiece,
            newPiece: pieceFromChar(move[1]),
            fromRow: parseInt(move[2]),
            fromCol: parseInt(move[3]),
            toRow: parseInt(move[4]),
            toCol: parseInt(move[5]),
            notation: pipe > -1 ? move.slice(6, pipe) : move.slice(6),
            isTile: oldPiece.type === PieceType.TILE,
            promotions: promotions,
        });
    }

    return movesLog;
}