import { Level } from 'level'

export type Danmaku = [string, string, number]

const database = new Level(process.env.MOCK ? 'db/cluster' : 'db')

const danmaku = database.sublevel<string, Danmaku | number>('danmaku', { valueEncoding: 'json' })
const record = database.sublevel<string, number>('record', { valueEncoding: 'json' })
const recordTime = database.sublevel<string, any>('recordTime', { valueEncoding: 'json' })

const getNum = (key: string, db: typeof record | typeof danmaku) => db.get(key).catch(() => 0) as Promise<number>

const increase = async (key: string, db: typeof record | typeof danmaku) => {
  const number = await getNum(key, db)
  await db.put(key, number + 1)
  return number
}

export const insertDanmaku = async (name: string, text: string, timestamp: number) => {
  const number = await increase('danmakuNumber', danmaku)
  danmaku.put(`danmaku_${number}`, [name, text, timestamp])
}

export const getDanmakuLength = () => getNum('danmakuNumber', danmaku)
export const getDanmaku = (number: number) => danmaku.get(`danmaku_${number}`)

export const statusRecorder = (uuid: string | undefined) => {
  if (!uuid) {
    return { success: () => { }, fail: () => { } }
  }
  recordTime.put(uuid, Date.now())
  const success = () => increase(`success_${uuid}`, record)
  const fail = () => increase(`fail_${uuid}`, record)
  return { success, fail }
}

export const getSuccess = (uuid: string) => record.get(`success_${uuid}`).catch(() => 0)
export const getFail = (uuid: string) => record.get(`fail_${uuid}`).catch(() => 0)
