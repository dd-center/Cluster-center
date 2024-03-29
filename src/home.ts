import { Server } from 'socket.io'
import LRU from 'lru-cache'
import AtHome from 'athome'
import CState from '../state-center/api'
import { map, getDDCount } from './metadata'

export const cState = new CState({ name: 'cluster' })

const io = new Server(9012, {
  serveClient: false,
  allowEIO3: true,
})

const danmakuHistory: [string, string][] = []

cState.subscribe('cluster').on('danmaku', (name, text) => {
  danmakuHistory.push([name, text])
  if (danmakuHistory.length > 50) {
    danmakuHistory.shift()
  }
})

export const httpHome = new AtHome<string, { code: number, data: any }>({
  retries: 24,
  validator: result => {
    if (!result) {
      return false
    }
    if (result.code) {
      cState.log('error with code', { result })
    }
    return !result.code
  }
})

const cache = new LRU({ max: 10000, maxAge: 1000 * 60 })

export const router = {
  pulls() {
    return httpHome.pulls.length
  },
  pending() {
    return httpHome.pending.length
  },
  homes() {
    return [...httpHome.homes.values()]
      .map(home => {
        const { resolves, rejects, lastSeen } = home
        const { id }: any = home
        const metadata = map.get(home)
        return { resolves, rejects, lastSeen, id, ...metadata }
      })
  },
  online() {
    return httpHome.homes.size
  },
  danmakuHistory() {
    return danmakuHistory
  },
  power() {
    return getDDCount()
  }
}

cState.stateRoute(router)

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
