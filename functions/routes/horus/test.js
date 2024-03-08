const axios = require('axios')

exports.get = async ({ appSdk }, req, res) => {
  try {
    const url = 'curlmyip.org'
    const { data } = await axios.get(url)
    res.send(data)
  } catch (e) {
    console.error(e)
    throw e
  }
}
