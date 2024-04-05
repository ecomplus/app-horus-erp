const axios = require('axios')
// const getAppData = require('../../lib/store-api/get-app-data')
// const {
//   collectionHorusEvents,
//   topicResourceToEcom
// } = require('./utils-variables')
// const { parseDate } = require('./parsers/parse-to-horus')
// const Horus = require('./horus/client')
// const requestHorus = require('./horus/request')
// const { sendMessageTopic } = require('./pub-sub/utils')

const requestStoreApi = axios.create({
  baseURL: 'https://api.e-com.plus/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

// let hasRepeat = true
// let offset = 0
// const limit = 100

// let total = 0
// const promisesSendTopics = []
// while (hasRepeat) {
//   // create Object Horus to request api Horus
//   const endpoint = `/Busca_Acervo${query}&offset=${offset}&limit=${limit}`
//   const products = await requestHorus(horus, endpoint, 'get')
//     .catch((err) => {
//       if (err.response) {
//         console.warn(JSON.stringify(err.response))
//       } else {
//         console.error(err)
//       }
//       return null
//     })

//   if (products && Array.isArray(products)) {
//     total += products.length
//     products.forEach((productHorus, index) => {
//       promisesSendTopics.push(
//         sendMessageTopic(
//           topicResourceToEcom,
//           {
//             storeId,
//             resource,
//             objectHorus: productHorus,
//             opts
//           })
//       )
//     })
//   } else {
//     hasRepeat = false
//   }

//   offset += limit
// }

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
        // message = err.response.data ? JSON.stringify(err.response.data) : message
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
