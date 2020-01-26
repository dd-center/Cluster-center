import AtHome from 'athome'

export const metadatas = ['runtime', 'platform', 'version', 'name', 'docker'] as const

type MetadataKey = typeof metadatas[number]

export const map = new WeakMap<ReturnType<InstanceType<typeof AtHome>["homes"]["get"]>, Record<MetadataKey, any>>()
