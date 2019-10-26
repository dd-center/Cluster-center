const io = require('socket.io-client')

const socket = io('http://0.0.0.0:9200?name=cluster')

const log = (raw, extra = {}) => socket.emit('log', { raw, ...extra })
const error = (raw, extra = {}) => socket.emit('error', { raw, ...extra })

const state = route => {
  socket.on('state', (key, ack) => {
    if (typeof ack === 'function') {
      if (route[key]) {
        ack(route[key]())
      }
    }
  })
}

module.exports = {
  log,
  error,
  state
}
