// const axios = require('axios')

exports.all = async ({ appSdk }, req, res) => {
  const { method, params, url } = req
  try {
    const authorization = req.headers.authorization
    const [user, pass] = Buffer.from(authorization.replace('Basic ', ''), 'base64').toString('utf-8').split(':')

    const urlRequest = params[0] + url.split(params[0])[1]
    // const { data } = await axios[method.toLowerCase()](urlRequest, { body, headers: { authorization } })
    res.send({ user, pass, method, urlRequest })
  } catch (e) {
    console.error(e)
    throw e
  }
}
