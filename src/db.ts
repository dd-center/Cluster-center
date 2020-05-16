import leveldown from 'leveldown'
import levelup, { LevelUp } from 'levelup'
import sub from 'subleveldown'

const database = levelup(leveldown('db'))

const danmaku = sub(database, 'danmaku', { valueEncoding: 'json' })
const record = sub(database, 'record', { valueEncoding: 'json' })
const recordTime = sub(database, 'recordTime', { valueEncoding: 'json' })

const increase = async (key: string, db: LevelUp) => {
  const number = await db.get(key).catch(() => 0) as number
  await db.put(key, number + 1)
  return number
}

export const insertDanmaku = async (name: string, text: string, timestamp: number) => {
  const number = await increase('danmakuNumber', danmaku)
  danmaku.put(`danmaku_${number}`, [name, text, timestamp])
}

export const statusRecorder = (uuid: string | undefined) => {
  if (!uuid) {
    return { success: () => { }, fail: () => { } }
  }
  recordTime.put(uuid, Date.now())
  const success = () => increase(`success_${uuid}`, record)
  const fail = () => increase(`fail_${uuid}`, record)
  return { success, fail }
}
