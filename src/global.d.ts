import ws from 'ws'

declare module 'ws' {
    export interface WebSocket extends ws {
        account: {
            id: string
            nickname: string
        }
        broadcast: Function
        call: Function
        disconnect: Function
        id: string
        isAlive: boolean
        join: Function
        leave: Function
    }
}
