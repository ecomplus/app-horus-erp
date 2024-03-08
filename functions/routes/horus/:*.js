const Horus = require('../../lib/horus/client')

exports.all = async ({ appSdk }, req, res) => {
  const { method, params, url, body } = req
  try {
    const authorization = req.headers.authorization
    const [user, pass] = Buffer.from(authorization.replace('Basic ', ''), 'base64').toString('utf-8').split(':')
    const horus = new Horus(null, user, pass)

    const urlRequest = params[0] + url.split(params[0])[1]
    const { data } = horus[method.toLowerCase()](urlRequest, body)
    res.send(data)
  } catch (e) {
    console.error(e)
    throw e
  }
}
