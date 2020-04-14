const { Requester, Validator } = require('./adapter')
const retries = process.env.RETRIES || 3
const delay = process.env.RETRY_DELAY || 1000
const timeout = process.env.TIMEOUT || 1000

// Define custom error scenarios for the API.
// Return true for the adapter to retry.
const customError = (body) => {
  if (body.Response === 'Error') return true
  return false
}

// Define custom parameters to be used by the adapter.
// Extra parameters can be stated in the extra object,
// with a Boolean value indicating whether or not they
// should be required.
const customParams = {
  base: ['fsym'],
  quote: ['tsyms'],
  extra: {
    endpoint: false
  }
}

const createRequest = (input, callback) => {
  let validator
  try {
    validator = new Validator(input, customParams)
  } catch (error) {
    callback(500, {
      jobRunID: input.id,
      status: 'errored',
      error,
      statusCode: 500
    })
  }
  const jobRunID = validator.validated.id
  const endpoint = validator.validated.data.endpoint || 'price'
  const url = `https://min-api.cryptocompare.com/data/${endpoint}`
  const base = validator.validated.data.base.toUpperCase()
  const quote = validator.validated.data.quote.toUpperCase()

  const queryObj = {
    fsym: base,
    fsyms: base,
    tsym: quote,
    tsyms: quote
  }

  const options = {
    uri: url,
    qs: queryObj,
    json: true,
    timeout,
    resolveWithFullResponse: true
  }

  Requester.requestRetry(options, retries, delay, customError)
    .then(response => {
      const result = Requester.getResult(response.body, [quote])
      response.body.result = result
      callback(response.statusCode, {
        jobRunID,
        data: response.body,
        result,
        statusCode: response.statusCode
      })
    })
    .catch(error => {
      callback(500, {
        jobRunID,
        status: 'errored',
        error,
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
