const axios = require('axios')

exports.get = async ({ appSdk }, req, res) => {
  try {
    const { data } = await axios.get('https://ipecho.net/plain')
    res.send(data)
  } catch (e) {
    console.error(e)
    throw e
  }
}
