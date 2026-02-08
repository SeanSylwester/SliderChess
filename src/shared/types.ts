export interface Move {
    oldPiece: Piece;
    newPiece: Piece;
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    notation: string;
    isTile: boolean;
    promotions: {row: number, col: number, piece: Piece}[]
}

export interface GameState {
    playerWhiteName: string | null;
    playerBlackName: string | null;
    spectatorNames: string[];
    id: number;
    password: string;
    board: Piece[][];
    chatLog: string[];
    movesLog: Move[];
    currentTurn: PieceColor;
    useTimeControl: boolean;
    initialTimeWhite: number; // in seconds
    initialTimeBlack: number; // in seconds
    incrementWhite: number;   // in seconds
    incrementBlack: number;   // in seconds
    timeLeftWhite: number; // in seconds
    timeLeftBlack: number; // in seconds
    clockRunning: boolean;
    KW: boolean;
    QW: boolean;
    KB: boolean;
    QB: boolean;
    drawWhite: boolean;
    drawBlack: boolean;
    rules: Rules;
    rulesLocked: boolean;
    halfmoveClock: number;
    arrayFEN: string[];  // converted from Map<string, number> to string[], with each copy of string being copied number times
    creationTime: number;
    isActive: boolean;
}
export interface GameInfo {
    hasPassword: boolean;
    password?: string;  // client will store known passwords here
    gameId: number;
    playerWhite: string | null;
    playerBlack: string | null;
    lastNameWhite: string | null;
    lastNameBlack: string | null;
    numberOfSpectators: number;
    timeLeftWhite: number; // in seconds
    timeLeftBlack: number; // in seconds
    creationTime: number;
    result: GameResultCause;
    isActive: boolean;
    useTimeControl: boolean;
    currentTurn: PieceColor;
}

export enum GameResultCause {
    DRAW = 'DRAW',
    WHITE_RESIGN = 'WHITE_RESIGN',
    BLACK_RESIGN = 'BLACK_RESIGN',
    WHITE_TIMEOUT = 'WHITE_TIMEOUT',
    BLACK_TIMEOUT = 'BLACK_TIMEOUT',
    WHITE_IN_CHECKMATE = 'WHITE_IN_CHECKMATE',
    BLACK_IN_CHECKMATE = 'BLACK_IN_CHECKMATE',
    WHITE_IN_STALEMATE = 'WHITE_IN_STALEMATE',
    BLACK_IN_STALEMATE = 'BLACK_IN_STALEMATE',
    THREEFOLD_REPETITION = 'THREEFOLD_REPETITION',
    FIFTY_MOVE = 'FIFTY_MOVE',
    INSUFFICIENT_MATERIAL = 'INSUFFICIENT_MATERIAL', // todo
    ONGOING = 'ONGOING',
}
export const GameScore = new Map<GameResultCause, string>([
    [GameResultCause.DRAW, '1/2-1/2'],
    [GameResultCause.WHITE_RESIGN, '0-1'],
    [GameResultCause.BLACK_RESIGN, '1-0'],
    [GameResultCause.WHITE_TIMEOUT, '0-1'],
    [GameResultCause.BLACK_TIMEOUT, '1-0'],
    [GameResultCause.WHITE_IN_CHECKMATE, '0-1'],
    [GameResultCause.BLACK_IN_CHECKMATE, '1-0'],
    [GameResultCause.WHITE_IN_STALEMATE, '1/2-1/2'],
    [GameResultCause.BLACK_IN_STALEMATE, '1/2-1/2'],
    [GameResultCause.THREEFOLD_REPETITION, '1/2-1/2'],
    [GameResultCause.FIFTY_MOVE, '1/2-1/2'],
    [GameResultCause.INSUFFICIENT_MATERIAL, '1/2-1/2'],  // TODO
    [GameResultCause.ONGOING, '-']
])

export interface Rules {
    ruleMoveOwnKing: boolean;
    ruleMoveOwnKingInCheck: boolean;
    ruleMoveOpp: boolean;
    ruleUndoTileMove: boolean;
    ruleMoveOppKing: boolean;
    ruleMoveOppCheck: boolean;
    ruleDoubleMovePawn: boolean;
    ruleCastleNormal: boolean;
    ruleCastleMoved: boolean;
    ruleEnPassantTile: boolean;
    ruleEnPassantTileHome: boolean;
    ruleIgnoreAll: boolean;
}


// order matches svg columns
export enum PieceType {
    KING,
    QUEEN,
    BISHOP,
    KNIGHT,
    ROOK,
    PAWN,
    TILE,
    EMPTY
}

// order matches svg rows
export enum PieceColor {
    WHITE,
    BLACK,
    NONE
}

export interface Piece {
    color: PieceColor;
    type: PieceType;
}


export const SCREENS = {
    LOBBY: 'lobby',
    GAME_ROOM: 'gameRoom'
};


