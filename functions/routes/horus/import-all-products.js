const axios = require('axios')
const requestStoreApi = axios.create({
  baseURL: 'https://api.e-com.plus/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

exports.post = async ({ appSdk }, req, res) => {
  const headers = req.headers
  const url = '/authentications/me.json'
}
