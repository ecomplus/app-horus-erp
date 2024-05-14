const axios = require('axios')
const updateAppData = require('../../lib/store-api/update-app-data')
const getAppData = require('../../lib/store-api/get-app-data')
const Horus = require('../../lib/horus/client')
const requestHorus = require('../../lib/horus/request')

const requestStoreApi = axios.create({
  baseURL: 'https://api.e-com.plus/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

const getAllItemsHorus = async (horus, storeId, opts) => {
  let hasRepeat = true
  let offset = 0
  const limit = 50

  const init = Date.now()
  const listItemsToImport = []
  const codCaract = opts?.appData?.code_characteristic || 5
  const codTpoCaract = opts?.appData?.code_type_characteristic || 3

  let baseEndpoint = ''
  baseEndpoint = `/Busca_Caracteristicas?COD_TPO_CARACT=${codTpoCaract}` +
  `&COD_CARACT=${codCaract}`

  while (hasRepeat) {
    // create Object Horus to request api Horus
    const endpoint = `${baseEndpoint}&offset=${offset}&limit=${limit}`
    const items = await requestHorus(horus, endpoint, 'get', true)
      .catch((_err) => {
        // if (err.response) {
        //   console.warn(JSON.stringify(err.response?.data))
        // } else {
        //   console.error(err)
        // }
        return null
      })

    if (items && Array.isArray(items)) {
      // total += items.length
      items.forEach((productHorus, index) => {
        listItemsToImport.push(productHorus.COD_ITEM)
      })
      const now = Date.now()
      const time = now - init
      if (time >= 20000) {
        hasRepeat = false
      }
    } else {
      hasRepeat = false
    }

    offset += limit
  }

  return listItemsToImport
}

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

      return getAllItemsHorus(horus, storeId, opts)
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
