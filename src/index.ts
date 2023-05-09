import WebSocket, { WebSocketServer } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { readFileSync } from 'fs'
import http from 'http'
import https from 'https'
import { IRoom } from './interfaces/room'
import { IServerData } from './interfaces/websocket'
import { Server } from './types/websocket'
import { DEFAULT_ERRORS_LOGGING, DEFAULT_INTERVAL, DEFAULT_IP } from './constants/websocket'

export default class WS {
    private _server: Server

    wss: WebSocket.Server<WebSocket.WebSocket>

    clients: Map<string, WebSocket.WebSocket> = new Map()
    rooms: Map<string, IRoom> = new Map()

    pingInterval: NodeJS.Timer
    pingStep: number = DEFAULT_INTERVAL
    logErrors: boolean = DEFAULT_ERRORS_LOGGING
    
    constructor (data: IServerData) {
        const { cert, debug, key, port, secured } = data
        const ip: string = data.ip || DEFAULT_IP

        if (typeof data.pingStep === 'number') {
            this.pingStep = data.pingStep
        }

        if (typeof data.logErrors === 'boolean') {
            this.logErrors = data.logErrors
        }

        if (secured) {
            if (!cert || !key) {
                throw new Error('No cert/key definition')
            }

            this._server = https.createServer({ 
                cert: readFileSync(cert),
                key: readFileSync(key)
            })
        }
        else {
            this._server = http.createServer()
        }

        this.wss = new WebSocketServer({ server: this._server })

        this.initialize()
        
        this.pingInterval = setInterval(() => {
            console.log('clients ', this.clients.size)
            this.clients
                .forEach(client => {
                    if (!client.isAlive) {
                        return client.disconnect()
                    }
                    
                    client.isAlive = false
                    client.ping()
                })
        }, this.pingStep)

        this._server.listen(port, ip, () => {
            debug && console.log('✅ WebSocket server is listening on ' + ip + ':' + port)
        })
    }
    
    initialize () {
        this.wss.on('connection', async client => {
            client.isAlive = true
            client.id = uuidv4()
    
            client.disconnect = () => {
                try {
                    client.terminate()
                    process.nextTick(() => {
                        this.rooms
                            .forEach(room => {
                                room.clients.delete(client.id)
                            })
                            this.clients.delete(client.id)
                    })
                }
                catch (e) {
                    this.logErrors && console.error('Error while disconnecting: ', e)
                }
            }
    
            client.join = (room: string) => {
                this.rooms.get(room)?.clients.add(client.id)
            }
            
            client.leave = (room: string) => {
                this.rooms.get(room)?.clients.delete(client.id)
            }
    
            client.broadcast = (room: string, data: JSON, loopback: boolean = false) => {
                this.rooms.get(room)
                    ?.clients
                    .forEach(broadcastClientId => {
                        if (!loopback && broadcastClientId === client.id) {
                            return
                        }
                        
                        this.clients.get(broadcastClientId)?.send(JSON.stringify(data))
                    })
            }
    
            client.call = (data: JSON) => {
                try {
                    client.send(JSON.stringify(data))
                }
                catch (e) {
                    this.logErrors && console.error('Error while parsing data: ', e)
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
                    this.logErrors && console.error('Error while parsing message: ', e)
                }
            })
    
            client.on('pong', () => {
                client.isAlive = true
            })
    
            client.on('close', () => {
                client.disconnect()
            })
            
            this.wss.clients.clear()
            this.clients.set(client.id, client)
        })
    
        this.wss.on('close', () => {
            clearInterval(this.pingInterval)
        })
    }
    
    createRoom (name: string) {
        this.rooms.set(name, { clients: new Set() })
    }
    
    deleteRoom (name: string) {
        this.rooms.delete(name)
    }
}