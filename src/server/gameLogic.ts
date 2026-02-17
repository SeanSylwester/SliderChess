import { PieceColor, PieceType, Piece, GameState, MESSAGE_TYPES, GameStateMessage, MovePieceMessage, Message, TimeMessage, ChatMessage, Move, Rules, RulesMessage, GameResultCause, GameScore, PopupMessage, RulesAgreementMessage, GameInfo, GameNamesMessage, CompressedGameState } from '../shared/types.js';
import { inCheck, moveOnBoard, checkCastle, moveNotation, anyValidMoves, getDefaultBoard, getBoardFromMessage, getFEN, getMoveDisambiguationStr, fenStripMoves, parseFEN, checkRules, compressMovesLog, decompressMovesLog } from '../shared/utils.js'
import { sendMessage, ClientInfo } from './server.js';

const undoText = 'Your opponent has requested an undo.';
const shuffleText = 'Your opponent has requested to randomly assign colors.';
const unlockRulesText = 'Your opponent has requested to unlock the rules.';

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
    waitingForUndoResponse = 0;  // number shows how many rewinds they're requesting
    waitingForShuffleResponse = false;
    waitingForUnlockRulesResponse = false;
    rulesLocked = false;
    rulesMap = new Map<ClientInfo, Rules>();
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
    lastNameWhite = '';
    lastNameBlack = '';
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
        this.lastNameWhite = gameState.playerWhiteName || '';
        this.lastNameBlack = gameState.playerBlackName || '';
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
        this.rulesLocked = gameState.rulesLocked;
        this.halfmoveClock = gameState.halfmoveClock;
        this.creationTime = gameState.creationTime;

        this.arrayFEN = [];
        this.mapFEN = new Map<string, number>();
        for (const fen of gameState.arrayFEN) this.updateFEN(fen, fenStripMoves(fen));

        this.sendGameStateToAll();
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
            this.lastNameWhite = row.white;
            this.lastNameBlack = row.black;
            this.chatLog = row.chat_log.split('\n');

            // get board, castling permission, and draw conditions from the last recorded FEN
            const arrayFEN = JSON.parse(row.array_fen);
            this.arrayFEN = [];
            this.mapFEN = new Map<string, number>();
            for (const fen of arrayFEN) this.updateFEN(fen, fenStripMoves(fen));
            this.setBoardFromFEN(this.arrayFEN.at(-1));

            this.movesLog = decompressMovesLog(row.moves_log);
            this.rules = {...this.rules, ...JSON.parse(row.rules)};
            this.rulesLocked = this.movesLog.length > 0;

            this.useTimeControl = row.use_time_control;  // note: games before this was added default to true in the DB
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

    public getDBStr(): {colNames: string[], vals: (string | null)[]} {
        const colNames = ['password', 'white', 'black', 'chat_log', 'moves_log', 'whites_turn',
                          'initial_time_white', 'initial_time_black', 'increment_white', 'increment_black', 'time_left_white', 'time_left_black', 
                          'rules', 'result', 'cause', 'is_active', 'array_fen', 'use_time_control'];

        const valsRaw = [this.password, this.lastNameWhite, this.lastNameBlack, this.chatLog.join('\n'), compressMovesLog(this.movesLog), this.currentTurn === PieceColor.WHITE,
                      this.initialTimeWhite, this.initialTimeBlack, this.incrementWhite, this.incrementBlack, this.timeLeftWhite, this.timeLeftBlack,
                      JSON.stringify(this.rules), GameScore.get(this.result), this.result, this.isActive, JSON.stringify(this.arrayFEN), this.useTimeControl];
        
        const vals = valsRaw.map((val, i) => {
            if (typeof val === 'boolean') {
                return val ? 'TRUE' : 'FALSE';
            } else if (val === undefined || val === null) {
                console.error('Undefined or null value when saving to db:', colNames[i], val);
                return null;
            } else {
                return `${val}`;
            }
        });

        return {colNames, vals};
    }

    public updateLastNames(): void {
        if (this.playerWhite) this.lastNameWhite = this.playerWhite.name;
        if (this.playerBlack) this.lastNameBlack = this.playerBlack.name;
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

    public setBoardFromFEN(fen: string | undefined): void {
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
        const ret = getBoardFromMessage(notationString, newBoard, this.rules);
        if (typeof ret === 'string') {
            return ret;
        }

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
        this.sendGameStateToAll();
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
            if (!this.playerWhite && this.lastNameWhite === player.name) color = PieceColor.WHITE;
            else if (!this.playerBlack && this.lastNameBlack === player.name) color = PieceColor.BLACK;
        }

        // if the player spot is already filled, then make them a spectator and log a message
        let checkRules: boolean;
        const bumped = ((color === PieceColor.WHITE && this.playerWhite) || (color === PieceColor.BLACK && this.playerBlack));
        if (color === PieceColor.WHITE && !this.playerWhite) {
            this.playerWhite = player;
            player.gamePosition = PieceColor.WHITE
            checkRules = true;
        } else if (color === PieceColor.BLACK && !this.playerBlack) {
            this.playerBlack = player;
            player.gamePosition = PieceColor.BLACK
            checkRules = true;
        } else {
            this.spectators.push(player);
            player.gamePosition = PieceColor.NONE
            checkRules = false;
        }

        if (bumped) {
            this.logChatMessage(`Player ${player.name} tried to join as ${PieceColor[color]}, but that position was already filled.`);
        } else {
            this.logChatMessage(`Player ${player.name} has joined as ${color === PieceColor.NONE ? 'a spectator' : PieceColor[color]}.`);
        }
        this.updateLastNames();

        // send the latest rules when they first join
        sendMessage(player, {type: MESSAGE_TYPES.RULES, rules: this.rules, rulesLocked: this.rulesLocked} satisfies RulesMessage);  
        this.rulesMap.set(player, { ...this.rules });
        if (this.isActive && !this.rulesLocked && checkRules) this.sendRulesAgreement();

        // send names to everyone AND this player
        this.sendNamesToAll();

        // send the compressed game state, excluding rules and names
        this.sendGameState(player);
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

        this.updateLastNames();
        this.sendNamesToAll();
        if (this.isActive && !this.rulesLocked && (position != PieceColor.NONE || originalPosition != PieceColor.NONE)) this.sendRulesAgreement();
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
        this.sendNamesToAll();
    }

    public requestShuffle(client: ClientInfo): void {
        let opp: ClientInfo | null;
        if (client === this.playerWhite) {
            opp = this.playerBlack;
        } else if (client === this.playerBlack) {
            opp = this.playerWhite;
        } else {
            return;
        }
        if (!opp) return;
        this.logChatMessage('has requested to randomly assign colors.', client);
        this.waitingForShuffleResponse = true;
        
        sendMessage(opp, { type: MESSAGE_TYPES.POPUP, text: shuffleText, button: ['Agree', 'Disagree']} satisfies PopupMessage);
    }

    public sendNamesToAll(): void {
        for (const client of this.allClients()) {
            sendMessage(client, { type: MESSAGE_TYPES.GAME_NAMES, 
                playerWhiteName: this.playerWhite?.name ?? null,
                playerBlackName: this.playerBlack?.name ?? null,
                spectatorNames: this.spectators.map(s => s.name),
                yourColor: this.getColor(client)} satisfies GameNamesMessage);
        }
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
                    this.timeLeftWhite = parseInt(match.groups!.time) * 60;
                    this.initialTimeWhite = this.timeLeftWhite + elapsedTime;
                }
                if (match.groups!.increment) {
                    this.incrementWhite = parseInt(match.groups!.increment);
                }
            }
            if (match.groups!.colors.includes('b')) {
                if (match.groups!.time) {
                    // total time is the new time setting plus the already elapsed time
                    const elapsedTime = this.initialTimeBlack - this.timeLeftBlack;
                    this.timeLeftBlack = parseInt(match.groups!.time) * 60;
                    this.initialTimeBlack = this.timeLeftBlack + elapsedTime;
                }
                if (match.groups!.increment) {
                    this.incrementBlack = parseInt(match.groups!.increment);
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
        if (client?.isAdmin && message.trim().startsWith('1.')) {
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

    public getGameInfo(): GameInfo {
        return {
            hasPassword: this.password !== '',
            gameId: this.id, 
            playerWhite: this.playerWhite?.name || null,
            playerBlack: this.playerBlack?.name || null, 
            lastNameWhite: this.lastNameWhite,
            lastNameBlack: this.lastNameBlack, 
            numberOfSpectators: this.spectators.length,
            timeLeftWhite: this.timeLeftWhite, 
            timeLeftBlack: this.timeLeftBlack,
            creationTime: this.creationTime,
            result: this.result,
            isActive: this.isActive,
            useTimeControl: this.useTimeControl,
            currentTurn: this.currentTurn
        }
    }

    public sendGameState(client: ClientInfo): void {
        const compressedGameState: CompressedGameState = {
            id: this.id,
            password: this.password,
            chatLog: this.chatLog,
            compressedMovesLog: compressMovesLog(this.movesLog),
            currentTurn: this.currentTurn,
            useTimeControl: this.useTimeControl,
            initialTimeWhite: this.initialTimeWhite,
            initialTimeBlack: this.initialTimeBlack,
            incrementWhite: this.incrementWhite,
            incrementBlack: this.incrementBlack,
            timeLeftWhite: this.timeLeftWhite,
            timeLeftBlack: this.timeLeftBlack,
            clockRunning: this.clockRunning,
            drawWhite: this.drawWhite,
            drawBlack: this.drawBlack,
            creationTime: this.creationTime,
            isActive: this.isActive
        };
        const clientColor = this.getColor(client);
        sendMessage(client, { type: MESSAGE_TYPES.GAME_STATE, compressedGameState: compressedGameState, yourColor: clientColor } satisfies GameStateMessage);
    }

    public sendGameStateToAll(): void {
        for (const client of this.allClients()) {
            this.sendGameState(client);
        }
    }

    public unlockRules(client: ClientInfo): void {
        let opp: ClientInfo | null;
        if (client === this.playerWhite) {
            opp = this.playerBlack;
        } else if (client === this.playerBlack) {
            opp = this.playerWhite;
        } else {
            return;
        }
        if (!opp) return;
        this.logChatMessage('has requested to unlock the rules.', client);
        this.waitingForUnlockRulesResponse = true;
        
        sendMessage(opp, { type: MESSAGE_TYPES.POPUP, text: unlockRulesText, button: ['Agree', 'Disagree']} satisfies PopupMessage);
    }

    public haveBothRules(): boolean {
        return this.playerWhite !== null && this.rulesMap.has(this.playerWhite) && 
               this.playerBlack !== null && this.rulesMap.has(this.playerBlack);
    }

    public checkRulesAgreement(): boolean {
        return this.haveBothRules() && JSON.stringify(this.rulesMap.get(this.playerWhite!)) === JSON.stringify(this.rulesMap.get(this.playerBlack!));
    }

    public sendRulesAgreement(): void {
        let rulesAgreement: Rules;
        const haveBoth = this.haveBothRules();
        if (!haveBoth) {
            rulesAgreement = {
                ruleMoveOwnKing: true,
                ruleMoveOwnKingInCheck: true,
                ruleMoveOpp: true,
                ruleUndoTileMove: true,
                ruleMoveOppKing: true,
                ruleMoveOppCheck: true,
                ruleDoubleMovePawn: true,
                ruleCastleNormal: true,
                ruleCastleMoved: true,
                ruleEnPassantTile: true,
                ruleEnPassantTileHome: true,
                ruleIgnoreAll: true,
            };
        } else {
            const white = this.rulesMap.get(this.playerWhite!)!;
            const black = this.rulesMap.get(this.playerBlack!)!;
            rulesAgreement = {
                ruleMoveOwnKing: white.ruleMoveOwnKing === black.ruleMoveOwnKing,
                ruleMoveOwnKingInCheck: white.ruleMoveOwnKingInCheck === black.ruleMoveOwnKingInCheck,
                ruleMoveOpp: white.ruleMoveOpp === black.ruleMoveOpp,
                ruleUndoTileMove: white.ruleUndoTileMove === black.ruleUndoTileMove,
                ruleMoveOppKing: white.ruleMoveOppKing === black.ruleMoveOppKing,
                ruleMoveOppCheck: white.ruleMoveOppCheck === black.ruleMoveOppCheck,
                ruleDoubleMovePawn: white.ruleDoubleMovePawn === black.ruleDoubleMovePawn,
                ruleCastleNormal: white.ruleCastleNormal === black.ruleCastleNormal,
                ruleCastleMoved: white.ruleCastleMoved === black.ruleCastleMoved,
                ruleEnPassantTile: white.ruleEnPassantTile === black.ruleEnPassantTile,
                ruleEnPassantTileHome: white.ruleEnPassantTileHome === black.ruleEnPassantTileHome,
                ruleIgnoreAll: white.ruleIgnoreAll === black.ruleIgnoreAll,
            };
        }
        this.sendMessageToAll({ type: MESSAGE_TYPES.RULES_AGREEMENT, rulesAgreement: rulesAgreement, haveBoth: haveBoth, rulesLocked: this.rulesLocked } satisfies RulesAgreementMessage);
    }

    public updateRules(client: ClientInfo, rules: Rules): void {
        if (this.isActive && !this.rulesLocked  && (client === this.playerWhite || client === this.playerBlack)) {
            this.rulesMap.set(client, rules);
            this.rules = {...this.rules, ...rules};  // the most recent rules are the ones sent to new players
            this.sendRulesAgreement();

            // update the rules of all the spectators (whose checkboxes should be disabled!) but not the other player
            for (const spectator of this.spectators) {
                sendMessage(spectator, {type: MESSAGE_TYPES.RULES, rules: this.rules, rulesLocked: this.rulesLocked} satisfies RulesMessage);
                this.rulesMap.set(spectator, this.rules);
            }
        } else {
            // if the rules aren't changeable, then this will uncheck whatever rules they're trying to send
            sendMessage(client, {type: MESSAGE_TYPES.RULES, rules: this.rules, rulesLocked: this.rulesLocked} satisfies RulesMessage);
        }
    }

    public endGame(result: GameResultCause, chatMessage: string): void {
        this.updateLastNames();
        this.result = result;
        this.logChatMessage(chatMessage);
        this.clockRunning = false;
        this.sendGameStateToAll();
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

        // start clock (in case it was paused)
        if (this.useTimeControl) {
            this.clockRunning = true;
        }
    }

    public move(c: ClientInfo, fromRow: number, fromCol: number, toRow: number, toCol: number, isTile: boolean, promotions: {row: number, col: number, piece: Piece}[]): boolean {
        // if rules are unlocked, then check if they match before continuing. Allow a move before both players join, though (mostly for debugging purposes)
        if (!this.rulesLocked && this.haveBothRules()) { 
            if (!this.checkRulesAgreement()) {
                this.logChatMessage('Agree on the rules before beginning!');
                return false;
            } else {
                this.logChatMessage('Rules locked!');
                this.rulesLocked = true;
                // the playerWhite and playerBlack rules should be identical at this point, so I just grab playerWhite here.
                // I'm not positive that we _dont'_ need to update it here, so I'm just doing it to be safe
                this.rules = {...this.rules, ...this.rulesMap.get(this.playerWhite!)};
                this.sendRulesAgreement();  // basically just to tell them that the rules are locked now. They should match
            }
        }

        // bounds check
        if (fromRow < 0 || fromRow > 7 || fromCol < 0 || fromCol > 7 || toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;

        // reject a move to the same spot (they're probably just deselecting)
        if (fromRow === toRow && fromCol === toCol) return false;

        // reject if the game is over
        if (this.result !== GameResultCause.ONGOING) return false;

        // reject if it's not the player's turn
        if (c !== this.getPlayer(this.currentTurn)) return false;

        // reject invalid moves
        const isInCheck = inCheck(this.currentTurn, this.board);
        if (!checkRules(this.board, fromRow, fromCol, toRow, toCol, isTile, this.currentTurn, this.rules, this.movesLog.at(-1), this.arrayFEN, isInCheck)) return false;

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

        // change turns and handle clock
        this.changeTurn(true);

        // keep track of the number of times we've been in each position for 3 fold repetition
        this.updateFEN();    

        // usually players check if they're in checkmate themselves. If the next player is absent, we need to check ourselves
        if (!this.getPlayer(this.currentTurn)) this.checkGameOver();

        // Send move to all players and spectators
        this.sendMessageToAll({ type: MESSAGE_TYPES.MOVE_PIECE, fromRow, fromCol, toRow, toCol, notation, isTile, promotions, timeLeftWhite: this.timeLeftWhite, timeLeftBlack: this.timeLeftBlack, clockRunning: this.clockRunning } satisfies MovePieceMessage);

        return true;
    }

    public handlePopupRepsonse(client: ClientInfo, message: PopupMessage): void {
        switch (message.text) {
            case undoText:
                if (this.waitingForUndoResponse) {
                    if (message.button === 'Approve') {
                        this.logChatMessage('has approved the undo.', client);
                        for ( ;this.waitingForUndoResponse; this.waitingForUndoResponse--) this.rewind();
                    } else {
                        this.logChatMessage('has rejected the undo.', client);
                    }
                }
                break;

            case unlockRulesText:
                if (this.waitingForUnlockRulesResponse) {
                    this.waitingForUnlockRulesResponse = false;
                    if (message.button === 'Agree') {
                        this.logChatMessage('has agreed to unlock the rules.', client);
                        this.rulesLocked = false;
                        this.applyTimeAndPause();  // negotiating time
                        this.sendRulesAgreement();   // basically just to tell them that the rules are locked now. They should match
                    } else {
                        this.logChatMessage('has declined to unlock the rules.', client);
                    }
                }
                break;

            case shuffleText:
                if (this.waitingForShuffleResponse) {
                    this.waitingForShuffleResponse = false;
                    if (message.button === 'Agree') {
                        this.logChatMessage('has agreed to randomly assign colors.', client);
                        if (Math.random() < 0.5) {
                            this.logChatMessage(`Randomly decided to swap colors!\nMoving ${this.playerBlack?.name} to White and ${this.playerWhite?.name} to Black.`);
                            const temp = this.playerWhite;
                            this.playerWhite = this.playerBlack;
                            this.playerBlack = temp;
                            this.updateLastNames();
                            this.sendNamesToAll();
                        } else {
                            this.logChatMessage('Randomly decided to keep the same colors');
                        }
                    } else {
                        this.logChatMessage('has declined to randomly assign colors.', client);
                    }
                }
                break;


            default:
                console.error(`Unknown popup response on game ${this.id}:`, message);
        }
    }

    public requestUndo(client: ClientInfo): void {
        // you can only request an undo on your opponent's turn
        let opp: ClientInfo | null;
        let double = false;
        if (client === this.playerWhite) {
            double = this.currentTurn === PieceColor.WHITE;
            opp = this.playerBlack;
        } else if (client === this.playerBlack) {
            double = this.currentTurn === PieceColor.BLACK;
            opp = this.playerWhite;
        } else {
            return;
        }
        if (!opp) return;
        this.logChatMessage('has requested an undo.', client);
        this.waitingForUndoResponse = double ? 2 : 1;
        
        sendMessage(opp, { type: MESSAGE_TYPES.POPUP, text: undoText, button: ['Approve', 'Reject']} satisfies PopupMessage);
    }

    public rewind(): void {
        // originally I carefully undid every aspect of the move, but I think it's safer and easier to just replay all the moves
        if (this.movesLog.length === 0) {
            //console.log('Ignoring rewind with no moves played yet');
            return;
        }
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

        // update the current turn
        this.changeTurn(false);

        // resend the game state
        this.result = GameResultCause.ONGOING;
        this.sendGameStateToAll();
    }

    public checkGameOver(): void {
        if (!anyValidMoves(this.currentTurn, this.board, this.movesLog.at(-1), this.rules, this.arrayFEN)) {
            const playerName = this.currentTurn === PieceColor.WHITE ? this.playerWhite?.name : this.playerBlack?.name;
            if (inCheck(this.currentTurn, this.board)) {
                if (this.movesLog.at(-1)) {
                    if (this.movesLog.at(-1)!.notation.endsWith('+')) {
                        this.movesLog.at(-1)!.notation = this.movesLog.at(-1)!.notation.slice(0, -1) + '#';
                    }
                    else {
                        this.movesLog.at(-1)!.notation += '#';
                    }
                }

                if (this.currentTurn === PieceColor.WHITE) {
                    this.endGame(GameResultCause.WHITE_IN_CHECKMATE, `${playerName} (White) is in checkmate!`);
                } else {
                    this.endGame(GameResultCause.BLACK_IN_CHECKMATE, `${playerName} (Black) is in checkmate!`);
                }
            } else {
                if (this.movesLog.at(-1)) this.movesLog.at(-1)!.notation += '$';

                if (this.currentTurn === PieceColor.WHITE) {
                    this.endGame(GameResultCause.WHITE_IN_STALEMATE, `${playerName} (White) is in stalemate!`);
                } else {
                    this.endGame(GameResultCause.BLACK_IN_STALEMATE, `${playerName} (Black) is in stalemate!`);
                }
            }
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
