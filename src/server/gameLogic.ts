import { QueryResult } from 'pg';
import { PieceColor, PieceType, Piece, GameState, MESSAGE_TYPES, GameStateMessage, MovePieceMessage, Message, TimeMessage, ChatMessage, Move, Rules, RulesMessage, GameResultCause, GameScore } from '../shared/types.js';
import { inCheck, moveOnBoard, checkCastle, moveNotation, tileCanMove, wouldBeInCheck, sameColor, pieceCanMoveTo, anyValidMoves, getDefaultBoard, getBoardFromMessage, getFEN, getMoveDisambiguationStr, tileCanMoveTo, tileMoveWouldUndo, fenStripMoves, parseFEN, splitMovesFromNotation } from '../shared/utils.js'
import { sendMessage, ClientInfo } from './server.js';

export class Game {
    id: number;
    password = '';

    playerWhite: ClientInfo | null = null;   // string name sent to client
    playerBlack: ClientInfo | null = null;  // string name sent to client
    spectators: ClientInfo[] = [];  // string name sent to client

    board: Piece[][];
    chatLog: string[] = [];
    movesLog: Move[] = [];
    currentTurn: PieceColor = PieceColor.WHITE;

    useTimeControl: boolean;
    initialTimeWhite: number; // in seconds
    initialTimeBlack: number; // in seconds
    incrementWhite: number;   // in seconds
    incrementBlack: number;   // in seconds
    timeLeftWhite: number; // in seconds
    timeLeftBlack: number; // in seconds
    clockRunning = false;

    lastMoveTime = 0;  // not sent to client
    creationTime: number;

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
    arrayFEN: string[];

    rules: Rules = {
        ruleMoveOwnKing: true,
        ruleMoveOwnKingInCheck: true,
        ruleMoveOpp: true,
        ruleUndoTileMove: true,
        ruleMoveOppKing: true,
        ruleMoveOppCheck: true,
        ruleDoubleMovePawn: true,
        ruleCastleNormal: false,
        ruleCastleMoved: false,
        ruleEnPassantTile: false,
        ruleEnPassantTileHome: false,
        ruleIgnoreAll: false,
    }

    // database stuff
    result = GameResultCause.ONGOING;
    lastWhiteName = '';
    lastBlackName = '';
    isActive = true;

    public constructor(id: number, useTimeControl: boolean, initialTime: number, increment: number, password: string) {
        this.id = id;
        this.logChatMessage(`Game ${this.id} created.`);

        this.useTimeControl = useTimeControl;
        if (this.useTimeControl) {
            this.initialTimeWhite = initialTime;
            this.initialTimeBlack = initialTime;
            this.timeLeftWhite = initialTime;
            this.timeLeftBlack = initialTime;
            this.incrementWhite = increment;
            this.incrementBlack = increment;
        } else {
            this.initialTimeWhite = 0;
            this.initialTimeBlack = 0;
            this.timeLeftWhite = 0;
            this.timeLeftBlack = 0;
            this.incrementWhite = 0;
            this.incrementBlack = 0;
        }
        this.setPassword(password);

        this.board = getDefaultBoard();
        this.mapFEN = new Map<string, number>();
        this.arrayFEN = [];
        this.updateFEN();
        this.creationTime = Date.now();
    }

    public loadFromState(gameState: GameState): void {
        this.id = gameState.id;
        this.password = gameState.password;
        this.board = gameState.board;
        this.chatLog = gameState.chatLog;
        this.movesLog = gameState.movesLog;
        this.currentTurn = gameState.currentTurn;
        this.useTimeControl = gameState.useTimeControl;
        this.initialTimeWhite = gameState.initialTimeWhite;
        this.initialTimeBlack = gameState.initialTimeBlack;
        this.incrementWhite = gameState.incrementWhite;
        this.incrementBlack = gameState.incrementBlack;
        this.timeLeftWhite = gameState.timeLeftWhite;
        this.timeLeftBlack = gameState.timeLeftBlack;
        this.clockRunning = false;
        this.KW = gameState.KW;
        this.QW = gameState.QW;
        this.KB = gameState.KB;
        this.QB = gameState.QB;
        this.drawWhite = false;
        this.drawBlack = false;
        this.rules = {...this.rules, ...gameState.rules};
        this.halfmoveClock = gameState.halfmoveClock;
        this.creationTime = gameState.creationTime;

        this.arrayFEN = [];
        this.mapFEN = new Map<string, number>();
        for (const fen of gameState.arrayFEN) this.updateFEN(fen, fenStripMoves(fen));
    }

