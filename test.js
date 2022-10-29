const parapet = require('./index.js')
const boomerang = require('boomerang-http')
const EventSource = require('eventsource')
const fetch = require('node-fetch')

jest.mock('boomerang-http')
jest.mock('node-fetch')
jest.mock('eventsource')

let validInput

const resolvedHost1 = {
  URL: 'https://bridgeport.com',
  host: '121h7eKPgbFRTMdRpp8WpbaKjGLa978aqT'
}
const resolvedHost2 = {
  URL: 'https://bridgeport.net',
  host: '121h7eKPgbFRTMdRpp8WpbaKjGLa978aqT'
}
const resolvedHost3 = {
  URL: 'https://bridgeport.org',
  host: '121h7eKPgbFRTMdRpp8WpbaKjGLa978aqT'
}

describe('parapet', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    validInput = {
      bridge: '12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h',
      request: {
        type: 'streaming-query',
        query: {
          v: 3,
          q: {
            collection: 'users',
            find: {}
          }
        }
      },
      resolverCache: false
    }
  })
  it('is a function', () => {
    expect(parapet).toEqual(expect.any(Function))
  })
  it('Calls boomerang with a query for the bridge from the first resolver', async () => {
    boomerang.mockReturnValueOnce([resolvedHost1, resolvedHost2])
    await parapet(validInput)
    expect(boomerang).toHaveBeenCalledWith(
      'GET',
      expect.any(String),
      {},
      { format: 'json' }
    )
    const expectedQuery = {
      v: 3,
      q: {
        collection: 'bridges',
        find: {
          host: {
            $in: [
              '121h7eKPgbFRTMdRpp8WpbaKjGLa978aqT',
              '1PgzD5r2Et6o3kv8nQSYBsVxDZCD8M4Rrf'
            ]
          },
          bridge: '12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h',
          revoked: false,
          expiryTime: { $gt: expect.any(String) }
        },
        limit: 4
      }
    }
    const requestedURL = boomerang.mock.calls[0][1]
    expect(requestedURL.startsWith(
      'https://bridgeport.babbage.systems/1TW5ogeDZyvq5q7tEjpNcBmJWsmQk7AeQ/q'
    )).toEqual(true)
    expect(JSON.parse(
      Buffer.from(requestedURL.split('/')[5], 'base64').toString()
    )).toEqual(expectedQuery)
  })
  it('Falls back to second resolver if first resolver fails', async () => {
    boomerang
      .mockImplementationOnce(() => {
        throw new Error('failed')
      }).mockReturnValueOnce([resolvedHost1, resolvedHost2])
    await parapet(validInput)
    expect(boomerang).toHaveBeenCalledTimes(2)
    const boomCalls = boomerang.mock.calls.map(call => call[1].split('/1')[0])
    expect(boomCalls).toEqual([
      'https://bridgeport.babbage.systems',
      'https://bridgeport-failover.babbage.systems'
    ])
  })
  it('Uses a custom list of resolvers', async () => {
    validInput.resolvers = [
      'https://8.8.8.8'
    ]
    boomerang
      .mockReturnValueOnce([resolvedHost1, resolvedHost2])
    await parapet(validInput)
    expect(boomerang).toHaveBeenCalledTimes(1)
    const boomCalls = boomerang.mock.calls.map(call => call[1].split('/1')[0])
    expect(boomCalls).toEqual([
      'https://8.8.8.8'
    ])
  })
  it('Throws an Error if the bridge is unresolvable', async () => {
    boomerang
      .mockImplementation(() => {
        throw new Error('failed')
      })
    await expect(parapet(validInput)).rejects.toThrow(new Error(
      `The bridge you are attempting to reach (${validInput.bridge}) is not resolvable by any of the BHRP resolvers (either the ones you provided or the default resolvers). Either no one is hosting this bridge right now (the most likely case), or all of the BHRP resolvers are having errors. For help, you may contact bhrp-support@babbage.systems`
    ))
    expect(boomerang).toHaveBeenCalledTimes(3)
  })
  describe('When resolving the available hosts succeeds', () => {
    beforeEach(() => {
      boomerang
        .mockReturnValueOnce([resolvedHost1, resolvedHost2, resolvedHost3])
    })
    it('Does not try to resolve a second time when caching is enabled', async () => {
      validInput.resolverCache = true
      await parapet(validInput)
      await parapet(validInput)
      await parapet(validInput)
      await parapet(validInput)
      await parapet(validInput)
      expect(boomerang).toHaveBeenCalledTimes(1)
    })
    describe('When request type is socket', () => {
      beforeEach(() => {
        validInput.request = {
          type: 'socket',
          query: { v: 3, q: { find: {} } }
        }
      })
      it('Calls EventSource with the provided query, returning the result', async () => {
        const returnValue = await parapet(validInput)
        expect(EventSource).toHaveBeenCalledWith(
          `https://bridgeport.com/12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h/s/${
          Buffer.from(JSON.stringify({ v: 3, q: { find: {} } }))
            .toString('base64')}`
        )
        expect(returnValue.addEventListener).toEqual(expect.any(Function))
      })
      it('Uses an alternate host if the first host fails', async () => {
        EventSource.mockImplementationOnce(() => {
          throw new Error('error')
        })
        await parapet(validInput)
        expect(EventSource).toHaveBeenCalledTimes(2)
        expect(EventSource).toHaveBeenCalledWith(
          `https://bridgeport.com/12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h/s/${
          Buffer.from(JSON.stringify({ v: 3, q: { find: {} } }))
            .toString('base64')}`
        )
        expect(EventSource).toHaveBeenLastCalledWith(
          `https://bridgeport.net/12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h/s/${
          Buffer.from(JSON.stringify({ v: 3, q: { find: {} } }))
            .toString('base64')}`
        )
      })
    })
    describe('When request type is streaming-query', () => {
      it('Calls fetch with the provided query, returning the result', async () => {
        fetch.mockReturnValue('retval')
        const returnValue = await parapet(validInput)
        expect(fetch).toHaveBeenCalledWith(
          `https://bridgeport.com/12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h/q/${
          Buffer.from(JSON.stringify({
            v: 3,
            q: {
              collection: 'users',
              find: {}
            }
          })).toString('base64')}`
        )
        expect(returnValue).toEqual('retval')
      })
      it('Uses an alternate host if the first host fails', async () => {
        fetch.mockImplementationOnce(() => {
          throw new Error('error')
        })
        await parapet(validInput)
        expect(fetch).toHaveBeenCalledTimes(2)
        expect(fetch).toHaveBeenCalledWith(
          `https://bridgeport.com/12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h/q/${
          Buffer.from(JSON.stringify({
            v: 3,
            q: {
              collection: 'users',
              find: {}
            }
          })).toString('base64')}`
        )
        expect(fetch).toHaveBeenCalledWith(
          `https://bridgeport.net/12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h/q/${
          Buffer.from(JSON.stringify({
            v: 3,
            q: {
              collection: 'users',
              find: {}
            }
          })).toString('base64')}`
        )
      })
    })
    describe('When request type is json-query', () => {
      beforeEach(() => {
        validInput.request.type = 'json-query'
      })
      it('Calls boomerang with the provided query, returning the result', async () => {
        boomerang.mockReturnValue('retval')
        const returnValue = await parapet(validInput)
        expect(boomerang).toHaveBeenCalledWith(
          'GET',
          `https://bridgeport.com/12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h/q/${
          Buffer.from(JSON.stringify({
            v: 3,
            q: {
              collection: 'users',
              find: {}
            }
          })).toString('base64')}`,
          {},
          { format: 'json' }
        )
        expect(returnValue).toEqual('retval')
      })
      it('Uses an alternate host if the first host fails', async () => {
        boomerang.mockImplementationOnce(() => {
          throw new Error('error')
        })
        await parapet(validInput)
        expect(boomerang).toHaveBeenCalledTimes(3) // 1 for the initial resolve
        expect(boomerang).toHaveBeenCalledWith(
          'GET',
          `https://bridgeport.com/12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h/q/${
          Buffer.from(JSON.stringify({
            v: 3,
            q: {
              collection: 'users',
              find: {}
            }
          })).toString('base64')}`,
          {},
          { format: 'json' }
        )
        expect(boomerang).toHaveBeenLastCalledWith(
          'GET',
          `https://bridgeport.net/12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h/q/${
          Buffer.from(JSON.stringify({
            v: 3,
            q: {
              collection: 'users',
              find: {}
            }
          })).toString('base64')}`,
          {},
          { format: 'json' }
        )
      })
    })
    describe('When request type is fetch', () => {
      beforeEach(() => {
        validInput.request = {
          type: 'fetch',
          path: '/foobar',
          fetchConfig: {
            method: 'post'
          }
        }
      })
      it('Calls fetch with the provided request, returning the result', async () => {
        fetch.mockReturnValue('retval')
        const returnValue = await parapet(validInput)
        expect(fetch).toHaveBeenCalledWith(
          'https://bridgeport.com/12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h/foobar',
          { method: 'post' }
        )
        expect(returnValue).toEqual('retval')
      })
      it('Uses an alternate host if the first host fails', async () => {
        fetch.mockImplementationOnce(() => {
          throw new Error('error')
        })
        await parapet(validInput)
        expect(fetch).toHaveBeenCalledTimes(2)
        expect(fetch).toHaveBeenCalledWith(
          'https://bridgeport.com/12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h/foobar',
          { method: 'post' }
        )
        expect(fetch).toHaveBeenLastCalledWith(
          'https://bridgeport.net/12kZWuCjz9Q9mKieojXZVxGf2UMikcbW2h/foobar',
          { method: 'post' }
        )
      })
    })
  })
})
