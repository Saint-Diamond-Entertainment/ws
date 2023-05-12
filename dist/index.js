"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const fs_1 = require("fs");
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const websocket_1 = require("./constants/websocket");
class WS {
    constructor(data) {
        this._ip = websocket_1.DEFAULT_IP;
        this._port = websocket_1.DEFAULT_PORT;
        this._debug = websocket_1.DEFAULT_DEBUG;
        this.clients = new Map();
        this.rooms = new Map();
        this.pingInterval = websocket_1.DEFAULT_INTERVAL;
        this.logErrors = websocket_1.DEFAULT_ERRORS_LOGGING;
        this.listenCallback = () => {
            this._debug && console.log('✅ WebSocket server is listening on ' + this._ip + ':' + this._port);
        };
        this.broadcast = (room, type, data) => {
            var _a;
            (_a = this.rooms.get(room)) === null || _a === void 0 ? void 0 : _a.clients.forEach(client => {
                var _a;
                (_a = this.clients.get(client.id)) === null || _a === void 0 ? void 0 : _a.forEach(connection => {
                    connection.send(JSON.stringify(Object.assign({ type }, data)));
                });
            });
        };
        const { authenticate, cert, key, port, secured, listenCallback } = data;
        if (data.ip) {
            this._ip = data.ip;
        }
        if (typeof data.debug === 'boolean') {
            this._debug = data.debug;
        }
        if (typeof data.pingInterval === 'number') {
            this.pingInterval = data.pingInterval;
        }
        if (typeof data.logErrors === 'boolean') {
            this.logErrors = data.logErrors;
        }
        if (listenCallback) {
            this.listenCallback = listenCallback;
        }
        if (secured) {
            if (!cert || !key) {
                throw new Error('No cert/key definition');
            }
            this._server = https_1.default.createServer({
                cert: (0, fs_1.readFileSync)(cert),
                key: (0, fs_1.readFileSync)(key)
            });
        }
        else {
            this._server = http_1.default.createServer();
        }
        this.wss = new ws_1.WebSocketServer({ noServer: true });
        this.initialize();
        this._server.on('upgrade', (request, client, head) => {
            authenticate(request, (err, id, data) => {
                if (err) {
                    client.destroy();
                    return;
                }
                this.wss.handleUpgrade(request, client, head, (ws) => {
                    this.wss.emit('connection', ws, request, id, data);
                });
            });
        });
        this.pingTimer = setInterval(() => {
            this.clients
                .forEach(connections => {
                connections.forEach(client => {
                    if (!client.isAlive) {
                        return client.disconnect();
                    }
                    client.isAlive = false;
                    client.ping();
                });
            });
        }, this.pingInterval);
        this._server.listen(port, this._ip, this.listenCallback);
    }
    initialize() {
        this.wss.on('connection', (client, request, id, data) => __awaiter(this, void 0, void 0, function* () {
            client.isAlive = true;
            client.id = id;
            if (data) {
                client.account = data;
            }
            client.join = (room) => {
                var _a;
                if (!this.rooms.get(room)) {
                    this.createRoom(room);
                }
                (_a = this.rooms.get(room)) === null || _a === void 0 ? void 0 : _a.clients.add(client);
            };
            client.leave = (room) => {
                var _a, _b;
                (_a = this.rooms.get(room)) === null || _a === void 0 ? void 0 : _a.clients.delete(client);
                if (!((_b = this.rooms.get(room)) === null || _b === void 0 ? void 0 : _b.clients.size)) {
                    this.deleteRoom(room);
                }
            };
            client.disconnect = () => {
                try {
                    client.terminate();
                    process.nextTick(() => {
                        var _a;
                        this.rooms
                            .forEach(room => {
                            client.leave(room);
                        });
                        const clientConnections = this.clients.get(client.id);
                        if (clientConnections) {
                            this.clients.set(client.id, clientConnections.filter(connection => connection !== client));
                            if (!((_a = this.clients.get(client.id)) === null || _a === void 0 ? void 0 : _a.length)) {
                                this.clients.delete(client.id);
                            }
                        }
                    });
                }
                catch (e) {
                    this.logErrors && console.error('Error while disconnecting: ', e);
                }
            };
            client.broadcast = (room, type, data, loopback = false) => {
                var _a;
                (_a = this.rooms.get(room)) === null || _a === void 0 ? void 0 : _a.clients.forEach(broadcastClientId => {
                    var _a;
                    if (!loopback && broadcastClientId === client.id) {
                        return;
                    }
                    (_a = this.clients.get(broadcastClientId)) === null || _a === void 0 ? void 0 : _a.forEach(client => {
                        client.send(JSON.stringify(Object.assign({ type }, data)));
                    });
                });
            };
            client.call = (type, data) => {
                try {
                    client.send(JSON.stringify(Object.assign({ type }, data)));
                }
                catch (e) {
                    this.logErrors && console.error('Error while parsing data: ', e);
                }
            };
            client.on('message', message => {
                try {
                    const normalizedMessage = JSON.parse(message.toString());
                    if (!normalizedMessage.type) {
                        throw new Error('No message type');
                    }
                    const type = normalizedMessage.type;
                    const data = normalizedMessage.data || {};
                    client.emit(type, data);
                }
                catch (e) {
                    this.logErrors && console.error('Error while parsing message: ', e);
                }
            });
            client.on('pong', () => {
                client.isAlive = true;
            });
            client.on('close', () => {
                client.disconnect();
            });
            this.wss.clients.clear();
            const clientsWithSameId = this.clients.get(client.id) || [];
            this.clients.set(client.id, [...clientsWithSameId, client]);
        }));
        this.wss.on('close', () => {
            clearInterval(this.pingTimer);
        });
    }
    createRoom(name) {
        this.rooms.set(name, { clients: new Set() });
    }
    deleteRoom(name) {
        this.rooms.delete(name);
    }
}
exports.default = WS;
