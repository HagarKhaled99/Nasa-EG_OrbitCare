// `npm run start`: the version to use for the judge demo. Builds the website for production (with the offline
// service worker), then serves it together with the crew database API in ONE process (Ctrl+C stops both).
import { build, preview } from 'vite'
import { startApiServer } from '../server/server.mjs'

console.log('Building ORBIT TWIN for production…')
await build({ logLevel: 'warn' })
startApiServer()
const server = await preview()
server.printUrls()
console.log('  Offline: after the first visit the app shell keeps working without a network.\n')
