import WebSocket, { Server } from 'ws'
import AtHome from 'athome'
import CState from '../state-center/api'
import { map, metadatas, ddCount, Balancer } from './metadata'
import { httpHome, cState, router } from './home'
import { insertDanmaku, statusRecorder } from './db'
import { run } from './graphql'

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
  const uuid = httpHome.join(url => {
    log('dispatch', { uuid })
    const key = keyGen()
    ws.send(JSON.stringify({
      key,
      data: {
        type: 'http',
        url
      }
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
  const balancer = new Balancer()

  const { searchParams } = new URL(request.url, url)

  map.set(httpHome.homes.get(uuid), Object.fromEntries(metadatas
    .map(key => [key, searchParams.get(key)])
    .filter(([_, v]) => v)))

  const recorder = statusRecorder(map.get(httpHome.homes.get(uuid)).uuid)

  const sendDanmaku = (danmaku: string) => {
    const now = Date.now()
    if (!danmakuWaitMap.has(ws)) {
      danmakuWaitMap.set(ws, 0)
    }
    if (now - danmakuWaitMap.get(ws) > 1000) {
      const text = String(danmaku)
      if (text.length <= 256) {
        const name = map.get(httpHome.homes.get(uuid)).name || 'DD'
        danmakuPublish(name, text)
        insertDanmaku(name, text, Date.now())
      }
      danmakuWaitMap.set(ws, now)
    }
  }

  log('connect', { uuid })

  ws.on('message', async (message: string) => {
    if (message === 'DDDhttp') {
      if (!balancer.drop) {
        ddCount()
        if (httpHome.pending.length) {
          log('pull', { uuid })
          httpHome.pull(uuid)
            .then(w => {
              if (w) {
                balancer.resolve()
                recorder.success()
              } else {
                balancer.reject()
                recorder.fail()
              }
            })
        } else {
          ws.send(JSON.stringify({
            key: '',
            data: {
              type: 'wait',
              url: null
            },
            empty: true
          }))
        }
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
                result
              }
            }))
          }
        } else if (query) {
          if (query.type === 'danmaku') {
            sendDanmaku(query.data)
            ws.send(JSON.stringify({
              key,
              data: {
                type: 'query'
              }
            }))
          } else if (query.type === 'GraphQL') {
            const { document, variableValues } = query
            ws.send(JSON.stringify({
              key,
              data: {
                type: 'query',
                result: await run(document, variableValues, { id: uuid as string })
              }
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
