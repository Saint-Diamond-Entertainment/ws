import WS from '../'

const ws = new WS({
    port: 3010,
    authenticate() {
        return {
            data: {
                nickname: 'John'
            },
            id: '3213123',
            isAuth: true
        }
    }
})
