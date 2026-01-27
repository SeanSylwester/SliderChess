import { PieceColor, PieceType, Piece, GameState, MESSAGE_TYPES, GameStateMessage, MovePieceMessage } from '../shared/types.js';
import { ClientInfo } from './types.js';
import { sameColor, oppositeColor, col0ToFile } from '../shared/utils.js'
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
    movesLog: {oldPiece: Piece, newPiece: Piece, fromRow: number, fromCol: number, toRow: number, toCol: number, notation: string}[] = [];
    currentTurn: PieceColor = PieceColor.WHITE;
    initialTimeWhite = 600; // in seconds
    initialTimeBlack = 600; // in seconds
    incrementWhite = 5;   // in seconds
    incrementBlack = 5;   // in seconds
    timeLeftWhite = this.initialTimeWhite; // in seconds
    timeLeftBlack = this.initialTimeBlack; // in seconds
    clockRunning = false;

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
                break;
            case PieceColor.BLACK:
                this.playerBlack = null;
                break;
            case PieceColor.NONE:
                const index = this.spectators.indexOf(c);
                if (index > -1) {
                    this.spectators.splice(index, 1);
                }
                break;
        }
        console.log(`Client  ${c} (${c.name}) moved from position ${originalPosition} to ${position} in game ${this.id}`);
        this.logChatMessage(`${c.name} has moved from position ${originalPosition === PieceColor.NONE ? 'spectator' : PieceColor[originalPosition]} to ${position === PieceColor.NONE ? 'spectator' : PieceColor[position]}.`);

        this.sendGameStateToAll();
    }

    public removePlayer(player: ClientInfo): void {
        if (this.playerWhite === player) {
            this.playerWhite = null;
            this.logChatMessage(`White player ${player.name} has disconnected.`);
            this.clockRunning = false;
        } else if (this.playerBlack === player) {
            this.playerBlack = null;
            this.logChatMessage(`Black player ${player.name} has disconnected.`);
            this.clockRunning = false;
        } else {
            const index = this.spectators.indexOf(player);
            if (index > -1) {
                this.spectators.splice(index, 1);
            }
            this.logChatMessage(`${player.name} has disconnected.`);
        }
        this.sendGameStateToAll();
    }

    public sendMessageToAll(type: typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES], data: any): void {
        // TODO: make type checking work on data
        if (this.playerWhite !== null) {
            this.playerWhite.ws.send(JSON.stringify({ type: type, data: data }));
        }
        if (this.playerBlack !== null) {
            this.playerBlack.ws.send(JSON.stringify({ type: type, data: data }));
        }
        for (const spectator of this.spectators) {
            spectator.ws.send(JSON.stringify({ type: type, data: data }));
        }
    }

    public logChatMessage(message: string, client?: ClientInfo): void {
        if (client) {
            this.chatLog.push(`${client.name}: ${message}`);
        } else {
            this.chatLog.push(message);
        }

        // push to players and spectators
        this.sendMessageToAll(MESSAGE_TYPES.CHAT, { message: [this.chatLog[this.chatLog.length - 1]] });
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
        client.ws.send(JSON.stringify({ type: MESSAGE_TYPES.GAME_STATE, data: { gameState: gameState, yourColor: clientColor } } as GameStateMessage));
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

    public movePiece(c: ClientInfo, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
        // reject a move to the same spot (they're probably just deselecting)
        if (fromRow === toRow && fromCol === toCol) {
            return false;
        }
        // Check if it's the player's turn
        if (c !== (this.currentTurn === PieceColor.WHITE ? this.playerWhite : this.playerBlack)) {
            return false;
        }

        const oldPiece = this.board[toRow][toCol];
        const newPiece = this.board[fromRow][fromCol];

        // Check if there is a piece at the from position and if it belongs to the current player
        if (newPiece.type === PieceType.EMPTY) {
            return false;
        }
        if (newPiece.color !== this.currentTurn) {
            return false;
        }

        // Check if the move is valid
        if (!this.isValidMove(fromRow, fromCol, toRow, toCol)) {
            return false;
        }

        // Move the piece
        // TODO: handle en passant and promotion
        this.board[toRow][toCol] = newPiece;
        this.board[fromRow][fromCol] = { type: PieceType.EMPTY, color: PieceColor.NONE };


        // keep track of if castling is allowed
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

        // Update the current turn
        this.currentTurn = (this.currentTurn === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE);

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
        const capture = (!enPassant && oldPiece.type === PieceType.EMPTY) ? '' : 'x';
        const pieceChar = newPiece.type === PieceType.PAWN ? (capture ? col0ToFile(fromCol) : '') : (newPiece.type === PieceType.KNIGHT ? 'N' : PieceType[newPiece.type][0]);
        const check = inCheck(this.currentTurn, this.board) ? '+' : '';
        const notation = castle === '' ? `${pieceChar}${capture}${col0ToFile(toCol)}${toRow+1}${check}` : castle;
        this.movesLog.push({oldPiece: oldPiece, newPiece: newPiece, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: notation});

        // Send move to all players and spectators
        const message = JSON.stringify({ type: MESSAGE_TYPES.MOVE_PIECE, data: { fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: notation } } as MovePieceMessage);
        for (const player of [this.playerWhite, this.playerBlack]) {
            if (player) {
                player.ws.send(message);
            }
        }
        for (const spectator of this.spectators) {
            spectator.ws.send(message);
        }

        return true;
    }

    public rewind(): void {
        if (this.movesLog.length === 0) {
            console.log('Ignoring rewind with no moves played yet');
            return;
        }
        const lastMove = this.movesLog.pop()!;

        // undo board movement
        this.board[lastMove.fromRow][lastMove.fromCol] = lastMove.newPiece;
        this.board[lastMove.toRow][lastMove.toCol] = lastMove.oldPiece;

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
        // Update the current turn
        this.currentTurn = (this.currentTurn === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE);

        // resend the game state
        this.sendGameStateToAll();
    }

    public isValidMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
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
            this.currentTurn = PieceColor.NONE;
        }

    }
}
