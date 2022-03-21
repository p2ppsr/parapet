const boomerang = require('boomerang-http')

const BHRP_BRIDGE_ID = '1TW5ogeDZyvq5q7tEjpNcBmJWsmQk7AeQ'
const globalKnownURLs = {}

// The correct versions of EventSource and fetch should be used
let fetch, EventSource
if (typeof window !== 'undefined') {
  fetch = typeof window.fetch !== 'undefined'
    ? window.fetch
    : require('node-fetch')
  EventSource = typeof window.EventStream !== 'undefined'
    ? window.EventSource
    : require('eventsource')
} else {
  fetch = require('node-fetch')
  EventSource = require('eventsource')
}

module.exports = async ({
  bridge,
  request,
  trustedHosts = ['121h7eKPgbFRTMdRpp8WpbaKjGLa978aqT'],
  resolvers = [
    'https://bridgeport.babbage.systems',
    'https://bridgeport-failover.babbage.systems',
    'https://bridgeport.gateway.cash'
  ],
  resolverCache = true
}) => {
  const knownURLs = resolverCache ? globalKnownURLs : {}
  if (!knownURLs[bridge]) {
    const resolverQuery = Buffer.from(JSON.stringify({
      v: 3,
      q: {
        collection: 'bridges',
        find: {
          bridge,
          host: { $in: trustedHosts },
          revoked: false,
          expiryTime: { $gt: '' + parseInt(Date.now() / 1000) + 10 }
        },
        limit: 4
      }
    })).toString('base64')
    for (let i = 0; i < resolvers.length && !knownURLs[bridge]; i++) {
      try {
        const hosts = await boomerang(
          'GET',
          `${resolvers[i]}/${BHRP_BRIDGE_ID}/q/${resolverQuery}`,
          {},
          { format: 'json' }
        )
        if (Array.isArray(hosts) && hosts[0]) {
          knownURLs[bridge] = hosts
        }
      } catch (e) {}
    }
  }
  if (!knownURLs[bridge]) {
    throw new Error(
      'The bridge you are attempting to reach is not resolvable by any of the BHRP resolvers (either the ones you provided or the default resolvers). Either no one is hosting this bridge right now (the most likely case), or all of the BHRP resolvers are having errors. For help, you may contact bhrp-support@babbage.systems'
    )
  }
  for (let i = 0; i < knownURLs[bridge].length; i++) {
    try {
      const endpoint = `${knownURLs[bridge][i].URL}/${bridge}`
      let result
      switch (request.type) {
        case 'socket':
          result = new EventSource(
            `${endpoint}/s/${Buffer.from(JSON.stringify(request.query))
              .toString('base64')}`
          )
          return result
        case 'streaming-query':
          result = await fetch(
            `${endpoint}/q/${Buffer.from(JSON.stringify(request.query))
              .toString('base64')}`
          )
          return result
        case 'json-query':
          result = await boomerang(
            'GET',
            `${endpoint}/q/${Buffer.from(
              JSON.stringify(request.query)
            ).toString('base64')}`,
            {},
            { format: 'json' }
          )
          return result
        case 'fetch':
          result = await fetch(
            `${endpoint}${request.path}`,
            request.fetchConfig
          )
          return result
        default:
          throw new Error(`Invalid request type: ${request.type}`)
      }
    } catch (e) {
      continue
    }
  }
}
