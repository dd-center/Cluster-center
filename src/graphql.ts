import { execute } from 'graphql'
import gql from 'graphql-tag'
import { makeExecutableSchema } from 'graphql-tools'

import { getDDCount, map } from './metadata'
import { httpHome } from './home'
import { getSuccess, getFail, getDanmakuLength, getDanmaku, Danmaku } from './db'
import { totalActive, getRooms } from './relay'

type GraphQLContext = { id: string }

const typeDefs = gql`
  type Query {
    online: Int!
    pending: Int!
    DD: Int!
    homes: [Node!]!
    danmaku: DanmakuList!
    totalActive: Int!
    rooms: RoomList!
    id: String!
  }

  type DanmakuList {
    length: Int!
    danmaku(number: Int = 1, skip: Int = 0): [Danmaku!]!
  }

  type RoomList {
    length: Int!
  }

  type Danmaku {
    name: String!
    text: String!
    timestamp: String!
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
    danmaku: () => ({}),
    rooms: () => ({}),
    totalActive: () => totalActive(),
    id: (_: any, __: any, { id }: GraphQLContext) => id
  },

  DanmakuList: {
    length: () => getDanmakuLength(),
    danmaku: (_: any, { number, skip }: { number: number, skip: number }) => Array(number)
      .fill(skip)
      .map((skip, i) => i + skip)
      .map(getDanmaku)
      .map(async danmakuP => {
        const [name, text, timestamp] = await danmakuP as Danmaku
        return [name, text, String(timestamp)]
      })
  },

  RoomList: {
    length: () => getRooms().length
  },

  Danmaku: {
    name: ([name]: Danmaku) => name,
    text: ([_, text]: Danmaku) => text,
    timestamp: ([_, __, timestamp]: Danmaku) => timestamp
  },

  Node: {
    success: ({ uuid, resolves }: { uuid: string, resolves: number }) => uuid ? getSuccess(uuid) : resolves,
    fail: ({ uuid, rejects }: { uuid: string, rejects: number }) => uuid ? getFail(uuid) : rejects
  }
}

const schema = makeExecutableSchema({ typeDefs, resolvers })

export const run = async (document: any, variableValues: any, contextValue: GraphQLContext) => {
  const { data, errors } = await execute({ schema, document, variableValues, contextValue })
  if (errors) {
    console.error(errors)
  } else {
    return data
  }
}
