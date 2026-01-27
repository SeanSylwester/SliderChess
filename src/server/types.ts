import WebSocket from 'ws';

export interface ClientInfo {
    id: number;
    name: string;
    ws: WebSocket;
    gameId?: number;
}