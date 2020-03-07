import AtHome from 'athome'

export const metadatas = ['runtime', 'platform', 'version', 'name', 'docker'] as const

type MetadataKey = typeof metadatas[number]

export const map: WeakMap<ReturnType<InstanceType<typeof AtHome>["homes"]["get"]>, Record<MetadataKey, any>> = new WeakMap()

let minuteDD = 0

export const ddCount = () => {
  minuteDD++
  setTimeout(() => {
    minuteDD--
  }, 1000 * 60)
}

export const getDDCount = () => minuteDD
