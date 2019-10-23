const WebSocket = require('ws')

const keyGen = () => String(Math.random())
const parse = string => {
  try {
    let { key, data, query } = JSON.parse(string)
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch (_) {}
      return { key, data }
    }
    if (query) {
      return { key, query }
    }
  } catch (_) {
    return undefined
  }
}

const wss = new WebSocket.Server({ port: 9013 })

const url = new URL('https://cluster.vtbs.moe')
const metadatas = ['runtime', 'platform', 'version', 'name']

console.log('ws: 9013')

module.exports = (httpHome, log) => {
  wss.on('connection', (ws, request) => {
    const resolveTable = new Map()
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
      return new Promise(resolve => {
        resolveTable.set(key, resolve)
      })
    })

    console.log('online:', httpHome.homes.size)

    const { searchParams } = new URL(request.url, url)
    metadatas
      .map(key => [key, searchParams.get(key)])
      .filter(([_k, v]) => v)
      // eslint-disable-next-line no-return-assign
      .forEach(([k, v]) => httpHome.homes.get(uuid)[k] = v)

    log('connect', { uuid })

    const router = {
      pulls() {
        return httpHome.pulls.length
      },
      pending() {
        return httpHome.pending.length
      },
      homes() {
        return [...httpHome.homes.values()].map(({ runtime, version, platform, docker, name, resolves, rejects, lastSeen }) => ({ runtime, version, platform, docker, name, resolves, rejects, lastSeen }))
      },
      online() {
        return httpHome.homes.size
      }
    }

    ws.on('message', message => {
      if (message === 'DDhttp') {
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
            const route = router[query]
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
          }
        }
      }
    })
    ws.on('close', n => {
      log('close', { n, uuid })
      httpHome.quit(uuid)
    })
  })
}
