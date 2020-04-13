const rp = require('request-promise')
const retries = process.env.RETRIES || 3
const delay = process.env.RETRY_DELAY || 1000
const timeout = process.env.TIMEOUT || 1000

class ValidationError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ValidationError'
    this.message = message
  }

  toJSON () {
    return {
      error: {
        name: this.name,
        message: this.message,
        stacktrace: this.stack
      }
    }
  }
}

const requestRetry = (options, retries) => {
  return new Promise((resolve, reject) => {
    const retry = (options, n) => {
      return rp(options)
        .then(response => {
          if (response.body.error || response.body.Response === 'Error') {
            if (n === 1) {
              reject(response.body)
            } else {
              setTimeout(() => {
                retries--
                retry(options, retries)
              }, delay)
            }
          } else {
            return resolve(response)
          }
        })
        .catch(error => {
          if (n === 1) {
            reject(error.body)
          } else {
            setTimeout(() => {
              retries--
              retry(options, retries)
            }, delay)
          }
        })
    }
    return retry(options, retries)
  })
}

const validateInput = (input) => {
  return new Promise((resolve, reject) => {
    if (typeof input.id === 'undefined') {
      input.id = '1'
    }
    if (typeof input.data === 'undefined') {
      reject(new ValidationError('No data supplied'))
    }
    resolve(input)
  })
}

const createRequest = (input, callback) => {
  validateInput(input)
    .then(input => {
      const endpoint = input.data.endpoint || 'price'
      const url = `https://min-api.cryptocompare.com/data/${endpoint}`
      const coin = input.data.base || input.data.from || input.data.coin || input.data.fsym || ''
      const market = input.data.quote || input.data.to || input.data.market || input.data.tsyms || ''

      const queryObj = {
        fsym: coin,
        fsyms: coin,
        tsym: market,
        tsyms: market
      }

      const options = {
        uri: url,
        qs: queryObj,
        json: true,
        timeout,
        resolveWithFullResponse: true
      }

      requestRetry(options, retries)
        .then(response => {
          const result = response.body[market.toUpperCase()]
          if (Number(result) === 0) throw new ValidationError('Zero result')
          response.body.result = result
          callback(response.statusCode, {
            jobRunID: input.id,
            data: response.body,
            result,
            statusCode: response.statusCode
          })
        })
        .catch(error => {
          callback(500, {
            jobRunID: input.id,
            status: 'errored',
            error,
            statusCode: 500
          })
        })
    })
    .catch(error => {
      callback(500, {
        jobRunID: input.id,
        status: 'errored',
        error: error.message,
        statusCode: 500
      })
    })
}

exports.gcpservice = (req, res) => {
  createRequest(req.body, (statusCode, data) => {
    res.status(statusCode).send(data)
  })
}

exports.handler = (event, context, callback) => {
  createRequest(event, (statusCode, data) => {
    callback(null, data)
  })
}

exports.handlerv2 = (event, context, callback) => {
  createRequest(JSON.parse(event.body), (statusCode, data) => {
    callback(null, {
      statusCode: statusCode,
      body: JSON.stringify(data),
      isBase64Encoded: false
    })
  })
}

module.exports.createRequest = createRequest
