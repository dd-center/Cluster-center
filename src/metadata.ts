import AtHome from 'athome'

export const metadatas = ['runtime', 'platform', 'version', 'name', 'docker', 'uuid'] as const

export type MetadataKey = typeof metadatas[number]

export const map: WeakMap<ReturnType<InstanceType<typeof AtHome>['homes']['get']>, Partial<Record<MetadataKey, any>>> = new WeakMap()

let minuteDD = 0

export const ddCount = () => {
  minuteDD++
  setTimeout(() => {
    minuteDD--
  }, 1000 * 60)
}

export const getDDCount = () => minuteDD

export class Balancer {
  #resolve = 1
  #reject = 1
  resolve = () => {
    this.#resolve++
    setTimeout(() => {
      this.#resolve--
    }, 1000 * 60 * 30)
  }

  reject = () => {
    this.#reject++
    setTimeout(() => {
      this.#reject--
    }, 1000 * 60 * 30)
  }

  get drop() {
    const ratio = this.#resolve / this.#reject
    if (ratio < 1) {
      return Math.random() > Math.pow(ratio, 0.5)
    }
    return false
  }
}
