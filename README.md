# WS

Install dependency via pnpm/npm

```
pnpm add @saint-diamond-entertainment/ws
```

or

```
npm i @saint-diamond-entertainment/ws
```

Server example

```ts
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
            token: 'tokentest',
            id: 'testid',
            isAuth: true
        }
    }
})
```

Available parameters

```ts
export interface IServerConfigArgs<T> {
    authenticate: IAuthenticate<T>
    cert?: string
    debug?: boolean
    ip?: string
    key?: string
    listeningListener?: () => void
    pingInterval?: number
    port?: number
    secured?: boolean
}
```

This package provides an authentication process. Describe in authenticate function the authentication process, and if the user successfully passes authentication, return object like that:

```ts
{
  isAuth: true, // Means that auth process is successfully passed
  id: 'johnthecooliest', // Account's id (or any other type of id, depends on your architecture)
  token: 'token', // Token to determine connection
  data: {
      nickname: 'John'
  } // Custom data object (using generic)
}
```

What's under the hood?

When a user connects, his connection is placed in the Map object to other connections corresponding to his ID. They share a data object (when data of one connection changes, the data is updated for other users with the same ID as well)

```ts
clients: Map<string, { data: T; connections: IWebSocketClient[] }> = new Map()
```

Client interface

```ts
export interface IWebSocketClient extends ws {
    broadcast: Function
    call: Function
    disconnect: Function
    id: string
    token: string
    isAlive: boolean
    join: Function
    leave: Function
}
```

# Rooms

To unite users into rooms you can use `client.join('room_name')` function

To create or delete room use

```ts
createRoom(name: string)
```

and

```ts
deleteRoom(name: string)
```

For broadcasting to any room use

```ts
broadcast(room: string, type: string, data: object)
```
