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
  console.log('>> ', JSON.stringify(headers))
  requestStoreApi.get(url, {}, { headers })
    .then(() => {
      res.send('ok')
    })
    .catch(err => {
      let message = err.name
      let status = 400
      if (err.response) {
        status = err.response.status || status
        message = err.response.data ? JSON.stringify(err.response.data) : message
        console.warn(JSON.stringify(err.response))
      } else {
        console.error(err)
      }

      res.status(status).send({
        statusCode: status,
        message
      })
    })
}
