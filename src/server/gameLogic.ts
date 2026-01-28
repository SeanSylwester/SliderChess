import { PieceColor, PieceType, Piece, GameState, MESSAGE_TYPES, GameStateMessage, MovePieceMessage, Message, TimeMessage, ChatMessage } from '../shared/types.js';
import { ClientInfo } from './types.js';
import { sameColor, oppositeColor, col0ToFile, swapTilesOnBoard, rotateTileOnBoard, getPieceChar } from '../shared/utils.js'
import { inCheck } from '../shared/utils.js';


const knightMoves = [[-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1]];
const bishopDirections = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
const rookDirections = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const kingQueenDirections = bishopDirections.concat(rookDirections);
export class Game {
    playerWhite: ClientInfo | null = null;
    playerBlack: ClientInfo | null = null;
    spectators: ClientInfo[] = [];
    board: Piece[][];
    chatLog: string[] = [];
    movesLog: {oldPiece: Piece, newPiece: Piece, fromRow: number, fromCol: number, toRow: number, toCol: number, notation: string, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]}[] = [];
    currentTurn: PieceColor = PieceColor.WHITE;
    initialTimeWhite = 600; // in seconds
    initialTimeBlack = 600; // in seconds
    incrementWhite = 5;   // in seconds
    incrementBlack = 5;   // in seconds
    timeLeftWhite = this.initialTimeWhite; // in seconds
    timeLeftBlack = this.initialTimeBlack; // in seconds
    clockRunning = false;

    lastMoveTime = 0;

    canCastleKingsideWhite = true;
    canCastleQueensideWhite = true;
    canCastleKingsideBlack = true;
    canCastleQueensideBlack = true;

    drawWhite = false;
    drawBlack = false;

    public constructor(public id: number) {
        this.id = id;
        this.logChatMessage(`Game ${this.id} created.`);

        // note: the column order looks flipped because the rows are upside down. a1 is the top left of this array, but ends up bottom left.
        this.board = [
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

    public addPlayer(player: ClientInfo, color = PieceColor.NONE): void {
        if (color === PieceColor.WHITE) {
            this.playerWhite = player;
        } else if (color === PieceColor.BLACK) {
            this.playerBlack = player;
        } else {
            this.spectators.push(player);
        }
        this.sendGameStateToAll();
        this.logChatMessage(`Player ${player.name} has joined as ${color === PieceColor.NONE ? 'a spectator' : PieceColor[color]}.`);
    }

    public changePosition(c: ClientInfo, position: PieceColor): void {
        if (c.gameId !== this.id) {
            console.error(`Client ${c} (${c.name}) is in game ${c.gameId}, not ${this.id}`);
            return;
        }

        const originalPosition = c === this.playerWhite ? PieceColor.WHITE : (c === this.playerBlack ? PieceColor.BLACK : PieceColor.NONE);
        if (originalPosition === position) {
            console.log(`Ignoring swap for Client ${c} (${c.name}) to same position ${position} in game ${this.id}`)
            return;
        }

        if (position === PieceColor.WHITE && this.playerWhite || position === PieceColor.BLACK && this.playerBlack) {
            console.log(`Ignoring swap for Client ${c} (${c.name}) to already-filled position ${position} in game ${this.id}`)
            return;
        }

        switch (position) {
            case PieceColor.WHITE:
                this.playerWhite = c;
                break;
            case PieceColor.BLACK:
                this.playerBlack = c;
                break;
            case PieceColor.NONE:
                this.spectators.push(c);
                break;
        }
        switch (originalPosition) {
            case PieceColor.WHITE:
                this.playerWhite = null;
                this.applyTimeAndPause();
                break;
            case PieceColor.BLACK:
                this.playerBlack = null;
                this.applyTimeAndPause();
                break;
            case PieceColor.NONE:
                const index = this.spectators.indexOf(c);
                if (index > -1) {
                    this.spectators.splice(index, 1);
                }
                break;
        }
        //console.log(`Client  ${c} (${c.name}) moved from position ${originalPosition} to ${position} in game ${this.id}`);
        this.logChatMessage(`${c.name} has moved from position ${originalPosition === PieceColor.NONE ? 'spectator' : PieceColor[originalPosition]} to ${position === PieceColor.NONE ? 'spectator' : PieceColor[position]}.`);

        this.sendGameStateToAll();
    }

    public removePlayer(player: ClientInfo): void {
        if (this.playerWhite === player) {
            this.playerWhite = null;
            this.logChatMessage(`White player ${player.name} has disconnected.`);
            this.applyTimeAndPause();
        } else if (this.playerBlack === player) {
            this.playerBlack = null;
            this.logChatMessage(`Black player ${player.name} has disconnected.`);
            this.applyTimeAndPause();
        } else {
            const index = this.spectators.indexOf(player);
            if (index > -1) {
                this.spectators.splice(index, 1);
            }
            this.logChatMessage(`${player.name} has disconnected.`);
        }
        this.sendGameStateToAll();
    }

    public sendMessageToAll<T extends Message>(message: T): void {
        // TODO: make type checking work on data
        if (this.playerWhite !== null) {
            this.playerWhite.ws.send(JSON.stringify(message));
        }
        if (this.playerBlack !== null) {
            this.playerBlack.ws.send(JSON.stringify(message));
        }
        for (const spectator of this.spectators) {
            spectator.ws.send(JSON.stringify(message));
        }
    }

    public syncTime(): void {
        this.sendMessageToAll({type: MESSAGE_TYPES.TIME, 
                               initialTimeWhite: this.initialTimeWhite, initialTimeBlack: this.initialTimeBlack, 
                               timeLeftWhite: this.timeLeftWhite, timeLeftBlack: this.timeLeftBlack, 
                               incrementWhite: this.incrementWhite, incrementBlack: this.incrementBlack,
                               clockRunning: this.clockRunning} satisfies TimeMessage);
    }

    public logChatMessage(message: string, client?: ClientInfo): void {
        if (client) {
            this.chatLog.push(`${client.name}: ${message}`);
        } else {
            this.chatLog.push(message);
        }

        // push to players and spectators
        this.sendMessageToAll({type: MESSAGE_TYPES.CHAT, message: this.chatLog[this.chatLog.length - 1] } satisfies ChatMessage);

        // check for special timing messages
        const timingRe = /^t(?<colors>[wb]+)(?<time>\d*\.?\d*)(?<hasIncrement>\+?)(?<increment>\d*\.?\d*)/
        const match = timingRe.exec(message.toLowerCase());
        if (match !== null) {
            if (match.groups!.colors.includes('w')) {
                if (match.groups!.time) {
                    // total time is the new time setting plus the already elapsed time
                    const elapsedTime = this.initialTimeWhite - this.timeLeftWhite;
                    this.timeLeftWhite = parseFloat(match.groups!.time) * 60;
                    this.initialTimeWhite = this.timeLeftWhite + elapsedTime;
                }
                if (match.groups!.increment) {
                    this.incrementWhite = parseFloat(match.groups!.increment);
                }
            }
            if (match.groups!.colors.includes('b')) {
                if (match.groups!.time) {
                    // total time is the new time setting plus the already elapsed time
                    const elapsedTime = this.initialTimeBlack - this.timeLeftBlack;
                    this.timeLeftBlack = parseFloat(match.groups!.time) * 60;
                    this.initialTimeBlack = this.timeLeftBlack + elapsedTime;
                }
                if (match.groups!.increment) {
                    this.incrementBlack = parseFloat(match.groups!.increment);
                }
            }
            this.logChatMessage('Updated time settings');
            this.syncTime();
        }
        /*
        const timingRe = /^t(?<colors>[wb]+)(?<time>\d*\.?\d*)(?<hasIncrement>\+?)(?<increment>\d*\.?\d*)/
        const testMessages = ['Tw10+5', 'Tb+3.3', 'Tb30.1', 'Twb20', 'T b20+3.2', 'Tw20 3', 'TB2', 'Tx20+5', 'w10+5'];
        for (message of testMessages) {
            console.log(timingRe.exec(message.toLowerCase()));
        }
        */
    }

    public sendGameState(client: ClientInfo): void {
        const gameState: GameState = {
            playerWhiteName: this.playerWhite?.name ?? null,
            playerBlackName: this.playerBlack?.name ?? null,
            spectatorNames: this.spectators.map(s => s.name),
            id: this.id,
            board: this.board,
            chatLog: this.chatLog,
            movesLog: this.movesLog,
            currentTurn: this.currentTurn,
            initialTimeWhite: this.initialTimeWhite,
            initialTimeBlack: this.initialTimeBlack,
            incrementWhite: this.incrementWhite,
            incrementBlack: this.incrementBlack,
            timeLeftWhite: this.timeLeftWhite,
            timeLeftBlack: this.timeLeftBlack,
            clockRunning: this.clockRunning,
            canCastleKingsideWhite: this.canCastleKingsideWhite,
            canCastleQueensideWhite: this.canCastleQueensideWhite,
            canCastleKingsideBlack: this.canCastleKingsideBlack,
            canCastleQueensideBlack: this.canCastleQueensideBlack,
            drawWhite: this.drawWhite,
            drawBlack: this.drawBlack
        };
        const clientColor = (client === this.playerWhite) ? PieceColor.WHITE : (client === this.playerBlack) ? PieceColor.BLACK : PieceColor.NONE;
        client.ws.send(JSON.stringify({ type: MESSAGE_TYPES.GAME_STATE, gameState: gameState, yourColor: clientColor } satisfies GameStateMessage));
    }

    public sendGameStateToAll(): void {
        if (this.playerWhite !== null) {
            this.sendGameState(this.playerWhite);
        }
        if (this.playerBlack !== null) {
            this.sendGameState(this.playerBlack);
        }
        for (const spectator of this.spectators) {
            this.sendGameState(spectator);
        }
    }

    public swapPlayers(): void {
        const temp = this.playerWhite;
        this.playerWhite = this.playerBlack;
        this.playerBlack = temp;
        this.logChatMessage('Players have swapped colors.');
    }

    public isEmpty(): boolean {
        return this.playerWhite === null && this.playerBlack === null && this.spectators.length === 0;
    }

    public movePiece(c: ClientInfo, fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]): boolean {
        // reject a move to the same spot (they're probably just deselecting)
        if (fromRow === toRow && fromCol === toCol) {
            return false;
        }
        // Check if it's the player's turn
        if (c !== (this.currentTurn === PieceColor.WHITE ? this.playerWhite : this.playerBlack)) {
            return false;
        }

        let oldPiece: Piece;
        let newPiece: Piece;
        if (isTile) {
            // TODO: set these to account for castling checks
            oldPiece = {type: PieceType.TILE, color: PieceColor.NONE};
            newPiece = {type: PieceType.TILE, color: this.currentTurn};
        } else {
            oldPiece = this.board[toRow][toCol];
            newPiece = this.board[fromRow][fromCol];
        }


        // Check if there is a piece at the from position and if it belongs to the current player
        if (newPiece.type === PieceType.EMPTY) {
            return false;
        }
        if (newPiece.color !== this.currentTurn) {
            return false;
        }

        // Check if the move is valid
        if (!this.isValidMove(fromRow, fromCol, toRow, toCol, isTile)) {
            return false;
        }

        // Move the piece
        if (isTile) {
            if (toRow % 2 || toCol % 2) {
                rotateTileOnBoard(fromRow, fromCol, toRow, toCol, this.board, false);
            } else {
                swapTilesOnBoard(fromRow, fromCol, toRow, toCol, this.board);
            }
        } else {
            this.board[toRow][toCol] = newPiece;
            this.board[fromRow][fromCol] = {type: PieceType.EMPTY, color: PieceColor.NONE};
        }

        // handle promotions
        promotions.forEach(promo => {
            this.board[promo.row][promo.col] = promo.piece;
        });


        // keep track of if castling is allowed
        // TODO: track if the rook moves on a tile
        if (newPiece.type === PieceType.ROOK) {
            if (newPiece.color === PieceColor.WHITE) {
                if (fromRow === 0) {
                    if (fromCol === 0) this.canCastleQueensideWhite = false;
                    else if (fromCol === 7) this.canCastleKingsideWhite = false;
                }
            } else {
                if (fromRow === 7) {
                    if (fromCol === 0) this.canCastleQueensideWhite = false;
                    else if (fromCol === 7) this.canCastleKingsideWhite = false;
                }
            }
        }
        if (newPiece.type === PieceType.KING) {
            if (newPiece.color === PieceColor.WHITE) {
                this.canCastleQueensideWhite = false;
                this.canCastleKingsideWhite = false;
        
            } else {
                this.canCastleQueensideBlack = false;
                this.canCastleKingsideBlack = false;
            }  
        }      

        // detect en passant and remove the captured pawn
        const enPassant = newPiece.type === PieceType.PAWN && fromCol !== toCol && oldPiece.type === PieceType.EMPTY
        if (enPassant){
            this.board[fromRow][toCol] = { type: PieceType.EMPTY, color: PieceColor.NONE };
        }
        // detect castle (king moves twice) and move the rook. It should be guaranteed to be there by the this.canCastle stuff
        const castling = newPiece.type === PieceType.KING && Math.abs(fromCol - toCol) === 2
        if (castling) {
            const castleRow = newPiece.color === PieceColor.WHITE ? 0 : 7;
            if (fromCol > toCol) {
                // queenside, move a
                this.board[castleRow][3] = this.board[castleRow][0];
                this.board[castleRow][0] = { type: PieceType.EMPTY, color: PieceColor.NONE };
            } else {
                this.board[castleRow][5] = this.board[castleRow][7];
                this.board[castleRow][7] = { type: PieceType.EMPTY, color: PieceColor.NONE };
            }
        }

        // Log the move
        // TODO: add disambiguation identifier
        let castle = '';
        if (newPiece.type === PieceType.KING && fromCol === 4) {
            if (toCol === 2) {
                castle = 'O-O-O';
            } else if (toCol === 6) {
                castle = 'O-O';
            }
        }
        const check = inCheck(this.currentTurn === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE, this.board) ? '+' : '';
        let notation: string;
        let promotionNotation = '';
        for (const promo of promotions) {
            promotionNotation += `${isTile ? col0ToFile(promo.col) : ''}=${getPieceChar(promo.piece, false, promo.col)}`
        }
        if (isTile) {
            notation = `T${col0ToFile(fromCol)}${fromRow+1}${col0ToFile(toCol)}${toRow+1}${promotionNotation}${check}`;
            this.movesLog.push({oldPiece: oldPiece, newPiece: newPiece, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: notation, isTile: isTile, promotions: promotions});
        } else {
            const capture = (!enPassant && oldPiece.type === PieceType.EMPTY) ? '' : 'x';
            const pieceChar = getPieceChar(newPiece, capture === 'x', fromCol);
            notation = castle === '' ? `${pieceChar}${capture}${col0ToFile(toCol)}${toRow+1}${promotionNotation}${check}` : castle;
            this.movesLog.push({oldPiece: oldPiece, newPiece: newPiece, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: notation, isTile: isTile, promotions: promotions});
        }

        // Send move to all players and spectators
        this.sendMessageToAll({ type: MESSAGE_TYPES.MOVE_PIECE, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: notation, isTile: isTile, promotions: promotions } satisfies MovePieceMessage);

        // change turns and handle clock
        this.changeTurn(true);

        return true;
    }

    public applyElapsedTime(): void {
        const newTime = Date.now();
        if (this.clockRunning) {
            if (this.currentTurn === PieceColor.WHITE) this.timeLeftWhite -= (newTime - this.lastMoveTime) / 1000;
            else if (this.currentTurn === PieceColor.BLACK) this.timeLeftBlack -= (newTime - this.lastMoveTime) / 1000;
        }
        this.lastMoveTime = newTime;
    }

    public applyTimeAndPause(): void {
        this.applyElapsedTime();
        this.clockRunning = false;
        this.syncTime();
    }

    public changeTurn(applyIncrement: boolean): void {
        // TODO: I don't like this, but applyIncrement===False takes increment time away from the opponent, for use with rewind()
        this.applyElapsedTime();

        // Add time increment and update the current turn
        if (this.currentTurn === PieceColor.WHITE) {
            if(applyIncrement) this.timeLeftWhite += this.incrementWhite;
            else this.timeLeftBlack -= this.incrementBlack;
            this.currentTurn = PieceColor.BLACK;
        } else {
            if(applyIncrement) this.timeLeftBlack += this.incrementBlack;
            else this.timeLeftWhite -= this.incrementWhite;
            this.currentTurn = PieceColor.WHITE;
        }

        // start clock (in case it was paused) and sync time
        this.clockRunning = true;
        this.syncTime();
    }

    public getPlayerColor(c: ClientInfo): PieceColor {
        return c === this.playerWhite ? PieceColor.WHITE : (c === this.playerBlack ? PieceColor.BLACK : PieceColor.NONE);
    }

    public rewind(): void {
        if (this.movesLog.length === 0) {
            //console.log('Ignoring rewind with no moves played yet');
            return;
        }
        const lastMove = this.movesLog.pop()!;

        // undo promotions
        lastMove.promotions.forEach(promo => {
            this.board[promo.row][promo.col] = {type: PieceType.PAWN, color: promo.piece.color};
        });

        // undo board movement
        if (lastMove.isTile) {
            if (lastMove.toRow % 2 || lastMove.toCol % 2) {
                rotateTileOnBoard(lastMove.fromRow, lastMove.fromCol, lastMove.toRow, lastMove.toCol, this.board, true);
            } else {
                swapTilesOnBoard(lastMove.fromRow, lastMove.fromCol, lastMove.toRow, lastMove.toCol, this.board);
            }
        } else {
            this.board[lastMove.fromRow][lastMove.fromCol] = lastMove.newPiece;
            this.board[lastMove.toRow][lastMove.toCol] = lastMove.oldPiece;
        }

        // undo rook movement when castling 
        if (lastMove.notation === 'O-O') {
            if (lastMove.newPiece.color === PieceColor.WHITE) {
                this.board[0][5] = {type: PieceType.EMPTY, color: PieceColor.NONE};
                this.board[0][7] = {type: PieceType.ROOK, color: PieceColor.WHITE};
            } else {
                this.board[7][5] = {type: PieceType.EMPTY, color: PieceColor.NONE};
                this.board[7][7] = {type: PieceType.ROOK, color: PieceColor.BLACK};
            }
        } else if (lastMove.notation === 'O-O-O') {
            if (lastMove.newPiece.color === PieceColor.WHITE) {
                this.board[0][3] = {type: PieceType.EMPTY, color: PieceColor.NONE};
                this.board[0][0] = {type: PieceType.ROOK, color: PieceColor.WHITE};
            } else {
                this.board[7][3] = {type: PieceType.EMPTY, color: PieceColor.NONE};
                this.board[7][0] = {type: PieceType.ROOK, color: PieceColor.BLACK};
            }
        }

        // undo en passant
        if (lastMove.newPiece.type === PieceType.PAWN && lastMove.fromCol !== lastMove.toCol && lastMove.oldPiece.type === PieceType.EMPTY){
            this.board[lastMove.fromRow][lastMove.toCol] = {type: PieceType.PAWN, color: lastMove.newPiece.color === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE};
        }

        // if we undid a king or rook move, loop through all the moves to determine if castling is allowed again
        // TODO: decide what to do about tile moves
        if ([PieceType.ROOK, PieceType.KING].includes(lastMove.newPiece.type)) {
            this.canCastleKingsideWhite = true;
            this.canCastleQueensideWhite = true;
            this.canCastleKingsideBlack = true;
            this.canCastleQueensideBlack = true;
            this.movesLog.forEach((move, idx) => {
                const color = idx % 2 === 1 ? PieceColor.BLACK : PieceColor.WHITE;
                if (move.newPiece.type === PieceType.KING) {
                    if (move.newPiece.color === PieceColor.WHITE) {
                        this.canCastleKingsideWhite = false;
                        this.canCastleQueensideWhite = false;
                    } else {
                        this.canCastleKingsideBlack = false;
                        this.canCastleQueensideBlack = false;
                    }
                } else if (move.newPiece.type === PieceType.ROOK) {
                    if (move.newPiece.color === PieceColor.WHITE && move.fromRow === 0) {
                        if (move.fromCol === 0) this.canCastleQueensideWhite = false;
                        else if (move.fromCol === 7) this.canCastleKingsideWhite = false;
                    } else {
                        if (move.fromCol === 0) this.canCastleQueensideBlack = false;
                        else if (move.fromCol === 7) this.canCastleKingsideBlack = false;
                    }
                }
            });
        }
        // apply time and update the current turn (this will undo an end-of-game set to PieceColor.NONE)
        this.changeTurn(false);

        // resend the game state
        this.sendGameStateToAll();
    }

    public isValidMove(fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean): boolean {
        return true; // TODO
    }

    public draw(client: ClientInfo): void {
        const clientColor = (client === this.playerWhite) ? PieceColor.WHITE : (client === this.playerBlack) ? PieceColor.BLACK : PieceColor.NONE;
        if (client === this.playerWhite) {
            this.drawWhite = !this.drawWhite;
            this.logChatMessage(this.drawWhite ? 'I offer a draw' : 'I revoke my offer of a draw', client);
        } else if (client === this.playerBlack) {
            this.drawBlack = !this.drawBlack;
            this.logChatMessage(this.drawBlack ? 'I offer a draw' : 'I revoke my offer of a draw', client);
        } else {
            console.log('Ignoring draw request from a spectator');
            return;
        }
        
        if (this.drawWhite && this.drawBlack) {
            this.logChatMessage('Draw accepted. Game over!');
            this.clockRunning = false;
            this.syncTime();
            this.currentTurn = PieceColor.NONE;
        }

    }
}
