import http from 'http'
import https from 'https'

export type Server = https.Server | http.Server | undefined
