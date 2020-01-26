import { Server } from 'ws'
import AtHome from 'athome'
import CState from '../state-center/api'
import { map, metadatas } from './metadata'
import { httpHome, cState } from './home'

const keyGen = () => String(Math.random())
const parse = (string: string) => {
  try {
    let { key, data, query } = JSON.parse(string)
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch (_) { }
      return { key, data }
    }
    if (query) {
      return { key, query }
    }
  } catch (_) {
    return undefined
  }
}

const wss = new Server({ port: 9013 })

const url = new URL('https://cluster.vtbs.moe')

console.log('ws: 9013')

const { log } = cState

wss.on('connection', (ws, request) => {
  const resolveTable = new Map<string, (data: any) => void>()
  const uuid = httpHome.join((url: string) => {
    log('dispatch', { uuid })
    const key = keyGen()
    ws.send(JSON.stringify({
      key,
      data: {
        type: 'http',
        url,
      },
    }))
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(reject, 1000 * 15, 'timeout')
      resolveTable.set(key, data => {
        clearTimeout(timeout)
        resolve(data)
      })
    })
  })

  console.log('online:', httpHome.homes.size)

  const { searchParams } = new URL(request.url, url)
  metadatas
  map.set(httpHome.homes.get(uuid), Object.fromEntries(metadatas
    .map(key => [key, searchParams.get(key)])
    .filter(([_, v]) => v)))

  log('connect', { uuid })

  const router = {
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
  }

  ws.on('message', (message: string) => {
    if (message === 'DDDhttp') {
      if (httpHome.pending.length) {
        log('pull', { uuid })
        httpHome.pull(uuid)
      } else {
        ws.send('wait')
      }
    } else if (message === 'DDhttp') {
      log('pull', { uuid })
      httpHome.pull(uuid)
    } else {
      const json = parse(message)
      if (typeof json === 'object') {
        const { key, data, query } = json
        if (data) {
          if (resolveTable.has(key)) {
            resolveTable.get(key)(data)
            resolveTable.delete(key)
          }
        } else if (query) {
          const route = router[query as keyof typeof router]
          if (route) {
            const result = route()
            ws.send(JSON.stringify({
              key,
              data: {
                type: 'query',
                result,
              },
            }))
          }
        }
      }
    }
  })
  ws.on('close', n => {
    log('close', { n, uuid })
    httpHome.quit(uuid)
  })
})

