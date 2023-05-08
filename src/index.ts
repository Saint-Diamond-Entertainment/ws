import WebSocket, { WebSocketServer } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { readFileSync } from 'fs'
import http from 'http'
import https from 'https'
import { rooms } from './room'
import { IServerData } from './interfaces/websocket'
import { Server } from './types/websocket'
import { DEFAULT_ERRORS_LOGGING, DEFAULT_INTERVAL, DEFAULT_IP } from './constants/websocket'

let server: Server

export let wss: WebSocket.Server<WebSocket.WebSocket>

export const clients: Map<string, WebSocket.WebSocket> = new Map()

let pingTimer: NodeJS.Timer
let pingStep: number = DEFAULT_INTERVAL
let logErrors: boolean = DEFAULT_ERRORS_LOGGING

export function create (data: IServerData) {
    const { cert, debug, key, port, secured } = data
    const ip: string = data.ip || DEFAULT_IP

    if (typeof data.pingStep === 'number') {
        pingStep = data.pingStep
    }

    if (typeof data.logErrors === 'boolean') {
        logErrors = data.logErrors
    }

    if (secured) {
        if (!cert || !key) {
            throw new Error('No cert/key definition')
        }

        server = https.createServer({ 
            cert: readFileSync(cert),
            key: readFileSync(key)
        })
    }
    else {
        server = http.createServer()
    }

    wss = new WebSocketServer({ server })

    initialize()

    server.listen(port, ip, () => {
        debug && console.log('✅ WebSocket server is listening on ' + ip + ':' + port)
    })
}

pingTimer = setInterval(() => {
    clients
        .forEach(client => {
            if (!client.isAlive) {
                return client.disconnect()
            }
            
            client.isAlive = false
            client.ping()
        })
}, pingStep)

export function initialize () {
    wss.on('connection', async client => {
        client.isAlive = true
        client.id = uuidv4()

        client.disconnect = () => {
            try {
                client.terminate()
                process.nextTick(() => {
                    rooms
                        .forEach(room => {
                            room.clients.delete(client.id)
                        })
                    clients.delete(client.id)
                })
            }
            catch (e) {
                logErrors && console.error('Error while disconnecting: ', e)
            }
        }

        client.join = (room: string) => {
            rooms.get(room)?.clients.add(client.id)
        }
        
        client.leave = (room: string) => {
            rooms.get(room)?.clients.delete(client.id)
        }

        client.broadcast = (room: string, data: JSON, loopback: boolean = false) => {
            rooms.get(room)
                ?.clients
                .forEach(broadcastClientId => {
                    if (!loopback && broadcastClientId === client.id) {
                        return
                    }
                    
                    clients.get(broadcastClientId)?.send(JSON.stringify(data))
                })
        }

        client.call = (data: JSON) => {
            try {
                client.send(JSON.stringify(data))
            }
            catch (e) {
                logErrors && console.error('Error while parsing data: ', e)
            }
        }
        
        client.on('message', message => {
            try {
                const normalizedMessage = JSON.parse(message.toString())
                
                if (!normalizedMessage.type) {
                    throw new Error('No message type')
                }
                
                const type: string = normalizedMessage.type
                const data: object = normalizedMessage.data || {}
                
                client.emit(type, data)
            }
            catch (e) {
                logErrors && console.error('Error while parsing message: ', e)
            }
        })

        client.on('pong', () => {
            client.isAlive = true
        })

        client.on('close', () => {
            client.disconnect()
        })
        
        wss.clients.clear()
        clients.set(client.id, client)
    })

    wss.on('close', () => {
        clearInterval(pingTimer)
    })
}