import { execute } from 'graphql'
import gql from 'graphql-tag'
import { makeExecutableSchema } from 'graphql-tools'

import { getDDCount, map } from './metadata'
import { httpHome } from './home'
import { getSuccess, getFail } from './db'

const typeDefs = gql`
  type Query {
    online: Int!
    pending: Int!
    DD: Int!
    homes: [Node!]!
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
    })
  },

  Node: {
    success: ({ uuid, resolves }: { uuid: string, resolves: number }) => uuid ? getSuccess(uuid) : resolves,
    fail: ({ uuid, reject }: { uuid: string, reject: number }) => uuid ? getFail(uuid) : reject
  }
}

const schema = makeExecutableSchema({ typeDefs, resolvers })

export const run = async (document: any) => {
  const { data } = await execute({ schema, document })
  return data
}
