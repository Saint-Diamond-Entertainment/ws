import WebSocket, { WebSocketServer } from 'ws'
import { readFileSync } from 'fs'
import express from 'express'
import http from 'http'
import https from 'https'
import cors from 'cors'
import { createClient } from 'redis'
import type { IRoom } from './types/room'
import type {
    IServerConfigArgs,
    IAuthenticate,
    IMessage,
    IRedisRoomBroadcast,
    TServer,
    IWebSocketClient
} from './types/websocket'
import { serverArgsSchema } from './schemas/websocket'
import { DEFAULT_DEBUG, DEFAULT_INTERVAL, DEFAULT_IP, DEFAULT_PORT } from './constants/websocket'

export default class WS<T extends { [key in string]: string }> {
    private _httpServer: TServer
    private _config = {
        ip: DEFAULT_IP,
        port: DEFAULT_PORT,
        debug: DEFAULT_DEBUG,
        pingInterval: DEFAULT_INTERVAL,
        listeningListener() {
            if (this.debug) {
                console.log('✅ WebSocket server is listening on ' + this.ip + ':' + this.port)
            }
        }
    }
    private _pingTimer: NodeJS.Timer | undefined
    private _expressApp = express()

    wsServer: WebSocket.Server
    clients: Map<string, IWebSocketClient[]>
    rooms: Map<string, IRoom> = new Map()
    redis: ReturnType<typeof createClient> | undefined
    redisPublisher: ReturnType<typeof createClient> | undefined
    redisSubscriber: ReturnType<typeof createClient> | undefined

    private applyConfig(config: IServerConfigArgs<T>) {
        const { ip, debug, pingInterval, port, listeningListener } = config

        if (typeof ip === 'string') {
            this._config.ip = ip
        }

        if (typeof debug === 'boolean') {
            this._config.debug = debug
        }

        if (typeof pingInterval === 'number') {
            this._config.pingInterval = pingInterval
        }

        if (typeof port === 'number') {
            this._config.port = port
        }

        if (listeningListener) {
            this._config.listeningListener = listeningListener
        }
    }

    private createHTTPServer(config: { cert?: string; key?: string; secured?: boolean }) {
        const { cert, key, secured } = config

        if (secured) {
            if (!cert || !key) {
                throw new Error('No cert/key definition')
            }

            this._httpServer = https.createServer(
                {
                    cert: readFileSync(cert),
                    key: readFileSync(key)
                },
                this._expressApp
            )
        } else {
            this._httpServer = http.createServer(this._expressApp)
        }
    }

    private initUpgradeHandler(authenticate: IAuthenticate<T>) {
        this._httpServer?.on('upgrade', async (request, client, head) => {
            const authResponse = await authenticate(request)
            if (authResponse.isAuth) {
                const { id, token, data } = authResponse
                this.wsServer.handleUpgrade(request, client, head, (ws: WebSocket) => {
                    this.wsServer.emit('connection', ws, id, token, data)
                })
            } else {
                client.destroy()
            }
        })
    }

    private initHeartbeat() {
        this._pingTimer = setInterval(() => {
            this.clients.forEach((connections) => {
                connections.forEach((connection) => {
                    if (!connection.isAlive) {
                        return connection.disconnect()
                    }

                    connection.isAlive = false
                    connection.ping()
                })
            })
        }, this._config.pingInterval)
    }

    constructor(config: IServerConfigArgs<T>) {
        serverArgsSchema.parse(config)

        const { cert, key, secured, authenticate } = config

        this.applyConfig(config)
        this.createHTTPServer({ cert, key, secured })

        this.clients = config.clients

        this._expressApp.use(
            cors({
                origin: true,
                credentials: true
            })
        )

        this.wsServer = new WebSocketServer({ noServer: true })
        this.initEvents()

        const a = async () => {
            this.redis = createClient()
            this.redisPublisher = createClient()
            this.redisSubscriber = createClient()
            await this.redis.connect()
            await this.redisPublisher.connect()
            await this.redisSubscriber.connect()

            this.initRedisEvents()
            this.initUpgradeHandler(authenticate)
            this.initHeartbeat()

            this._httpServer?.listen(
                this._config.port,
                this._config.ip,
                this._config.listeningListener
            )
        }
    }

