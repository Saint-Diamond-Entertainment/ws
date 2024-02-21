export interface IMessage {
    type: string
    data?: object
}

export interface IServerData {
    authenticate: Function
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
