import { z } from 'zod'

export enum EWebsocketClientEvents {
    chatDelete = 'chat/delete',
    chatRemoveAdmin = 'chat/remove-admin',
    chatRename = 'chat/rename',
    chatSetAccess = 'chat/set-access',
    chatSetAdmin = 'chat/set-admin',
    chatSetImage = 'chat/set-image',
    memberJoin = 'member/join',
    memberKick = 'member/kick',
    memberSetOffline = 'member/set-offline',
    memberSetOnline = 'member/set-online',
    memberType = 'member/type',
    messageDelete = 'message/delete',
    messageRead = 'message/read',
    messageReceive = 'message/receive'
}
export const eWebsocketClientEvents = z.nativeEnum(EWebsocketClientEvents)

export enum EWebsocketServerEvents {
    chatDelete = 'chat/delete',
    chatRemoveAdmin = 'chat/remove-admin',
    chatRename = 'chat/rename',
    chatSetAccess = 'chat/set-access',
    chatSetAdmin = 'chat/set-admin',
    chatSetImage = 'chat/set-image',
    chatType = 'chat/type',
    connection = 'connection',
    disconnect = 'disconnect',
    memberJoin = 'member/join',
    memberKick = 'member/kick',
    messageDelete = 'message/delete',
    messageRead = 'message/read',
    messageSend = 'message/send'
}
export const eWebsocketServerEvents = z.nativeEnum(EWebsocketServerEvents)
