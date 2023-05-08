"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRoom = exports.createRoom = exports.rooms = void 0;
exports.rooms = new Map();
function createRoom(name) {
    exports.rooms.set(name, { clients: new Set() });
}
exports.createRoom = createRoom;
function deleteRoom(name) {
    exports.rooms.delete(name);
}
exports.deleteRoom = deleteRoom;
