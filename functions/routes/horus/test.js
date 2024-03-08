const axios = require('axios')

exports.get = async ({ appSdk }, req, res) => {
  const url = 'https://us-central1-test-app-ghanor.cloudfunctions.net/app/test'
  const { data } = await axios.get(url)
  res.send(data)
}
