// const axios = require('axios')

exports.all = async ({ appSdk }, req, res) => {
  const { method, proxy } = req
  try {
    res.send({ method, proxy })
  } catch (e) {
    console.error(e)
    throw e
  }
}
