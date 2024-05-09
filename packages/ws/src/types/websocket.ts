import http from 'http'
import https from 'https'
import ws from 'ws'
import type { IAccount } from './account'

export type TServer = https.Server | http.Server | undefined

export interface IMessage {
    type: string
    data?: object
}

export interface IAuthenticateCallback {
    (args: { error?: string; account?: IAccount }): void
}

export interface IAuthenticate {
    (request: http.IncomingMessage, callback: IAuthenticateCallback): void
}

export interface IServerData {
    authenticate: IAuthenticate
    cert?: string
    debug?: boolean
    ip?: string
    key?: string
    listenCallback?: () => void
    logErrors?: boolean
    pingInterval?: number
    port?: number
    secured?: boolean
}

declare module 'ws' {
    export interface WebSocket extends ws {
        account: IAccount
        broadcast: Function
        call: Function
        disconnect: Function
        id: string
        isAlive: boolean
        join: Function
        leave: Function
    }
}
