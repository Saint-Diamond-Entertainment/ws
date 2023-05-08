import { IRoom } from './interfaces/room'

export const rooms: Map<string, IRoom> = new Map()

export function createRoom (name: string) {
    rooms.set(name, { clients: new Set() })
}

export function deleteRoom (name: string) {
    rooms.delete(name)
}