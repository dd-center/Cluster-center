import { Buffer } from 'buffer'
import { Server } from 'net'

import { httpHome } from './home'

import { map, metadatas, MetadataKey, ddCount, Balancer } from './metadata'

import { keyGen } from './ws'
import { statusRecorder } from './db'

// UInt 32 Be
// utf8

// Send [1][key length][key][url length][url]
// normal job

// Send [2]
// wait

// Receive [1][key length][key][json length][json]
// normal job

// Receive [2]
// DDDhttp

// Receive [3][key length][key][value length][value]
// set parameter

const uint32Buffer = (n: number) => {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32BE(n, 0)
  return buffer
}

const server = new Server()

server.on('connection', socket => {
  const resolveTable = new Map<string, (data: any) => void>()

  const uuid = httpHome.join(url => {
    const key = keyGen()
    const keyBuffer = Buffer.from(key)
    const urlBuffer = Buffer.from(url)
    socket.write(uint32Buffer(1))
    socket.write(uint32Buffer(keyBuffer.length))
    socket.write(keyBuffer)
    socket.write(uint32Buffer(urlBuffer.length))
    socket.write(urlBuffer)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject('timeout')
        resolveTable.delete(key)
      }, 1000 * 15)
      resolveTable.set(key, data => {
        clearTimeout(timeout)
        resolve(data)
      })
    })
  })

  console.log('online(tcp):', httpHome.homes.size)

  const balancer = new Balancer()
  map.set(httpHome.homes.get(uuid), {})

  let bufferCache = Buffer.alloc(0)
  let state = 'WAIT'
  const states = {} as any
  let waitLength = 4

  const pull = () => {
    if (!balancer.drop) {
      ddCount()
      if (httpHome.pending.length) {
        httpHome.pull(uuid)
          .then(w => {
            if (w) {
              balancer.resolve()
              statusRecorder(map.get(httpHome.homes.get(uuid)).uuid).success()
            } else {
              balancer.reject()
              statusRecorder(map.get(httpHome.homes.get(uuid)).uuid).fail()
            }
          })
      } else {
        socket.write(uint32Buffer(2))
      }
    } else {
      socket.write(uint32Buffer(2))
    }
  }

  const read = () => {
    while (bufferCache.length >= waitLength) {
      const toRead = bufferCache.slice(0, waitLength)
      bufferCache = Buffer.from(bufferCache.slice(waitLength))

      switch (state) {
        case 'WAIT':
          const v = toRead.readUInt32BE(0)
          switch (v) {
            case 1:
              state = 'jobK'
              states.type = 'job'
              break

            case 2:
              pull()
              break

            case 3:
              state = 'paramK'
              states.type = 'param'
              break;

            default:
              socket.end()
              break
          }
          break

        case 'jobK':
        case 'paramK':
        case 'jobKLV':
        case 'paramKLV':
          waitLength = toRead.readUInt32BE(0)
          state += 'L'
          break

        case 'jobKL':
        case 'paramKL':
          states.key = toRead.toString()
          waitLength = 4
          state += 'V'
          break

        case 'jobKLVL':
        case 'paramKLVL':
          states.value = toRead.toString()
          waitLength = 4
          state = 'WAIT'
          if (states.type === 'job') {
            resolveTable.get(states.key)(states.value)
            resolveTable.delete(states.key)
          } else if (states.type === 'param') {
            if (metadatas.includes(states.key)) {
              map.get(httpHome.homes.get(uuid))[states.key as MetadataKey] = states.value
            }
          }
          break

        default:
          socket.end()
          break
      }

    }
  }

  socket.on('data', data => {
    bufferCache = Buffer.concat([bufferCache, data])
    read()
  })

  socket.on('close', () => {
    httpHome.quit(uuid)
  })

})

server.listen(9014)
console.log('tcp: 9014')
