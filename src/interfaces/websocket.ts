import type { IAccount } from './account'
import http from 'http'

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
