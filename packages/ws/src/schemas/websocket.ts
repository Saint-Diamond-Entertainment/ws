import { z } from 'zod'

export const serverArgsSchema = z.object({
    authenticate: z.function(),
    ip: z.string().optional(),
    key: z.string().optional(),
    listeningListener: z.function().optional(),
    debug: z.boolean().optional(),
    pingInterval: z.number().optional(),
    port: z.number().optional(),
    secured: z.boolean().optional()
})
