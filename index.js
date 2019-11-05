const Server = require('socket.io')
const LRU = require('lru-cache')
const AtHome = require('athome')

const { log, error, state } = require('./state')

const clusterWs = require('./ws')

const io = new Server(9012, { serveClient: false })
const httpHome = new AtHome({
  retries: 16,
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
const cache = new LRU({ max: 10000, maxAge: 1000 * 60 })

state({
  pulls() {
    return httpHome.pulls.length
  },
  pending() {
    return httpHome.pending.length
  },
  homes() {
    return [...httpHome.homes.values()].map(({ runtime, version, platform, docker, name, resolves, rejects, lastSeen, id }) => ({ runtime, version, platform, docker, name, resolves, rejects, lastSeen, id }))
  },
  online() {
    return httpHome.homes.size
  }
})

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
