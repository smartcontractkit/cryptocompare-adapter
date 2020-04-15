const { Requester, Validator } = require('external-adapter')

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
  base: ['base', 'from', 'coin', 'fsym'],
  quote: ['quote', 'to', 'market', 'tsyms'],
  endpoint: false
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
  const fsym = validator.validated.data.base.toUpperCase()
  const tsyms = validator.validated.data.quote.toUpperCase()

  const qs = {
    fsym,
    tsyms
  }

  const options = {
    url,
    qs
  }

  Requester.requestRetry(options, customError)
    .then(response => {
      const result = Requester.validateResult(response.body, [tsyms])
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
