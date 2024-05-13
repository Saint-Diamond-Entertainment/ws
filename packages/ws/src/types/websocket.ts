import http from 'http'
import https from 'https'
import ws from 'ws'

export type TServer = https.Server | http.Server | undefined

export interface IMessage {
    type: string
    data?: object
}
export interface IAuthenticate<T> {
    (request: http.IncomingMessage):
        | Promise<{ data: T; token: string; id: string; isAuth: true } | { isAuth: false }>
        | { data: T; token: string; id: string; isAuth: true }
        | { isAuth: false }
}

export interface IServerConfigArgs<T> {
    authenticate: IAuthenticate<T>
    cert?: string
    debug?: boolean
    ip?: string
    key?: string
    listeningListener?: () => void
    pingInterval?: number
    port?: number
    secured?: boolean
}

export interface IWebSocketClient<T> extends ws {
    broadcast: Function
    call: Function
    disconnect: Function
    id: string
    token: string
    isAlive: boolean
    join: Function
    leave: Function
}
