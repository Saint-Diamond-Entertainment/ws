import WebSocket, { WebSocketServer } from 'ws'
import { readFileSync } from 'fs'
import http from 'http'
import https from 'https'
import { IRoom } from './interfaces/room'
import { IServerData, IMessage } from './interfaces/websocket'
import { Server } from './types/websocket'
import { DEFAULT_DEBUG, DEFAULT_ERRORS_LOGGING, DEFAULT_INTERVAL, DEFAULT_IP, DEFAULT_PORT } from './constants/websocket'

export default class WS {
    private _server: Server

    wss: WebSocket.Server<WebSocket.WebSocket>
    
    private _ip: string = DEFAULT_IP
    private _port: number = DEFAULT_PORT
    private _debug: boolean = DEFAULT_DEBUG

    clients: Map<string, WebSocket.WebSocket[]> = new Map()
    rooms: Map<string, IRoom> = new Map()

    pingTimer: NodeJS.Timer
    pingInterval: number = DEFAULT_INTERVAL
    logErrors: boolean = DEFAULT_ERRORS_LOGGING
    listenCallback: () => void = () => {
        this._debug && console.log('✅ WebSocket server is listening on ' + this._ip + ':' + this._port)
    }
    
    constructor (data: IServerData) {
        const { authenticate, cert, key, port, secured, listenCallback } = data
        
        if (data.ip) {
            this._ip = data.ip
        }
        
        if (typeof data.debug === 'boolean') {
            this._debug = data.debug
        }

        if (typeof data.pingInterval === 'number') {
            this.pingInterval = data.pingInterval
        }

        if (typeof data.logErrors === 'boolean') {
            this.logErrors = data.logErrors
        }
        
        if (listenCallback) {
            this.listenCallback = listenCallback
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

        this.wss = new WebSocketServer({ noServer: true })
        
        this.initialize()
                
        this._server.on('upgrade', (request, client, head) => {
            authenticate (request, (err: string, id?: string, data?: object) => {
                if (err) {
                    client.destroy()
                    return
                }
            
                this.wss.handleUpgrade(request, client, head, (ws: WebSocket) => {
                    this.wss.emit('connection', ws, request, id, data)
                })
            })
        })
                        
        this.pingTimer = setInterval(() => {
            this.clients
                .forEach(connections => {
                    connections.forEach(client => {
                        if (!client.isAlive) {
                            return client.disconnect()
                        }
                        
                        client.isAlive = false
                        client.ping()
                    })
                })
        }, this.pingInterval)

        this._server.listen(port, this._ip, this.listenCallback)
    }
    
    initialize () {
        this.wss.on('connection', async (client: WebSocket.WebSocket, request: any, id: string, data?: object) => {
            client.isAlive = true
            client.id = id
            
            if (data) {
                client.account = data
            }
            
            client.join = (room: string) => {
                if (!this.rooms.get(room)) {
                    this.createRoom(room)
                }
                
                this.rooms.get(room)?.clients.add(client)
            }
            
            client.leave = (room: string) => {
                this.rooms.get(room)?.clients.delete(client)
                
                if (!this.rooms.get(room)?.clients.size) {
                    this.deleteRoom(room)
                }
            }
            
            client.disconnect = () => {
                try {
                    client.terminate()
                    
                    process.nextTick(() => {
                        [...this.rooms
                            .keys()]
                            .forEach(room => {
                                client.leave(room)
                            })
                            
                            const clientConnections = this.clients.get(client.id)
                            
                            if (clientConnections) {
                                this.clients.set(client.id, clientConnections.filter(connection => connection !== client))

                                if (!this.clients.get(client.id)?.length) {
                                    this.clients.delete(client.id)
                                }
                            }
                        client.emit('disconnect')
                    })
                }
                catch (e) {
                    this.logErrors && console.error('Error while disconnecting: ', e)
                }
            }
    
            client.broadcast = (room: string, type: string, data: object, loopback: boolean = false) => {
                this.rooms.get(room)
                    ?.clients
                    .forEach(broadcastClientId => {
                        if (!loopback && broadcastClientId === client.id) {
                            return
                        }
                        
                        this.clients.get(broadcastClientId)
                            ?.forEach(client => {
                                client.send(JSON.stringify({
                                    type,
                                    data
                                }))
                            })
                    })
            }
    
            client.call = (type: string, data: object) => {
                try {
                    client.send(JSON.stringify({
                        type,
                        data
                    }))
                }
                catch (e) {
                    this.logErrors && console.error('Error while parsing data: ', e)
                }
            }
            
            client.on('message', message => {
                try {
                    const normalizedMessage: IMessage = JSON.parse(message.toString())
                    
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
            
            const clientsWithSameId = this.clients.get(client.id) || []
            this.clients.set(client.id, [...clientsWithSameId, client])
        })
    
        this.wss.on('close', () => {
            clearInterval(this.pingTimer)
        })
    }
    
    broadcast = (room: string, type: string, data: object) => {
        this.rooms.get(room)
            ?.clients
            .forEach(client => {
                this.clients.get(client.id)
                    ?.forEach(connection => {
                        connection.send(JSON.stringify({
                            type,
                            data
                        }))
                    })
            })
    }
    
    createRoom (name: string) {
        if (!this.rooms.get(name)) {
            this.rooms.set(name, { clients: new Set() })
        }
    }
    
    deleteRoom (name: string) {
        this.rooms.delete(name)
    }
}