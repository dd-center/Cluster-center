import WebSocket, { Server } from 'ws'
import AtHome from 'athome'
import CState from '../state-center/api'
import { map, metadatas, ddCount } from './metadata'
import { httpHome, cState, router } from './home'

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

const { log, publish, subscribe } = cState
const danmakuPublish = publish('danmaku')

subscribe('cluster').on('danmaku', (nickname, danmaku) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ payload: { type: 'danmaku', data: { nickname, danmaku } } }))
    }
  })
})

const danmakuWaitMap = new WeakMap<any, number>()

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

  const sendDanmaku = (danmaku: string) => {
    const now = Date.now()
    if (!danmakuWaitMap.has(ws)) {
      danmakuWaitMap.set(ws, 0)
    }
    if (now - danmakuWaitMap.get(ws) > 1000) {
      const text = String(danmaku)
      if (text.length < 140) {
        danmakuPublish(map.get(httpHome.homes.get(uuid)).name || 'DD', text)
      }
      danmakuWaitMap.set(ws, now)
    }
  }

  log('connect', { uuid })

  ws.on('message', (message: string) => {
    if (message === 'DDDhttp') {
      ddCount()
      if (httpHome.pending.length) {
        log('pull', { uuid })
        httpHome.pull(uuid)
      } else {
        ws.send('wait')
      }
    } else if (message === 'DDhttp') {
      ddCount()
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
        } else if (typeof query === 'string') {
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
        } else if (query) {
          if (query.type === 'danmaku') {
            sendDanmaku(query.data)
          }
          ws.send(JSON.stringify({
            key,
            data: {
              type: 'query'
            }
          }))
        }
      }
    }
  })
  ws.on('close', n => {
    log('close', { n, uuid })
    httpHome.quit(uuid)
  })
})

