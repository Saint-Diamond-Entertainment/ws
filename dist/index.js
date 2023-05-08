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
exports.initialize = exports.create = exports.clients = exports.wss = void 0;
const ws_1 = require("ws");
const uuid_1 = require("uuid");
const fs_1 = require("fs");
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const room_1 = require("./room");
const websocket_1 = require("./constants/websocket");
let server;
exports.clients = new Map();
let pingTimer;
let pingStep = websocket_1.DEFAULT_INTERVAL;
let logErrors = websocket_1.DEFAULT_ERRORS_LOGGING;
function create(data) {
    const { cert, debug, key, port, secured } = data;
    const ip = data.ip || websocket_1.DEFAULT_IP;
    if (typeof data.pingStep === 'number') {
        pingStep = data.pingStep;
    }
    if (typeof data.logErrors === 'boolean') {
        logErrors = data.logErrors;
    }
    if (secured) {
        if (!cert || !key) {
            throw new Error('No cert/key definition');
        }
        server = https_1.default.createServer({
            cert: (0, fs_1.readFileSync)(cert),
            key: (0, fs_1.readFileSync)(key)
        });
    }
    else {
        server = http_1.default.createServer();
    }
    exports.wss = new ws_1.WebSocketServer({ server });
    initialize();
    server.listen(port, ip, () => {
        debug && console.log('✅ WebSocket server is listening on ' + ip + ':' + port);
    });
}
exports.create = create;
pingTimer = setInterval(() => {
    exports.clients
        .forEach(client => {
        if (!client.isAlive) {
            return client.disconnect();
        }
        client.isAlive = false;
        client.ping();
    });
}, pingStep);
function initialize() {
    exports.wss.on('connection', (client) => __awaiter(this, void 0, void 0, function* () {
        client.isAlive = true;
        client.id = (0, uuid_1.v4)();
        client.disconnect = () => {
            try {
                client.terminate();
                process.nextTick(() => {
                    room_1.rooms
                        .forEach(room => {
                        room.clients.delete(client.id);
                    });
                    exports.clients.delete(client.id);
                });
            }
            catch (e) {
                logErrors && console.error('Error while disconnecting: ', e);
            }
        };
        client.join = (room) => {
            var _a;
            (_a = room_1.rooms.get(room)) === null || _a === void 0 ? void 0 : _a.clients.add(client.id);
        };
        client.leave = (room) => {
            var _a;
            (_a = room_1.rooms.get(room)) === null || _a === void 0 ? void 0 : _a.clients.delete(client.id);
        };
        client.broadcast = (room, data, loopback = false) => {
            var _a;
            (_a = room_1.rooms.get(room)) === null || _a === void 0 ? void 0 : _a.clients.forEach(broadcastClientId => {
                var _a;
                if (!loopback && broadcastClientId === client.id) {
                    return;
                }
                (_a = exports.clients.get(broadcastClientId)) === null || _a === void 0 ? void 0 : _a.send(JSON.stringify(data));
            });
        };
        client.call = (data) => {
            try {
                client.send(JSON.stringify(data));
            }
            catch (e) {
                logErrors && console.error('Error while parsing data: ', e);
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
                logErrors && console.error('Error while parsing message: ', e);
            }
        });
        client.on('pong', () => {
            client.isAlive = true;
        });
        client.on('close', () => {
            client.disconnect();
        });
        exports.wss.clients.clear();
        exports.clients.set(client.id, client);
    }));
    exports.wss.on('close', () => {
        clearInterval(pingTimer);
    });
}
exports.initialize = initialize;
