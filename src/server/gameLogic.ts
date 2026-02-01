import { PieceColor, PieceType, Piece, GameState, MESSAGE_TYPES, GameStateMessage, MovePieceMessage, Message, TimeMessage, ChatMessage, Move, Rules, RulesMessage } from '../shared/types.js';
import { inCheck, moveOnBoard, checkCastle, moveNotation, tileCanMove, wouldBeInCheck, sameColor, pieceCanMoveTo, anyValidMoves, getDefaultBoard, getBoardFromMessage, getFENish } from '../shared/utils.js'
import { sendMessage, ClientInfo } from './server.js';

export class Game {
    playerWhite: ClientInfo | null = null;
    playerBlack: ClientInfo | null = null;
    spectators: ClientInfo[] = [];

    board: Piece[][];
    chatLog: string[] = [];
    movesLog: Move[] = [];
    currentTurn: PieceColor = PieceColor.WHITE;

    initialTimeWhite = 600; // in seconds
    initialTimeBlack = 600; // in seconds
    incrementWhite = 5;   // in seconds
    incrementBlack = 5;   // in seconds
    timeLeftWhite = this.initialTimeWhite; // in seconds
    timeLeftBlack = this.initialTimeBlack; // in seconds
    clockRunning = false;

    lastMoveTime = 0;

    KW = true;
    QW = true;
    KB = true;
    QB = true;

    drawWhite = false;
    drawBlack = false;

    confirmSurrenderWhite = false;
    confirmSurrenderBlack = false;

    halfmoveClock = 0;

    mapFEN: Map<string, number>;

    password = '';

    rules: Rules = {
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
        ruleIgnoreAll: false,
    }

    public constructor(public id: number) {
        this.id = id;
        this.logChatMessage(`Game ${this.id} created.`);

        // note: the column order looks flipped because the rows are upside down. a1 is the top left of this array, but ends up bottom left.
        this.board = getDefaultBoard();
        this.mapFEN = new Map<string, number>();
        this.updateFEN();
    }

    public setPassword(client: ClientInfo, password: string): void {
        this.password = password;
        this.sendMessageToAll({ type: MESSAGE_TYPES.GAME_PASSWORD, password: password });
        this.logChatMessage(`has ${password !== '' ? 'updated' : 'removed'} the password`, client);
    }

    public updateFEN(): void {
        const fen = getFENish(this.board, this.currentTurn, this.QW, this.KW, this.QB, this.KB)
        if (this.mapFEN.has(fen)) {
            this.mapFEN.set(fen, this.mapFEN.get(fen)! + 1)
            if (this.mapFEN.get(fen)! >= 3) {
                this.endGame('Draw by 3-fold repetition')
            }
        } else {
            this.mapFEN.set(fen, 1);
        }
    }

    public allClients(): ClientInfo[] {
        let clients: ClientInfo[] = [];
        if (this.playerWhite !== null) {
            clients.push(this.playerWhite);
        }
        if (this.playerBlack !== null) {
            clients.push(this.playerBlack);
        }
        clients.push(...this.spectators);

        return clients;
    }

    public setBoardFromMessage(notationString: string): string | void {
        const newBoard = getDefaultBoard();
        const ret = getBoardFromMessage(notationString, newBoard);
        if (typeof ret === 'string') {
            return ret;
        } else {
            this.movesLog = ret.movesLog;
            this.currentTurn = ret.color;
            this.QW = ret.QW;
            this.KW = ret.KW;
            this.QB = ret.QB;
            this.KB = ret.KB;
            this.board = newBoard;
            this.sendGameStateToAll();
        }
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
        for (const client of this.allClients()) {
            sendMessage(client, message);
        }
    }

