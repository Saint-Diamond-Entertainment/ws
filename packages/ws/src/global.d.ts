import ws from 'ws'
import type { IAccount } from './types/account'

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
