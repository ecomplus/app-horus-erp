const axios = require('axios')
const updateAppData = require('../../lib/store-api/update-app-data')
const getAppData = require('../../lib/store-api/get-app-data')
const Horus = require('../../lib/horus/client')
// const requestHorus = require('../../lib/horus/request')
const { getAllItemsHorusToImport } = require('../../lib/integration/imports/utils')

const requestStoreApi = axios.create({
  baseURL: 'https://api.e-com.plus/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

exports.post = async ({ appSdk }, req, res) => {
  const { headers: reqHeaders } = req
  const url = '/authentications/me.json'
  const headers = {
    'x-store-id': reqHeaders['x-store-id'],
    'x-my-id': reqHeaders['x-my-id'],
    'x-access-token': reqHeaders['x-access-token']
  }

  requestStoreApi.get(url, { headers })
    .then(({ data }) => data)

    .then(async (data) => {
      const storeId = data.store_id
      const auth = await appSdk.getAuth(storeId)
      const appData = await getAppData({ appSdk, storeId, auth }, true)

      const {
        username,
        password,
        baseURL
      } = appData

      const horus = new Horus(username, password, baseURL)
      const opts = { appData, isUpdateDate: false }

      return getAllItemsHorusToImport(horus, storeId, opts)
        .then(async (products) => {
          if (products.length) {
            console.log(`> #${storeId} all ${products.length} COD_ITEM: ${JSON.stringify(products)}`)
            return updateAppData({ appSdk, storeId }, {
              importation: { products }
            })
              .then(() => products)
          } else {
            return null
          }
        })
    })
    .then((products) => {
      res.status(201)
        .send({
          message: 'Importing Products',
          products
        })
    })
    .catch(err => {
      let message = err.name
      let status = 400
      if (err.response) {
        status = err.response.status || status
        message = err.response.statusText || message
        console.error(err.response)
      } else {
        console.error(err)
      }

      res.status(status).send({
        statusCode: status,
        message
      })
    })
}
