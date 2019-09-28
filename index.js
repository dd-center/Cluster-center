const Server = require('socket.io')
const LRU = require('lru-cache')
const AtHome = require('athome')

const { log, error } = require('./state')

const clusterWs = require('./ws')

const io = new Server(9012, { serveClient: false })
const httpHome = new AtHome({
  validator: result => {
    if (!result) {
      return false
    }
    if (result.code) {
      error(result)
    }
    if (result.data === undefined) {
      error('unknow result', result)
      return false
    }
    return !result.code
  }
})
const cache = new LRU({ max: 10000, maxAge: 1000 * 60 * 4 })

io.on('connect', socket => {
  log('vtbs.moe connected')
  socket.on('http', async (url, ack) => {
    if (typeof ack === 'function') {
      let result = cache.get(url)
      if (result) {
        log('cached', { url })
      } else {
        log('executing', { url })
        const time = Date.now()
        result = await httpHome.execute(url).catch(e => {
          error(e.message || e)
          console.error(e.message || e)
          return undefined
        })
        if (result) {
          log('complete', { url, time: Date.now() - time })
          cache.set(url, result)
        }
      }
      ack(result)
    }
  })
})

console.log('Cluster center online')
console.log('socket.io: 9012')
clusterWs(httpHome, log)
