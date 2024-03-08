const axios = require('axios')

exports.get = async ({ appSdk }, req, res) => {
  const url = 'https://webhook.site/08e6678c-cec8-4dde-a48d-6d1c0e61ae38'
  const resp = await axios.get(url)
  res.send(resp)
}

exports.post = ({ appSdk }, req, res) => {
  console.log(req)
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  res.send({ ip })
}
