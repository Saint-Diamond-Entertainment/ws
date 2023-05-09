export interface IServerData {
    cert?: string
    debug?: boolean
    ip?: string
    key?: string
    listenCallback?: () => void
    logErrors?: boolean
    pingStep?: number
    port: number
    secured?: boolean
}