    public loadFromDB(row: any) {
        this.id = row.id;
        this.password = row.password;
        this.board = getDefaultBoard();

        this.creationTime = new Date(row.creation_timestamp).getTime();
        this.clockRunning = false;
        this.drawWhite = false;
        this.drawBlack = false;

        // these fields may be missing if it was saved incorrectly
        try {
            this.lastWhiteName = row.white;
            this.lastBlackName = row.black;
            this.chatLog = row.chat_log.split('|');

            // get board, castling permission, and draw conditions from the last recorded FEN
            const arrayFEN = JSON.parse(row.array_fen);
            this.arrayFEN = [];
            this.mapFEN = new Map<string, number>();
            for (const fen of arrayFEN) this.updateFEN(fen, fenStripMoves(fen));
            if (this.arrayFEN.length) this.setBoardFromFEN(this.arrayFEN.at(-1)!);
            else console.error('Failed to parse arrayFEN loaded from DB:', arrayFEN);

            this.movesLog = JSON.parse(row.moves_log);
            this.rules = {...this.rules, ...JSON.parse(row.rules)};

            this.useTimeControl = row.use_time_control;  // note: games before this waws added default to true in the DB
            this.initialTimeWhite = row.initial_time_white;
            this.initialTimeBlack = row.initial_time_black;
            this.incrementWhite = row.increment_white;
            this.incrementBlack = row.increment_black;
            this.timeLeftWhite = row.time_left_white;
            this.timeLeftBlack = row.time_left_black;
            this.result = GameResultCause[row.cause as GameResultCause];
            this.isActive = row.is_active;
        } catch (err) {
            console.log('Failed to load game from DB state', err);
            console.log(row);
        }
    }

    public getDBStr(): string {
        const cols = ['password', 'white', 'black', 'chat_log', 'moves_log', 'whites_turn',
                      'initial_time_white', 'initial_time_black', 'increment_white', 'increment_black', 'time_left_white', 'time_left_black', 
                      'rules', 'result', 'cause', 'is_active', 'array_fen', 'use_time_control'];

        let chatLogStr = this.chatLog.join('|');
        chatLogStr.replace(/\n/g, '|');  // some individual messages will have newlines in them. Replace those too. This will make them be treated as separate messages on reload but oh well

        const vals = [this.password, this.lastWhiteName, this.lastBlackName, chatLogStr, JSON.stringify(this.movesLog), this.currentTurn === PieceColor.WHITE,
                      this.initialTimeWhite, this.initialTimeBlack, this.incrementWhite, this.incrementBlack, this.timeLeftWhite, this.timeLeftBlack,
                      JSON.stringify(this.rules), GameScore.get(this.result), this.result, this.isActive, JSON.stringify(this.arrayFEN), this.useTimeControl];

        let colEqVal = '';
        for (let i = 0; i < cols.length; i++) {
            if (i) colEqVal += ', ';
            if (typeof vals[i] === 'string') {
                colEqVal += `${cols[i]} = '${vals[i]}'`;
            } else if (typeof vals[i] === 'boolean') {
                colEqVal += `${cols[i]} = ${vals[i] ? 'TRUE' : 'FALSE'}`;
            } else if (vals[i] === undefined) {
                console.error('Undefined value when saving to db:', cols[i], vals[i]);
            } else {
                colEqVal += `${cols[i]} = ${vals[i]}`;
            }
        }

        return colEqVal;
    }

    public updateLastNames(): void {
        if (this.playerWhite) this.lastWhiteName = this.playerWhite.name;
        if (this.playerBlack) this.lastBlackName = this.playerBlack.name;
    }

    public setPassword(password: string, client?: ClientInfo): void {
        this.password = password;
        this.sendMessageToAll({ type: MESSAGE_TYPES.GAME_PASSWORD, password: password });
        if (client) this.logChatMessage(`has ${password !== '' ? 'updated' : 'removed'} the password`, client);
    }