    private initRedisEvents() {
        this.redisSubscriber?.subscribe(
            `${process.env.NODE_ENV}:room:broadcast`,
            (roomData: string) => {
                const normalizedData: IRedisRoomBroadcast = JSON.parse(roomData)

                const { room, type, data } = normalizedData

                this.rooms.get(room)?.clients.forEach((client) => {
                    client.send(
                        JSON.stringify({
                            type,
                            data
                        })
                    )
                })
            }
        )
    }

    private initEvents() {
        this.wsServer.on('disconnect', async (client: IWebSocketClient) => {
            const setKey = `${process.env.NODE_ENV}:user:${client.id}`
            const user = await this.redis?.hGetAll(setKey)

            if (user?.connections !== undefined && !isNaN(+user.connections)) {
                const connectionsCount = +user.connections
                if (connectionsCount <= 1) {
                    this.redis?.del(setKey)
                } else {
                    this.redis?.hSet(setKey, {
                        ...user,
                        connections: connectionsCount - 1
                    })
                }
            }
        })
        this.wsServer.on(
            'connection',
            async (client: IWebSocketClient, id: string, token: string, data: T) => {
                client.isAlive = true
                client.id = id
                client.token = token

                const clientsWithSameId = this.clients.get(client.id)

                if (clientsWithSameId) {
                    this.clients.set(client.id, [...clientsWithSameId, client])
                } else {
                    this.clients.set(client.id, [client])
                }

                const setKey = `${process.env.NODE_ENV}:user:${id}`
                const connectionsCount = await this.redis?.hGet(setKey, 'connections')
                this.redis?.hSet(setKey, {
                    ...data,
                    connections: connectionsCount === undefined ? 1 : +connectionsCount + 1
                })

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
                        ;[...this.rooms.keys()].forEach((room) => {
                            client.leave(room)
                        })

                        const clientConnections = this.clients.get(client.id)

                        if (clientConnections) {
                            this.clients.set(
                                client.id,
                                clientConnections.filter((connection) => connection !== client)
                            )

                            if (!this.clients.get(client.id)?.length) {
                                this.clients.delete(client.id)
                            }
                        }
                        client.emit('disconnect')
                        client.terminate()
                    } catch (e) {
                        this._config.debug && console.error('Error while disconnecting: ', e)
                    }
                }

                client.broadcast = (
                    room: string,
                    type: string,
                    data: object,
                    loopback: boolean = false
                ) => {
                    this.rooms.get(room)?.clients.forEach((broadcastClient) => {
                        if (broadcastClient.id === client.id && !loopback) {
                            return
                        }

                        client.send(
                            JSON.stringify({
                                type,
                                data
                            })
                        )
                    })
                }

                client.call = (type: string, data: object) => {
                    try {
                        client.send(
                            JSON.stringify({
                                type,
                                data
                            })
                        )
                    } catch (e) {
                        this._config.debug && console.error('Error while parsing data: ', e)
                    }
                }
                client.on('message', (message) => {
                    try {
                        const stringifiedMessage = message.toString()
                        const normalizedMessage: IMessage = JSON.parse(stringifiedMessage)

                        if (!normalizedMessage.type) {
                            throw new Error('No message type')
                        }

                        const { type, data } = normalizedMessage

                        client.emit(type, data)
                    } catch (e) {
                        this._config.debug && console.error('Error while parsing message: ', e)
                    }
                })

                client.on('pong', () => {
                    client.isAlive = true
                })

                client.on('close', () => {
                    client.disconnect()
                })
            }
        )

        this.wsServer.on('close', () => {
            if (typeof this._pingTimer === 'number') {
                clearInterval(this._pingTimer)
            }
        })
    }

    broadcast(room: string, type: string, data: object) {
        this.redisPublisher?.publish(
            `${process.env.NODE_ENV}:room:broadcast`,
            JSON.stringify({ room, type, data })
        )
    }

    createRoom(name: string) {
        if (!this.rooms.get(name)) {
            this.rooms.set(name, { clients: new Set() })
        }
    }

    deleteRoom(name: string) {
        this.rooms.delete(name)
    }
}
