# parapet-js

Serverless Interactions with Bridgeport

## Overview

Rather than having to interact with Bridgeport via HTTP directly, this tool allows you to specify the bridge that you'd like to use and how you'd like to interact. Since a bridge hosted by one node is identical to the same bridge hosted by any other node, you can eliminate a single point of failure in your application by providing a list of many Bridgehprt hosts that you trust, and the library will complete your request with one of the hosts you specified after first resolving the appropriate URL with BHRP.

## API

Parapet exports a single function that takes an object as its first parameter. The object contains the following fields:

Field               | Description
--------------------|-------------------------
bridge              | The Bridge ID Address for the bridge that you would like to interact with
request             | The request that you would like to make from the bridge (more details below)
trustedBridgeHosts  | An array of BHRP Host ID Addresses for BHRP Hosts that you trust to serve good data (By default, contains the ID of the Babbage host)
resolvers           | An array of Bridgeport server URLs you trust that host the BHRP resolver bridge (default: uses Babbage resolvers)
resolverCache       | A boolean indicating whether BHRP host resolutions should be cached to avoid re-resolving the same bridge on subsequent calls (default: true)

### The Request Object

Use the request object to specify how you want to interact with the specified bridge.

#### Socket

To connect to the live event socket, provide a request object like the following. The `parapet` function will return an `EventSource` object that you can listen to in order to respond to live events.

```
{
  type: 'socket',
  query: {
    v: 3,
    q: {
      find: {
        ...
      }
    }
  }
}
```

#### Streaming Query

You can run a query against the bridge in two ways. This is the more flexible approach. It returns a Promise for the result returned from the Fetch API, which you can use to process the streaming ND-JSON response.

```
{
  type: 'streaming-query',
  query: {
    v: 3,
    q: {
      find: {
        ...
      }
    }
  }
}
```

#### JSON Query

This approach to running a query against the bridge provides a simpler response, but it should only be used for relatively small query response payloads. You are encouraged to use the **Streaming Query** approach above. The call to `parapet` will return a Promise for a JavaScript array containing the results of your query.

```
{
  type: 'json-query',
  query: {
    v: 3,
    q: {
      find: {
        ...
      }
    }
  }
}
```

#### Fetch

This is how you can interact with custom routes provided by the bridge. Just as with the **Streaming Query** approach, you will receive a Promise for the result returned by the Fetch API.

For the path field, provide a path relative to the bridge root.

```
{
  type: 'fetch',
  path: '/users',
  fetchConfig: {
    method: 'get',
    ...
  }
}
```

## Example Usage

This example demonstrates the four modes of Parapet operation:

```js
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
```

## License

The license for the code in this repository is the Open BSV License.
