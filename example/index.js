const parapet = require('parapet-js')
const es = require('event-stream')

const init = async () => {
  // Streaming Query
  let result = await parapet({
    bridge: '1TW5ogeDZyvq5q7tEjpNcBmJWsmQk7AeQ',
    request: {
      type: 'streaming-query',
      query: {
        q: {
          collection: 'advertisements',
          find: {},
          project: { host: 1, bridge: 1, URL: 1, _id: 0 }
        }
      }
    }
  })
  result.body.pipe(es.split())
    .pipe(process.stdout)

  // JSON Query
  result = await parapet({
    bridge: '1TW5ogeDZyvq5q7tEjpNcBmJWsmQk7AeQ',
    request: {
      type: 'json-query',
      query: {
        q: {
          collection: 'advertisements',
          find: {},
          project: { host: 1, bridge: 1, URL: 1, _id: 0 }
        }
      }
    }
  })
  console.log()
  console.log(result)

  // Fetch
  result = await parapet({
    bridge: '1TW5ogeDZyvq5q7tEjpNcBmJWsmQk7AeQ',
    request: {
      type: 'fetch',
      path: '/query',
      fetchConfig: {}
    }
  })
  result.body.pipe(process.stdout)
  // We'll wait before continuing to allow this to finish printing
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Socket
  result = await parapet({
    bridge: '1TW5ogeDZyvq5q7tEjpNcBmJWsmQk7AeQ',
    request: {
      type: 'socket',
      query: {
        q: {
          collection: 'advertisements',
          find: {},
          project: { host: 1, bridge: 1, URL: 1, _id: 0 }
        }
      }
    }
  })
  result.onmessage = e => {
    console.log(e)
    if (e.data) {
      const j = JSON.parse(e.data)
      if (j.type === 'open') {
        result.close()
      }
    }
  }
}

init()
