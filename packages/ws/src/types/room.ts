import type { IWebSocketClient } from './websocket'

export interface IRoom {
    clients: Set<IWebSocketClient>
}
