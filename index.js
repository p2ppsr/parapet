const boomerang = require('@cwi/boomerang')
const EventSource = require('eventsource')
const fetch = require('node-fetch')

const knownURLs = {}

module.exports = async ({
  bridge,
  request,
  trustedBridgeHosts = ['121h7eKPgbFRTMdRpp8WpbaKjGLa978aqT'],
  trustedBHRPEndpoint = 'https://bridgeport.babbage.systems/1TW5ogeDZyvq5q7tEjpNcBmJWsmQk7AeQ'
}) => {
  if (!knownURLs[bridge]) {
    const b64 = Buffer.from(JSON.stringify({
      v: 3,
      q: {
        collection: 'advertisements',
        find: {
          bridge,
          host: { $in: trustedBridgeHosts },
          revoked: false,
          expiryTime: { $gt: '' + (Date.now() / 1000) + 10 }
        },
        limit: 1
      }
    })).toString('base64')
    const hosts = await boomerang(
      'GET',
      `${trustedBHRPEndpoint}/q/${b64}`,
      {},
      { format: 'json' }
    )
    if (hosts[0]) {
      knownURLs[bridge] = hosts[0].URL
    }
  }
  if (!knownURLs[bridge]) {
    throw new Errror(
      'None of your trusted bridge hosts currently maintains a copy of the bridge you are attempting to access! If you can\'t find hosting, reach out to support@babbage.systems and we\'d be glad to help.'
    )
  }
  switch (request.type) {
    case 'socket':
      return new EventSource(`${knownURLs[bridge]}/${bridge}/s/${
        Buffer.from(JSON.stringify(request.query)).toString('base64')
      }`)
    case 'streaming-query':
      return fetch(
        `${knownURLs[bridge]}/${bridge}/q/${
          Buffer.from(JSON.stringify(request.query)).toString('base64')
        }`
      )
    case 'json-query':
      return boomerang(
        'GET',
        `${knownURLs[bridge]}/${bridge}/q/${
          Buffer.from(JSON.stringify(request.query)).toString('base64')
        }`,
        {},
        { format: 'json' }
      )
    case 'fetch':
      return fetch(
        `${knownURLs[bridge]}/${bridge}${request.path}`,
        request.fetchConfig
      )
    default:
      throw new Error(`Invalid request type: ${request.type}`)
  }
}