    public setTimeFromMessage(message: string): boolean {
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
            this.syncTime();
            return true;
        }
        return false;
    }

    public syncTime(): void {
        this.sendMessageToAll({type: MESSAGE_TYPES.TIME, 
                               initialTimeWhite: this.initialTimeWhite, initialTimeBlack: this.initialTimeBlack, 
                               timeLeftWhite: this.timeLeftWhite, timeLeftBlack: this.timeLeftBlack, 
                               incrementWhite: this.incrementWhite, incrementBlack: this.incrementBlack,
                               clockRunning: this.clockRunning} satisfies TimeMessage);
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

    public logChatMessage(message: string, client?: ClientInfo): void {
        // check for special timing messages
        if (message.trim().startsWith('t') && this.setTimeFromMessage(message)) {
            message = 'updated times';
        }
        
        // check for special load-from-notation message
        if (message.trim().startsWith('1.')) {
            const error = this.setBoardFromMessage(message);
            if (error) {
                if (client) {
                    sendMessage(client, {type: MESSAGE_TYPES.CHAT, message: error} satisfies ChatMessage);
                } else {
                    console.error(error);
                }
                return;
            }
            message = 'loaded board from notation';
        }

        if (client) {
            this.chatLog.push(`${client.name}${client === this.playerWhite ? ' (White)' : (client === this.playerBlack ? ' (Black)' : ' (Spectator)')}: ${message}`);
        } else {
            this.chatLog.push(message);
        }

        // push to players and spectators
        this.sendMessageToAll({type: MESSAGE_TYPES.CHAT, message: this.chatLog[this.chatLog.length - 1] } satisfies ChatMessage);
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
            KW: this.KW,
            QW: this.QW,
            KB: this.KB,
            QB: this.QB,
            drawWhite: this.drawWhite,
            drawBlack: this.drawBlack,
            rules: this.rules
        };
        const clientColor = (client === this.playerWhite) ? PieceColor.WHITE : (client === this.playerBlack) ? PieceColor.BLACK : PieceColor.NONE;
        sendMessage(client, { type: MESSAGE_TYPES.GAME_STATE, gameState: gameState, yourColor: clientColor } satisfies GameStateMessage);
    }

    public sendGameStateToAll(): void {
        for (const client of this.allClients()) {
            this.sendGameState(client);
        }
    }

    public updateRules(client: ClientInfo, rules: Rules): void {
        if (JSON.stringify(rules) !== JSON.stringify(this.rules)) {
            this.logChatMessage(`Rules changed by ${client.name}`);
        }
        this.rules = rules;
        this.sendMessageToAll({ type: MESSAGE_TYPES.RULES, rules: this.rules } satisfies RulesMessage);
    }

    public endGame(chatMessage: string): void {
        this.logChatMessage(chatMessage);
        this.clockRunning = false;
        this.syncTime();
        this.currentTurn = PieceColor.NONE;
    }

    public draw(client: ClientInfo): void {
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
            this.endGame('Draw accepted. Game over!')
        }

    }

    public surrender(client: ClientInfo): void {
        if (client === this.playerWhite) {
            if (this.confirmSurrenderWhite) {
                this.endGame(`${client.name} (WHITE) has surrendered. Game over!`)
            } else {
                this.confirmSurrenderWhite = true;
                sendMessage(client, {type: MESSAGE_TYPES.CHAT, message: 'Click surrender again to confirm'} satisfies ChatMessage);
            }
        } else if (client === this.playerBlack) {
            if (this.confirmSurrenderBlack) {
                this.endGame(`${client.name} (BLACK) has surrendered. Game over!`)
            } else {
                this.confirmSurrenderBlack = true;
                sendMessage(client, {type: MESSAGE_TYPES.CHAT, message: 'Click surrender again to confirm'} satisfies ChatMessage);
            }
        } else {
            console.log('Ignoring surrender request from a spectator');
            return;
        }
    }

    public isEmpty(): boolean {
        return this.playerWhite === null && this.playerBlack === null && this.spectators.length === 0;
    }

    public changeTurn(applyIncrement: boolean): void {
        this.applyElapsedTime();

        // Add time increment and update the current turn
        if (this.currentTurn === PieceColor.WHITE) {
            this.confirmSurrenderWhite = false;
            if(applyIncrement) this.timeLeftWhite += this.incrementWhite;
            this.currentTurn = PieceColor.BLACK;
        } else {
            this.confirmSurrenderBlack = false;
            if(applyIncrement) this.timeLeftBlack += this.incrementBlack;
            this.currentTurn = PieceColor.WHITE;
        }

        // start clock (in case it was paused) and sync time
        this.clockRunning = true;
        this.syncTime();
    }

    public move(c: ClientInfo, fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]): boolean {
        // bounds check
        if (fromRow < 0 || fromRow > 7 || fromCol < 0 || fromCol > 7 || toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;

        // reject a move to the same spot (they're probably just deselecting)
        if (fromRow === toRow && fromCol === toCol) return false;

        // reject if the game is over
        if (this.currentTurn === PieceColor.NONE) return false;

        // reject if it's not the player's turn
        if (c !== (this.currentTurn === PieceColor.WHITE ? this.playerWhite : this.playerBlack)) return false;

        if (!this.rules.ruleIgnoreAll) {
        // reject if the piece doesn't belong to the player
            if (!isTile && !sameColor(this.board[fromRow][fromCol].color, this.currentTurn)) return false;

            // reject if they'd be in check after
            if (wouldBeInCheck(this.currentTurn, this.board, fromRow, fromCol, toRow, toCol, isTile)) return false;

            // reject tile move if either tile is pinned
            const currentlyInCheck = inCheck(this.currentTurn, this.board);
            if (isTile && (!tileCanMove(fromRow, fromCol, this.board, this.currentTurn, currentlyInCheck, this.rules)
                            || !tileCanMove(toRow, toCol, this.board, this.currentTurn, currentlyInCheck, this.rules))) return false;
            
            // reject piece move if it's impossible
            if (!isTile && !pieceCanMoveTo(fromRow, fromCol, toRow, toCol, this.board, this.movesLog.at(-1))) return false;
        }

        // do the move!
        const {oldPiece, newPiece, enPassant} = moveOnBoard(this.board, fromRow, fromCol, toRow, toCol, isTile, promotions);


        // check if castling is still allowed
        [this.QW, this.KW, this.QB, this.KB] = checkCastle(this.board, this.QW, this.KW, this.QB, this.KB, this.rules);
        
        // determine if the other player is now in check
        const check = inCheck(this.currentTurn === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE, this.board);

        // get move notation
        const notation = moveNotation(oldPiece, newPiece, fromRow, fromCol, toRow, toCol, isTile, promotions, check, enPassant);

        // log the move
        this.movesLog.push({oldPiece: oldPiece, newPiece: newPiece, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: notation, isTile: isTile, promotions: promotions});

        // keep track of half-moves for 50-fold repetition if no capture or pawn move
        if (oldPiece.type !== PieceType.EMPTY || newPiece.type === PieceType.PAWN) {
            this.halfmoveClock = 0;
        } else {
            this.halfmoveClock += 1;
            if (this.halfmoveClock >= 100) {
                this.endGame('Draw by 50-move rule!');
            }
        }

        // Send move to all players and spectators
        this.sendMessageToAll({ type: MESSAGE_TYPES.MOVE_PIECE, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: notation, isTile: isTile, promotions: promotions } satisfies MovePieceMessage);

        // change turns and handle clock
        this.changeTurn(true);

        // keep track of the number of times we've been in each position for 3 fold repetition
        this.updateFEN();      

        return true;
    }

    public rewind(): void {
        // originally I carefully undid every aspect of the move, but I think it's safer and easier to just replay all the moves
        if (this.movesLog.length === 0) {
            //console.log('Ignoring rewind with no moves played yet');
            return;
        }
        const lastMove = this.movesLog.pop()!;

        // loop through all the moves and keep track of castling
        this.KW = true;
        this.QW = true;
        this.KB = true;
        this.QB = true;
        this.board = getDefaultBoard();
        for (const move of this.movesLog) {
            moveOnBoard(this.board, move.fromRow, move.fromCol, move.toRow, move.toCol, move.isTile, move.promotions);
            [this.QW, this.KW, this.QB, this.KB] = checkCastle(this.board, this.QW, this.KW, this.QB, this.KB, this.rules);
        }

        // if it's currently a white turn, then we're undoing a black move, so black loses their increment
        if (this.currentTurn === PieceColor.WHITE) this.timeLeftBlack -= this.incrementBlack;
        else this.timeLeftWhite -= this.incrementWhite;

        // update the current turn (this will undo an end-of-game set to PieceColor.NONE)
        this.changeTurn(false);

        // resend the game state
        this.sendGameStateToAll();
    }

    public checkGameOver(): void {
        if (!anyValidMoves(this.currentTurn, this.board, this.movesLog.at(-1), this.rules)) {
            const playerName = this.currentTurn === PieceColor.WHITE ? this.playerWhite?.name : this.playerBlack?.name;
            if (inCheck(this.currentTurn, this.board)) {
                this.endGame(`${playerName} (${PieceColor[this.currentTurn]}) is in checkmate!`);
                if (this.movesLog.at(-1)) {
                    if (this.movesLog.at(-1)!.notation.endsWith('+')) {
                        this.movesLog.at(-1)!.notation = this.movesLog.at(-1)!.notation.slice(0, -1) + '#';
                    }
                    else {
                        this.movesLog.at(-1)!.notation += '#';
                    }
                }
            } else {
                this.endGame(`${playerName} (${PieceColor[this.currentTurn]}) is in stalemate!`);
                if (this.movesLog.at(-1)) this.movesLog.at(-1)!.notation += '$';
            }
            this.sendGameStateToAll();
        }
        if (this.timeLeftBlack < 0) {
            this.endGame(`${this.playerBlack?.name} (BLACK) has run out of time!`);
        }
        if (this.timeLeftWhite < 0) {
            this.endGame(`${this.playerWhite?.name} (WHITE) has run out of time!`);
        }
    }
}
