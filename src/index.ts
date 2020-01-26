import SocketIO from 'socket.io'
import LRU from 'lru-cache'
import AtHome from 'athome'
import CState from '../state-center/api'
import clusterWs from './ws'
import { map } from './metadata'

const cState = new CState({ name: 'cluster' })

const io = SocketIO(9012, { serveClient: false })
const httpHome = new AtHome({
  retries: 16,
  validator: result => {
    if (!result) {
      return false
    }
    if (result.code) {
      cState.log('error with code', { result })
    }
    if (result.data === undefined) {
      cState.log('error unknow result', { result })
      return false
    }
    return !result.code
  },
})
const cache = new LRU({ max: 10000, maxAge: 1000 * 60 })

cState.stateRoute({
  pulls() {
    return httpHome.pulls.length
  },
  pending() {
    return httpHome.pending.length
  },
  homes() {
    return [...httpHome.homes.values()]
      .map(home => {
        const { resolves, rejects, lastSeen, id } = home
        const metadata = map.get(home)
        return { resolves, rejects, lastSeen, id, ...metadata }
      })
  },
  online() {
    return httpHome.homes.size
  },
})

const pending = new Map()

io.on('connect', socket => {
  cState.log('vtbs.moe connected')
  socket.on('http', async (url, ack) => {
    if (typeof ack === 'function') {
      let result = cache.get(url)
      if (result) {
        cState.log('cached', { url })
      } else if (pending.has(url)) {
        result = await pending.get(url)
      } else {
        cState.log('executing', { url })
        const time = Date.now()
        const job = httpHome.execute(url).catch(e => {
          cState.log('error', { msg: e.message || e })
          console.error(e.message || e)
          return undefined
        })
        pending.set(url, job)
        result = await job
        pending.delete(url)
        if (result) {
          cState.log('complete', { url, time: Date.now() - time })
          cache.set(url, result)
        }
      }
      ack(result)
    }
  })
})

console.log('Cluster center online')
console.log('socket.io: 9012')
clusterWs(httpHome, cState.log)
