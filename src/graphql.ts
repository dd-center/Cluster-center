import { execute } from 'graphql'
import gql from 'graphql-tag'
import { makeExecutableSchema } from 'graphql-tools'

import { getDDCount, map } from './metadata'
import { httpHome } from './home'
import { getSuccess, getFail, getDanmakuLength, getDanmaku } from './db'

type Danmaku = Parameters<Parameters<ReturnType<typeof getDanmaku>['then']>[0]>[0]

const typeDefs = gql`
  type Query {
    online: Int!
    pending: Int!
    DD: Int!
    homes: [Node!]!
    danmaku: DanmakuList!
  }

  type DanmakuList {
    length: Int!
    danmaku(number: Int = 1, skip: Int = 0): [Danmaku!]!
  }

  type Danmaku {
    name: String!
    text: String!
    timestamp: Int!
  }

  type Node {
    id: String!
    success: Int!
    fail: Int!
    runtime: String
    platform: String
    version: String
    name: String
    docker: String
  }
`

const resolvers = {
  Query: {
    online: () => httpHome.homes.size,
    pending: () => httpHome.pending.length,
    DD: () => getDDCount(),
    homes: () => [...httpHome.homes.values()].map(home => {
      const { resolves, rejects } = home
      const { id } = home
      const metadata = map.get(home)
      return { id, resolves, rejects, ...metadata }
    }),
    danmaku: () => ({})
  },

  DanmakuList: {
    length: () => getDanmakuLength(),
    danmaku: (_: any, { number, skip }: { number: number, skip: number }) => Array(number)
      .fill(skip)
      .map((skip, i) => i + skip)
      .map(getDanmaku)
  },

  Danmaku: {
    name: ([name]: Danmaku) => name,
    text: ([_, text]: Danmaku) => text,
    timestamp: ([_, __, timestamp]: Danmaku) => timestamp
  },

  Node: {
    success: ({ uuid, resolves }: { uuid: string, resolves: number }) => uuid ? getSuccess(uuid) : resolves,
    fail: ({ uuid, reject }: { uuid: string, reject: number }) => uuid ? getFail(uuid) : reject
  }
}

const schema = makeExecutableSchema({ typeDefs, resolvers })

export const run = async (document: any, variableValues: any) => {
  const { data, errors } = await execute({ schema, document, variableValues })
  if (errors) {
    console.error(errors)
  }
  return data
}
