import io from 'socket.io-client'
import { Server } from 'socket.io'

// const socket = io('https://api.vtbs.moe')
// const dispatch = { emit: console.log }
// ↑ Dev
// ↓ Prod
const socket = io('http://0.0.0.0:8001')
const dispatch = new Server(9003, {
  serveClient: false,
  allowEIO3: true
})

const rooms = new Map<number, { mid: number, follower: number, active: number }>()

const watch = ({ roomid, mid, follower }: { roomid: number, mid: number, follower: number }) => {
  if (!rooms.has(roomid)) {
    rooms.set(roomid, { mid, follower, active: 0 })
  }
}

const activate = (roomid: number) => {
  if (rooms.has(roomid)) {
    rooms.get(roomid).active++
    setTimeout(() => {
      rooms.get(roomid).active--
    }, 30 * 1000)
  }
}

export const pickRoom = (): undefined | number => {
  if (rooms.size) {
    const pick = [...rooms.entries()]
      .sort(([_, { follower: a }], [__, { follower: b }]) => b - a)
      .sort(([_, { active: a }], [__, { active: b }]) => a - b)[0][0]
    activate(pick)
    return pick
  } else {
    return undefined
  }
}

export const getRooms = () => [...rooms.entries()].map(([roomid, { mid, active }]) => ({ roomid, mid, active }))

export const totalActive = () => getRooms().map(({ active }) => active).reduce((a, b) => a + b, 0)

socket.on('info', async (info: { roomid: number | undefined, mid: number, follower: number }[]) => {
  info
    .filter(({ roomid }) => roomid)
    .forEach(({ roomid, mid, follower }) => watch({ roomid, mid, follower }))
  console.log('ROOMS REFRESH')
})

const cache = new Set<string>()

type Pass = {
  roomid: number
  e: 'LIVE' | 'PREPARING' | 'ROUND' | 'heartbeat' | 'online' | 'ROOM_CHANGE' | 'DANMU_MSG' | 'SEND_GIFT' | 'GUARD_BUY'
  token?: string
  data: any
}

export const pass = ({ roomid, e, data, token }: Pass) => {
  if (rooms.has(roomid)) {
    const mid = rooms.get(roomid).mid
    if (token) {
      if (!cache.has(token)) {
        cache.add(token)
        setTimeout(() => cache.delete(token), 30 * 1000)
        if (e === 'online') {
          dispatch.emit('online', { roomid, mid, online: data })
        } else if (e === 'ROOM_CHANGE') {
          dispatch.emit('title', { roomid, mid, title: data })
        } else if (e === 'DANMU_MSG') {
          const { message, uname, timestamp, mid } = data
          dispatch.emit('danmaku', { message, roomid, mid, uname, timestamp })
        } else if (e === 'SEND_GIFT') {
          const { coinType, giftId, totalCoin, uname, mid } = data
          dispatch.emit('gift', { roomid, mid, giftId, totalCoin, coinType, uname })
        } else if (e === 'GUARD_BUY') {
          const { mid, uname, num, price, giftId, level } = data
          dispatch.emit('guard', { roomid, mid, uname, num, price, giftId, level })
        }
      }
    } else {
      if (e === 'LIVE' || e === 'PREPARING' || e === 'ROUND') {
        dispatch.emit(e, { roomid, mid })
      } else if (e === 'heartbeat') {
        activate(roomid)
        pass({ roomid, e: 'online', token: `${roomid}_online_${data}`, data })
      }
    }
  }
}
