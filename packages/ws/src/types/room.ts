import type { IWebSocketClient } from './websocket'

export interface IRoom<T> {
    clients: Set<IWebSocketClient<T>>
}
