const Server = require('socket.io')
const LRU = require('lru-cache')
const AtHome = require('athome')

const { log, error, state } = require('./state')

const clusterWs = require('./ws')

const pending = new Map()

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
  socket.on('http', (url, ack) => {
    if (typeof ack === 'function') {
      const time = Date.now()
      if (cache.has(url)) {
        ack(cache.get(url))
        log('cached', { url })
      } else if (pending.has(url)) {
        pending.get(url).then(result => {
          if (result) {
            log('complete', { url, time: Date.now() - time })
            ack(result)
          }
        })
      } else {
        log('executing', { url })
        pending.set(url, httpHome.execute(url).catch(e => {
          error(e.message || e)
          console.error(e.message || e)
          return undefined
        }))
        pending.get(url).then(result => {
          if (result) {
            log('complete', { url, time: Date.now() - time })
            cache.set(url, result)
            ack(result)
          }
        })
      }
    }
  })
})

console.log('Cluster center online')
console.log('socket.io: 9012')
clusterWs(httpHome, log)
