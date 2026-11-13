// `npm run dev`: starts the crew database API and the Vite website in ONE process (Ctrl+C stops both).
import { createServer } from 'vite'
import { startApiServer } from '../server/server.mjs'

startApiServer()
const vite = await createServer()
await vite.listen()
vite.printUrls()
vite.bindCLIShortcuts({ print: true })
