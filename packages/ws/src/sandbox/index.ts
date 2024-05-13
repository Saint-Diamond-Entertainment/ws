import WS from '../'
import ws from 'ws'

new WS({
    port: 3010,
    listeningListener() {
        console.log('listen')
    },
    authenticate() {
        return {
            data: {
                nickname: 'John'
            },
            id: 'testid',
            isAuth: true
        }
    }
})

const client = new ws('http://127.0.0.1:3010')
client.on('open', () => {
    console.log('connected')
})
