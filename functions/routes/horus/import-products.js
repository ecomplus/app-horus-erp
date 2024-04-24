const axios = require('axios')
const { firestore } = require('firebase-admin')
const getAppData = require('../../lib/store-api/get-app-data')
// const { baseUri } = require('./../../__env')
const {
  topicResourceToEcom
  // collectionHorusEvents
} = require('../../lib/utils-variables')
const Horus = require('../../lib/horus/client')
const requestHorus = require('../../lib/horus/request')
// const { sendMessageTopic } = require('../../lib/pub-sub/utils')
// const { parseDate } = require('../../lib/parsers/parse-to-horus')

const requestStoreApi = axios.create({
  baseURL: 'https://api.e-com.plus/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

let total = 0

const saveFirestore = (idDoc, body) => firestore()
  .doc(idDoc)
  .set(body, { merge: true })
  // .then(() => { console.log('Save in firestore') })
  .catch(console.error)

const getAndSendProdcutToQueue = async (horus, codItem, storeId, opts) => {
  const endpoint = `/Busca_Acervo?COD_ITEM=${codItem}&offset=0&limit=1`
  const item = await requestHorus(horus, endpoint, 'get')
    .catch((err) => {
      if (err.response) {
        console.warn(JSON.stringify(err.response?.data))
      } else {
        console.error(err)
      }
      return null
    })

  if (item && item.length) {
    const json = {
      storeId,
      resource: 'products',
      objectHorus: item && item.length && item[0],
      opts
    }
    const collectionName = 'queuePubSub'
    const id = json?.objectHorus?.COD_ITEM || Date.now()
    return saveFirestore(
      `${collectionName}/product-${id}`,
      { eventName: topicResourceToEcom, json }
    )
  }
  return null
}

const checkProducts = async (horus, storeId, opts) => {
  let hasRepeat = true
  let offset = opts.setOffset ? parseInt(opts.setOffset, 10) : 0
  delete opts.setOffset
  const limit = 50

  const init = Date.now()
  const promisesSendTopics = []
  const codCaract = 5 // TODO: opts.appData.code_characteristic
  const codTpoCaract = 3 // TODO: opts.appData.code_type_characteristic

  // TODO: appData.hashas_import_feature
  let baseEndpoint = ''
  // TODO: baseEndpointt = `/Busca_Acervo${query}offset=${offset}&limit=${limit}`
  baseEndpoint = `/Busca_Caracteristicas?COD_TPO_CARACT=${codTpoCaract}` +
  `&COD_CARACT=${codCaract}`
  let setOffset

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
      total += items.length
      items.forEach((productHorus, index) => {
        promisesSendTopics.push(productHorus.COD_ITEM
          // getAndSendProdcutToQueue(horus, productHorus.COD_ITEM, storeId, opts)
        )
      })
      const now = Date.now()
      const time = now - init
      if (time >= 20000) {
        hasRepeat = false
        setOffset = offset
      }
    } else {
      hasRepeat = false
    }

    offset += limit
  }

  console.log('>> ', JSON.stringify(promisesSendTopics), ' > ', promisesSendTopics.length)
  console.log(`>> import all #${storeId}  try imports ${total} items`)
  return { setOffset }
  // return Promise.all(promisesSendTopics)
  //   .then(() => ({ setOffset }))
}

exports.post = async ({ appSdk }, req, res) => {
  const { headers: reqHeaders, query } = req
  const url = '/authentications/me.json'
  const headers = {
    'x-store-id': reqHeaders['x-store-id'],
    'x-my-id': reqHeaders['x-my-id'],
    'x-access-token': reqHeaders['x-access-token']
  }
  const { setOffset } = query

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
      const opts = { appData, isUpdateDate: false, setOffset }

      return checkProducts(horus, storeId, opts)
        .then(async ({ setOffset }) => {
          // if (setOffset) {
          //   console.log('>> setOffset: ', setOffset)
          //   await axios.post(`${baseUri}/horus/import-products?setOffset=${setOffset}`, undefined, { headers })
          //     .catch(console.error)
          // }
          return storeId
        })
    })
    // .then((storeId) => {
    //   const docId = `${collectionHorusEvents}/${storeId}_products`
    //   const lastUpdateProducts = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // UTC-3
    //   const body = { lastUpdateProducts }
    //   return saveFirestore(docId, body)
    // })
    .then((res) => {
      console.log('>> Finish send import Products', res)
      res.status(201)
        .send('Importing Products')
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
