const request = require('request')

const createRequest = (input, callback) => {
  let url = 'https://min-api.cryptocompare.com/data/'
  const endpoint = input.data.endpoint || 'price'
  url = url + endpoint

  const coin = input.data.coin || 'ETH'
  const market = input.data.market || 'USD'

  const queryObj = {
    fsym: coin,
    fsyms: coin,
    tsym: market,
    tsyms: market
  }

  for (const key in queryObj) {
    if (queryObj[key] === '') {
      delete queryObj[key]
    }
  }

  const options = {
    url: url,
    qs: queryObj,
    json: true
  }
  request(options, (error, response, body) => {
    if (error || response.statusCode >= 400) {
      callback(response.statusCode, {
        jobRunID: input.id,
        status: 'errored',
        error: body,
        statusCode: response.statusCode
      })
    } else {
      body.result = body[market]
      callback(response.statusCode, {
        jobRunID: input.id,
        data: body,
        statusCode: response.statusCode
      })
    }
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
