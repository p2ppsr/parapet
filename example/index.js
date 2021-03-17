const parapet = require('parapet-js')
const es = require('event-stream')

const init = async () => {
  // Streaming Query
  let result = await parapet({
    bridge: '1TW5ogeDZyvq5q7tEjpNcBmJWsmQk7AeQ',
    request: {
      type: 'streaming-query',
      query: {
        v: 3,
        q: {
          collection: 'bridges',
          find: {},
          project: { host: 1, bridge: 1, URL: 1 },
          limit: 3
        }
      }
    }
  })
  console.log('streaming response:')
  result.body.pipe(es.split())
    .pipe(process.stdout)

  // JSON Query
  result = await parapet({
    bridge: '1TW5ogeDZyvq5q7tEjpNcBmJWsmQk7AeQ',
    request: {
      type: 'json-query',
      query: {
        v: 3,
        q: {
          collection: 'bridges',
          find: {}
        }
      }
    }
  })
  console.log('\n\njson-query response:\n', result)

  // Fetch
  result = await parapet({
    bridge: '1TW5ogeDZyvq5q7tEjpNcBmJWsmQk7AeQ',
    request: {
      type: 'fetch',
      path: '/query',
      fetchConfig: {}
    }
  })
  result = await result.text()
  console.log('Fetch result with length', result.length)

  // Socket
  result = await parapet({
    bridge: '1TW5ogeDZyvq5q7tEjpNcBmJWsmQk7AeQ',
    request: {
      type: 'socket',
      query: {
        v: 3,
        q: {
          find: {}
        }
      }
    }
  })
  result.onmessage = e => {
    console.log(e)
    if (e.data) {
      const j = JSON.parse(e.data)
      if (j.type === 'open') {
        console.log('Socket was opened, closing now.')
        result.close()
      }
    }
  }
}

init()