    public updateFEN(fen?: string, fenNoMoves?: string): void {
        if (fen === undefined || fenNoMoves === undefined) {
            const {fen, fenNoMoves} = getFEN(this.board, this.currentTurn, this.QW, this.KW, this.QB, this.KB, this.halfmoveClock, Math.floor(this.movesLog.length / 2) + 1);
            this.updateFEN(fen, fenNoMoves);  // recursion?? in my program??
            return;
        }
        
        this.arrayFEN.push(fen);
        if (this.mapFEN.has(fenNoMoves)) {
            this.mapFEN.set(fenNoMoves, this.mapFEN.get(fenNoMoves)! + 1)
            if (this.mapFEN.get(fenNoMoves)! >= 3) {
                this.endGame(GameResultCause.THREEFOLD_REPETITION, 'Draw by 3-fold repetition')
            }
        } else {
            this.mapFEN.set(fenNoMoves, 1);
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

    public setBoardFromFEN(fen: string): void {
        const ret = parseFEN(fen);
        this.board = ret.board;
        this.QW = ret.QW;
        this.KW = ret.KW;
        this.QB = ret.QB;
        this.KB = ret.KB;
        this.halfmoveClock = ret.halfmoveClock;
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
            this.halfmoveClock = ret.halfmoveClock;
            this.mapFEN = ret.mapFEN;
            this.arrayFEN = ret.arrayFEN;
        }
    }

    public getPlayer(color: PieceColor): ClientInfo | undefined {
        if (color === PieceColor.WHITE && this.playerWhite) return this.playerWhite;
        else if (color === PieceColor.BLACK && this.playerBlack) return this.playerBlack;
        else return undefined;
    }

    public getColor(client: ClientInfo): PieceColor {
        return client === this.playerWhite ? PieceColor.WHITE : (client === this.playerBlack ? PieceColor.BLACK : PieceColor.NONE);
    }

    public addPlayer(player: ClientInfo, color = PieceColor.NONE): void {
        // figure out if we're reconnecting someone and try to put them in the right spot
        if (color === PieceColor.NONE) {
            if (!this.playerWhite && this.lastWhiteName === player.name) color = PieceColor.WHITE;
            else if (!this.playerBlack && this.lastBlackName === player.name) color = PieceColor.BLACK;
        }

        // if the player spot is already filled, then make them a spectator and log a message
        const bumped = ((color === PieceColor.WHITE && this.playerWhite) || (color === PieceColor.BLACK && this.playerBlack));
        if (color === PieceColor.WHITE && !this.playerWhite) {
            this.playerWhite = player;
            player.gamePosition = PieceColor.WHITE
        } else if (color === PieceColor.BLACK && !this.playerBlack) {
            this.playerBlack = player;
            player.gamePosition = PieceColor.BLACK
        } else {
            this.spectators.push(player);
            player.gamePosition = PieceColor.NONE
        }
        this.sendGameStateToAll();

        if (bumped) {
            this.logChatMessage(`Player ${player.name} tried to join as ${PieceColor[color]}, but that position was already filled.`);
        } else {
            this.logChatMessage(`Player ${player.name} has joined as ${color === PieceColor.NONE ? 'a spectator' : PieceColor[color]}.`);
        }
        this.updateLastNames();
    }

    public changePosition(c: ClientInfo, position: PieceColor): void {
        if (c.gameId !== this.id) {
            console.error(`Client ${c.id} (${c.name}) is in game ${c.gameId}, not ${this.id}`);
            return;
        }

        const originalPosition = this.getColor(c);
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
                c.gamePosition = PieceColor.WHITE
                break;
            case PieceColor.BLACK:
                this.playerBlack = c;
                c.gamePosition = PieceColor.BLACK
                break;
            case PieceColor.NONE:
                this.spectators.push(c);
                c.gamePosition = PieceColor.NONE
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
        this.updateLastNames();
    }

    public removePlayer(player: ClientInfo): void {
        this.updateLastNames();
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
        this.sendMessageToAll({type: MESSAGE_TYPES.TIME, useTimeControl: this.useTimeControl,
                               initialTimeWhite: this.initialTimeWhite, initialTimeBlack: this.initialTimeBlack, 
                               timeLeftWhite: this.timeLeftWhite, timeLeftBlack: this.timeLeftBlack, 
                               incrementWhite: this.incrementWhite, incrementBlack: this.incrementBlack,
                               clockRunning: this.clockRunning} satisfies TimeMessage);
    }

    public applyElapsedTime(): void {
        if (this.useTimeControl) {
            const newTime = Date.now();
            if (this.clockRunning) {
                if (this.currentTurn === PieceColor.WHITE) this.timeLeftWhite -= (newTime - this.lastMoveTime) / 1000;
                else if (this.currentTurn === PieceColor.BLACK) this.timeLeftBlack -= (newTime - this.lastMoveTime) / 1000;
            }
            this.lastMoveTime = newTime;
        }
    }

    public applyTimeAndPause(): void {
        if (this.useTimeControl) {
            this.applyElapsedTime();
            this.clockRunning = false;
            this.syncTime();
        }
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
            this.sendGameStateToAll();
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
            password: this.password,
            board: this.board,
            chatLog: this.chatLog,
            movesLog: this.movesLog,
            currentTurn: this.currentTurn,
            useTimeControl: this.useTimeControl,
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
            rules: this.rules,
            halfmoveClock: this.halfmoveClock,
            arrayFEN: this.arrayFEN,
            creationTime: this.creationTime
        };
        const clientColor = this.getColor(client);
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
        this.rules = {...this.rules, ...rules};
        this.sendMessageToAll({ type: MESSAGE_TYPES.RULES, rules: this.rules } satisfies RulesMessage);
    }

