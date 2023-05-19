export interface IMessage {
    type: string,
    data?: string
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
    port: number
    secured?: boolean
}