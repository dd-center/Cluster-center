import leveldown from 'leveldown'
import levelup from 'levelup'
import encode from 'encoding-down'

const db = levelup(encode(leveldown('db'), { valueEncoding: 'json' }))

