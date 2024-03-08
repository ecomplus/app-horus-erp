const axios = require('axios')

exports.get = async ({ appSdk }, req, res) => {
  const url = 'https://us-central1-horus-book-erp.cloudfunctions.net/app/horus/test'
  const resp = await axios.post(url)
  res.send(resp)
}

exports.post = ({ appSdk }, req, res) => {
  console.log(req)
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  res.send({ ip })
}
