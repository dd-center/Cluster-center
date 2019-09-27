const io = require('socket.io-client')

const socket = io('http://0.0.0.0:9200?name=cluster')

const log = (raw, extra = {}) => socket.emit('log', { raw, ...extra })

module.exports = {
  log
}
