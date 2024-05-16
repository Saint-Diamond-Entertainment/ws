import WS from '../'
import ws from 'ws'
import type { IWebSocketClient } from '../types/websocket'

const clients = new Map<string, { data: { nickname: string }; connections: IWebSocketClient[] }>()

new WS({
    port: 3010,
    clients,
    listeningListener() {
        console.log('listen')
    },
    authenticate() {
        return {
            data: {
                nickname: 'John'
            },
            token: 'tokentest',
            id: 'testid',
            isAuth: true
        }
    }
})

const client = new ws('http://127.0.0.1:3010')
client.on('open', () => {
    console.log('connected')
})
client.on('close', () => {
    console.log('close')
})
