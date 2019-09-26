const WebSocket = require('ws')

const keyGen = () => String(Math.random())
const parse = string => {
  try {
    const { key, data } = JSON.parse(string)
    return { key, data }
  } catch (_) {
    return undefined
  }
}

const wss = new WebSocket.Server({ port: 9013 })

const url = new URL('https://cluster.vtbs.moe')
const metadatas = ['runtime', 'platform', 'version', 'name']

console.log('ws: 9013')

module.exports = httpHome => {
  wss.on('connection', (ws, request) => {
    const resolveTable = new Map()
    const uuid = httpHome.join(url => {
      console.log(`dispatch to ${uuid}`)
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

    const { searchParams } = new URL(request.url, url)
    metadatas
      .map(key => [key, searchParams.get(key)])
      .filter(([_k, v]) => v)
      // eslint-disable-next-line no-return-assign
      .forEach(([k, v]) => httpHome.homes.get(uuid)[k] = v)

    console.log(`cluster connect ${uuid}`)

    ws.on('message', message => {
      if (message === 'DDhttp') {
        console.log(`pull ${uuid}`)
        httpHome.pull(uuid)
      } else {
        const json = parse(message)
        if (json) {
          const { key, data } = json
          if (resolveTable.has(key)) {
            resolveTable.get(key)(data)
            resolveTable.delete(key)
          }
        }
      }
    })
    ws.on('close', n => {
      console.log(`cluster closed ${n} ${uuid}`)
    })
  })
}
