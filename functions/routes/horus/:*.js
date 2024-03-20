const Horus = require('../../lib/horus/client')

exports.all = async ({ appSdk }, req, res) => {
  const { method, params, url, body } = req
  const urlRequest = params[0] + url.split(params[0])[1]
  try {
    const authorization = req.headers.authorization
    const [user, pass] = Buffer.from(authorization.replace('Basic ', ''), 'base64').toString('utf-8').split(':')
    const baseUrl = req.headers['x-base-url']
    console.log('>> BaseUrl ', baseUrl)
    const horus = new Horus(user, pass, baseUrl)

    const { data, status } = await horus[method.toLowerCase()](urlRequest, body)
    console.log(' ', data, ' ', status) // TODO
    res.send(data)
  } catch (error) {
    console.error('Error response ', error.response)
    // try to debug request error
    const errCode = 'PROXY_HORUS_ERR'
    let { message } = error
    let statusCode = 409
    const err = new Error(`${errCode} => ${message}`)
    if (error.response) {
      const { status, data } = error.response
      if (statusCode) {
        statusCode = status
      }
      if (status !== 401 && status !== 403) {
        err.url = urlRequest
        err.body = JSON.stringify(body)
        err.status = status
        if (typeof data === 'object' && data) {
          err.response = JSON.stringify(data)
        } else {
          err.response = data
        }
      } else if (data && Array.isArray(data.errors) && data.errors[0] && data.errors[0].message) {
        message = data.errors[0].message
      } else if (data) {
        console.error('Error Response Data: ', JSON.stringify(data))
        message = data
      }
      console.error('err: ', err)
    } else {
      console.error(error)
    }
    res.status(statusCode)
    res.send({
      error: errCode,
      message
    })
  }
}