export enum ADMIN_COMMANDS {
    GAME_DELETE,
    GAME_GET_IDS,
    GAME_KICK_PLAYER,
    GAME_DEMOTE_PLAYER,
    REFRESH_DB,
    FORCE_SAVE_ALL,
    GAME_UNLOCK_RULES,
}

// Message types as constants
export const MESSAGE_TYPES = {
    CHANGE_NAME: 'changeName',
    CREATE_GAME: 'createGame',
    JOIN_GAME: 'joinGame',
    CHANGE_POSITION: 'changePosition',
    QUIT_GAME: 'quitGame',
    MOVE_PIECE: 'movePiece',
    REWIND: 'rewind',
    DRAW: 'draw',
    SURRENDER: 'surrender',
    VALID_MOVES: 'validMoves',
    PAUSE: 'pause',
    TIME: 'time',
    CHAT: 'chat',
    GAME_STATE: 'gameState',
    GAME_LIST: 'gameList',
    RULES: 'rules',
    RULES_AGREEMENT: 'rulesAgreement',
    GAME_OVER: 'gameOver',
    ADMIN_MESSAGE: 'adminMessage',
    LOG_MESSAGE: 'logMessage',
    GAME_PASSWORD: 'gamePassword',
    REJECT_JOIN_GAME: 'rejectJoin',
    RECONNECT: 'reconnect',
    POPUP: 'popup',
    UNLOCK_RULES: 'unlockRules',
} as const;

// Message type definitions
export interface Message {
    type: typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];
}

export interface CreateGameMessage extends Message {
    type: typeof MESSAGE_TYPES.CREATE_GAME;
    useTimeControl: boolean;
    initialTime: number;
    increment: number;
    password: string;
}
export interface ChangeNameMessage extends Message {
    type: typeof MESSAGE_TYPES.CHANGE_NAME;
    name: string;
    clientId?: number;
}
export interface JoinGameMessage extends Message {
    type: typeof MESSAGE_TYPES.JOIN_GAME;
    gameId: number;
    password: string;
}
export interface ChangePositionMessage extends Message {
    type: typeof MESSAGE_TYPES.CHANGE_POSITION;
    position: PieceColor;
}
export interface MovePieceMessage extends Message {
    type: typeof MESSAGE_TYPES.MOVE_PIECE;
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number; 
    notation?: string; // only calculated at the server and sent back
    isTile: boolean;
    promotions: {row: number, col: number, piece: Piece}[];
}
export interface TimeMessage extends Message {
    type: typeof MESSAGE_TYPES.TIME;
    useTimeControl: boolean;
    initialTimeWhite: number;
    initialTimeBlack: number;
    timeLeftWhite: number;
    timeLeftBlack: number;
    incrementWhite: number;
    incrementBlack: number;
    clockRunning: boolean;
}
export interface ChatMessage extends Message {
    type: typeof MESSAGE_TYPES.CHAT;
    message: string;
}
export interface GameStateMessage extends Message {
    type: typeof MESSAGE_TYPES.GAME_STATE;
    gameState: GameState;
    yourColor: PieceColor;
}
export interface gameListMessage extends Message {
    type: typeof MESSAGE_TYPES.GAME_LIST;
    gameList?: GameInfo[];  // only sent back from the server
    nClients?: number;  // only sent back from the server
}
export interface RulesMessage extends Message {
    type: typeof MESSAGE_TYPES.RULES;
    rules: Rules;
}
export interface RulesAgreementMessage extends Message {
    type: typeof MESSAGE_TYPES.RULES_AGREEMENT;
    rulesAgreement: Rules;
    haveBoth: boolean;
    rulesLocked: boolean;
}
export interface AdminMessage extends Message {
    type: typeof MESSAGE_TYPES.ADMIN_MESSAGE;
    command: ADMIN_COMMANDS;
    data: any;
}
export interface LogMessage extends Message {
    type: typeof MESSAGE_TYPES.LOG_MESSAGE;
    log: any;
}
export interface GamePasswordMessage extends Message {
    type: typeof MESSAGE_TYPES.GAME_PASSWORD;
    password: string;
}
export interface RejectJoinGameMessage extends Message {
    type: typeof MESSAGE_TYPES.REJECT_JOIN_GAME;
    gameId: number;
}
export interface ReconnectMessage extends Message {
    type: typeof MESSAGE_TYPES.RECONNECT;
    clientId: number;
    clientName: string;
    gameState?: GameState;  // sent from the client to use when the server can't reload the game
}
export interface PopupMessage extends Message {
    type: typeof MESSAGE_TYPES.POPUP;
    text: string;
    button: string[] | string;  // server sends list of button names, client sends back the selected name. String must match exactly. Be sure to include a "Cancel" or "Ok" or whatever
}