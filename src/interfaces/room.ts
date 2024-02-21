import WebSocket from 'ws'

export interface IRoom {
    clients: Set<WebSocket.WebSocket>
}
