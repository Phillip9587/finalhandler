const assert = require('assert')
const finalhandler = require('../..')
const http = require('http')
const http2 = require('http2')

const request = require('supertest')
const SlowWriteStream = require('./sws')

exports.assert = assert
exports.createError = createError
exports.createHTTPServer = createHTTPServer
exports.createHTTP2Server = createHTTP2Server
exports.createSlowWriteStream = createSlowWriteStream
exports.rawrequest = rawrequest
exports.rawrequestHTTP2 = rawrequestHTTP2
exports.request = request
exports.shouldHaveStatusMessage = shouldHaveStatusMessage
exports.shouldNotHaveBody = shouldNotHaveBody
exports.shouldNotHaveHeader = shouldNotHaveHeader

function createError (message, props) {
  const err = new Error(message)

  if (props) {
    for (const prop in props) {
      err[prop] = props[prop]
    }
  }

  return err
}

function createHTTPServer (err, opts) {
  return http.createServer(function (req, res) {
    const done = finalhandler(req, res, opts)

    if (typeof err === 'function') {
      err(req, res, done)
      return
    }

    done(err)
  })
}

function createHTTP2Server (err, opts) {
  return http2.createServer(function (req, res) {
    const done = finalhandler(req, res, opts)

    if (typeof err === 'function') {
      err(req, res, done)
      return
    }

    done(err)
  })
}

function createSlowWriteStream () {
  return new SlowWriteStream()
}

function rawrequest (server) {
  const _headers = {}
  let _path

  function expect (status, body, callback) {
    if (arguments.length === 2) {
      _headers[status.toLowerCase()] = body
      return this
    }

    server.listen(function onlisten () {
      const addr = this.address()
      const port = addr.port

      const req = http.get({
        host: '127.0.0.1',
        path: _path,
        port: port
      })
      req.on('error', callback)
      req.on('response', function onresponse (res) {
        let buf = ''

        res.setEncoding('utf8')
        res.on('data', function ondata (s) { buf += s })
        res.on('end', function onend () {
          let err = null

          try {
            for (const key in _headers) {
              assert.strictEqual(res.headers[key], _headers[key])
            }

            assert.strictEqual(res.statusCode, status)

            if (body instanceof RegExp) {
              assert.ok(body.test(buf), 'expected body ' + buf + ' to match ' + body)
            } else {
              assert.strictEqual(buf, body, 'expected ' + body + ' response body, got ' + buf)
            }
          } catch (e) {
            err = e
          }

          server.close()
          callback(err)
        })
      })
    })
  }

  function get (path) {
    _path = path

    return {
      expect: expect
    }
  }

  return {
    get: get
  }
}

function rawrequestHTTP2 (server) {
  const _headers = {}
  let _path

  function expect (status, body, callback) {
    if (arguments.length === 2) {
      _headers[status.toLowerCase()] = body
      return this
    }

    server.listen(function onlisten () {
      let buf = ''
      let resHeaders
      const addr = this.address()
      const port = addr.port

      const client = http2.connect('http://127.0.0.1:' + port)
      const req = client.request({
        ':method': 'GET',
        ':path': _path.replace(/http:\/\/localhost/, '')
      })
      req.on('error', callback)
      req.on('response', function onresponse (responseHeaders) {
        resHeaders = responseHeaders
      })
      req.on('data', function ondata (s) { buf += s })
      req.on('end', function onend () {
        let err = null

        try {
          for (const key in _headers) {
            assert.strictEqual(resHeaders[key], _headers[key])
          }

          assert.strictEqual(resHeaders[':status'], status)

          if (body instanceof RegExp) {
            assert.ok(body.test(buf), 'expected body ' + buf + ' to match ' + body)
          } else {
            assert.strictEqual(buf, body, 'expected ' + body + ' response body, got ' + buf)
          }
        } catch (e) {
          err = e
        }

        req.close()
        client.close()
        server.close()
        callback(err)
      })
    })
  }

  function get (path) {
    _path = path

    return {
      expect: expect
    }
  }

  return {
    get: get
  }
}

function shouldHaveStatusMessage (statusMessage) {
  return function (test) {
    assert.strictEqual(test.res.statusMessage, statusMessage, 'should have statusMessage "' + statusMessage + '"')
  }
}

function shouldNotHaveBody () {
  return function (res) {
    assert.ok(res.text === '' || res.text === undefined)
  }
}

function shouldNotHaveHeader (header) {
  return function (test) {
    assert.ok(test.res.headers[header] === undefined, 'response does not have header "' + header + '"')
  }
}
