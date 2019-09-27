const Server = require('socket.io')
const LRU = require('lru-cache')
const AtHome = require('athome')

const { log } = require('./state')

const clusterWs = require('./ws')

const io = new Server(9012, { serveClient: false })
const httpHome = new AtHome({ validator: Boolean })
const cache = new LRU({ max: 10000, maxAge: 1000 * 60 * 2 })

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
        result = await httpHome.execute(url)
        log('complete', { url, time: Date.now() - time })
        cache.set(url, result)
      }
      ack(result)
    }
  })
})

console.log('Cluster center online')
console.log('socket.io: 9012')
clusterWs(httpHome, log)