    public endGame(result: GameResultCause, chatMessage: string): void {
        this.updateLastNames();
        this.result = result;
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
            this.endGame(GameResultCause.DRAW, 'Draw accepted. Game over!')
        }

    }

    public surrender(client: ClientInfo): void {
        if (client === this.playerWhite) {
            if (this.confirmSurrenderWhite) {
                this.endGame(GameResultCause.WHITE_RESIGN, `${client.name} (WHITE) has surrendered. Game over!`)
            } else {
                this.confirmSurrenderWhite = true;
                sendMessage(client, {type: MESSAGE_TYPES.CHAT, message: 'Click surrender again to confirm'} satisfies ChatMessage);
            }
        } else if (client === this.playerBlack) {
            if (this.confirmSurrenderBlack) {
                this.endGame(GameResultCause.BLACK_RESIGN, `${client.name} (BLACK) has surrendered. Game over!`)
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
        if (this.useTimeControl) {
            this.clockRunning = true;
            this.syncTime();
        }
    }

    public move(c: ClientInfo, fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]): boolean {
        // bounds check
        if (fromRow < 0 || fromRow > 7 || fromCol < 0 || fromCol > 7 || toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;

        // reject a move to the same spot (they're probably just deselecting)
        if (fromRow === toRow && fromCol === toCol) return false;

        // reject if the game is over
        if (this.currentTurn === PieceColor.NONE) return false;

        // reject if it's not the player's turn
        if (c !== this.getPlayer(this.currentTurn)) return false;

        if (!this.rules.ruleIgnoreAll) {
            // reject if the piece doesn't belong to the player
            if (!isTile && !sameColor(this.board[fromRow][fromCol].color, this.currentTurn)) return false;

            // reject if they'd be in check after
            if (wouldBeInCheck(this.currentTurn, this.board, fromRow, fromCol, toRow, toCol, isTile)) return false;

            // reject tile move if either tile is pinned
            const currentlyInCheck = inCheck(this.currentTurn, this.board);
            if (isTile && (!tileCanMove(fromRow, fromCol, this.board, this.currentTurn, currentlyInCheck, this.rules)
                            || !tileCanMove(toRow, toCol, this.board, this.currentTurn, currentlyInCheck, this.rules))) return false;
            
            // reject piece move if it's impossible for the piece to reach (ignoring checks and rules)
            if (!isTile && !pieceCanMoveTo(fromRow, fromCol, toRow, toCol, this.board, this.movesLog.at(-1))) return false;
            if (isTile && !tileCanMoveTo(fromRow, fromCol, toRow, toCol)) return false;

            // reject if it would completely undo the previous move
            if (this.rules.ruleUndoTileMove && isTile && tileMoveWouldUndo(fromRow, fromCol, toRow, toCol, this.board, this.arrayFEN)) return false;
        }

        // before moving, grab the disambiguation info
        const disambiguation = isTile ? '' : getMoveDisambiguationStr(fromRow, fromCol, toRow, toCol, this.board[fromRow][fromCol].type, this.currentTurn, this.board);

        // do the move!
        const {oldPiece, newPiece, enPassant} = moveOnBoard(this.board, fromRow, fromCol, toRow, toCol, isTile, promotions);


        // check if castling is still allowed
        [this.QW, this.KW, this.QB, this.KB] = checkCastle(this.board, this.QW, this.KW, this.QB, this.KB, this.rules);
        
        // determine if the other player is now in check
        const check = inCheck(this.currentTurn === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE, this.board);

        // get move notation
        const notation = moveNotation(oldPiece, newPiece, fromRow, fromCol, toRow, toCol, disambiguation, isTile, promotions, check, enPassant);

        // log the move
        this.movesLog.push({oldPiece: oldPiece, newPiece: newPiece, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: notation, isTile: isTile, promotions: promotions});

        // keep track of half-moves for the 50 move rule if no capture or pawn move
        if ((oldPiece.type !== PieceType.EMPTY && oldPiece.type !== PieceType.TILE) || newPiece.type === PieceType.PAWN) {
            this.halfmoveClock = 0;
        } else {
            this.halfmoveClock += 1;
            if (this.halfmoveClock >= 100) {
                this.endGame(GameResultCause.FIFTY_MOVE, 'Draw by 50-move rule!');
            }
        }

        // Send move to all players and spectators
        this.sendMessageToAll({ type: MESSAGE_TYPES.MOVE_PIECE, fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, notation: notation, isTile: isTile, promotions: promotions } satisfies MovePieceMessage);

        // change turns and handle clock
        this.changeTurn(true);

        // keep track of the number of times we've been in each position for 3 fold repetition
        this.updateFEN();    

        // usually players check if they're in checkmate themselves. If the next player is absent, we need to check ourselves
        if (!this.getPlayer(this.currentTurn)) this.checkGameOver();

        return true;
    }

    public rewind(): void {
        // originally I carefully undid every aspect of the move, but I think it's safer and easier to just replay all the moves
        if (this.movesLog.length === 0) {
            //console.log('Ignoring rewind with no moves played yet');
            return;
        }
        // set the turn by counting the moves rather than this.currentTurn, because this.currentTurn may have been set to PieceColor.NONE by this.endGame
        this.currentTurn = this.movesLog.length % 2 ? PieceColor.BLACK : PieceColor.WHITE;
        const lastMove = this.movesLog.pop()!;

        // undo draw conditions
        this.halfmoveClock -= 1;
        const fenNoMoves = fenStripMoves(this.arrayFEN.pop()!);
        this.mapFEN.set(fenNoMoves, this.mapFEN.get(fenNoMoves)! - 1);


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
                if (this.currentTurn === PieceColor.WHITE) {
                    this.endGame(GameResultCause.WHITE_IN_CHECKMATE, `${playerName} (White) is in checkmate!`);
                } else {
                    this.endGame(GameResultCause.BLACK_IN_CHECKMATE, `${playerName} (Black) is in checkmate!`);
                }

                if (this.movesLog.at(-1)) {
                    if (this.movesLog.at(-1)!.notation.endsWith('+')) {
                        this.movesLog.at(-1)!.notation = this.movesLog.at(-1)!.notation.slice(0, -1) + '#';
                    }
                    else {
                        this.movesLog.at(-1)!.notation += '#';
                    }
                }
            } else {
                if (this.currentTurn === PieceColor.WHITE) {
                    this.endGame(GameResultCause.WHITE_IN_STALEMATE, `${playerName} (White) is in stalemate!`);
                } else {
                    this.endGame(GameResultCause.BLACK_IN_STALEMATE, `${playerName} (Black) is in stalemate!`);
                }
                if (this.movesLog.at(-1)) this.movesLog.at(-1)!.notation += '$';
            }
            this.sendGameStateToAll();
        }
        if (this.useTimeControl) {
            if (this.timeLeftBlack < 0) {
                this.endGame(GameResultCause.BLACK_TIMEOUT, `${this.playerBlack?.name} (BLACK) has run out of time!`);
            }
            if (this.timeLeftWhite < 0) {
                this.endGame(GameResultCause.WHITE_TIMEOUT, `${this.playerWhite?.name} (WHITE) has run out of time!`);
            }
        }
    }
}
