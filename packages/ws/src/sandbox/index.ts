import WS from '../'
import ws from 'ws'
import type { IWebSocketClient } from '../types/websocket'

const clients = new Map<string, IWebSocketClient[]>()

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

setTimeout(() => {
    const client = new ws('http://127.0.0.1:3010')
    client.on('open', () => {
        console.log('connected')
        client.send(JSON.stringify({ type: 'lol' }))
    })
    client.on('close', () => {
        console.log('close')
    })
}, 2000)
