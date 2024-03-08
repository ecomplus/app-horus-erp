// const axios = require('axios')

exports.post = async ({ appSdk }, req, res) => {
  const { method, params, url } = req
  try {
    res.send({ method, params, url })
  } catch (e) {
    console.error(e)
    throw e
  }
}
