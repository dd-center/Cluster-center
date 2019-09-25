const Server = require('socket.io')
const LRU = require('lru-cache')
const AtHome = require('athome')

const clusterWs = require('./ws')

const io = new Server(9012, { serveClient: false })
const httpHome = new AtHome({ validator: Boolean })
const cache = new LRU({ max: 10000, maxAge: 1000 * 60 * 2 })

io.on('connect', socket => {
  console.log('vtbs.moe connected')
  socket.on('http', async (url, ack) => {
    if (typeof ack === 'function') {
      let result = cache.get(url)
      if (result) {
        console.log('cache hit')
      } else {
        console.log('task executing')
        const time = Date.now()
        result = await httpHome.execute(url)
        console.log(`task complete ${((Date.now() - time) / 1000).toFixed(2)}s`)
        cache.set(url, result)
      }
      ack(result)
    }
  })
})

console.log('Cluster center online')
console.log('socket.io: 9012')
clusterWs(httpHome)
