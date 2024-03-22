const { firestore } = require('firebase-admin')
const getAppData = require('./store-api/get-app-data')
const {
  collectionHorusEvents
} = require('../../lib/utils-variables')
const { parseDate } = require('../../lib/parsers/parse-to-ecom')
const Horus = require('../../lib/horus/client')

const requestGetHorus = (horus, endpoint, isRetry) => new Promise((resolve, reject) => {
  horus.get(endpoint)
    .then((resp) => {
      const { data } = resp
      if (data && data.length && !data[0].Mensagem) {
        resolve(data)
      }
      resolve(null)
    })
    .catch((err) => {
      if (!isRetry) {
        setTimeout(() => requestGetHorus(horus, endpoint, true), 1000)
      }
      reject(err)
    })
})

const productsEvents = async (appData, storeId) => {
  const {
    username,
    password,
    baseURL
    // update_product: updateProduct,
    // update_price: updatePrice
  } = appData
  const horus = new Horus(username, password, baseURL)
  let dateInit = parseDate(new Date(1), true)
  const dateEnd = parseDate(new Date(), true)
  const docRef = firestore()
    .doc(`${collectionHorusEvents}/${storeId}_products`)

  const docSnapshot = await docRef.get()
  if (docSnapshot.exists) {
    const { lastUpdateProduct } = docSnapshot.data()
    dateInit = parseDate(new Date(lastUpdateProduct), true)
  }

  const query = `?DATA_INI=${dateInit}&DATA_FIM=${dateEnd}`

  let reply = true
  let offset = 0
  const limit = 100

  console.log('>>Cron s:', storeId, ' ', query, ' <')
  // const promisesSendTopics = []
  while (reply) {
    // create Object Horus to request api Horus
    const endpoint = `/Busca_Acervo${query}&offset=${offset}&limit=${limit}`
    console.time(endpoint)
    const products = await requestGetHorus(horus, endpoint)
      .catch((err) => {
        if (err.response) {
          console.warn(JSON.stringify(err.response))
        } else {
          console.error(err)
        }
        return null
      })

    console.timeEnd(endpoint)
    if (products && Array.isArray(products)) {
      products.forEach((productHorus, index) => {
        console.log('>> ', JSON.stringify(productHorus))
      })
    } else {
      reply = false
    }

    offset += limit
  }

  return null
}

exports.get = async ({ appSdk }, req, res) => {
  const storeId = 1173
  appSdk.getAuth(storeId)
    .then((auth) => {
      return getAppData({ appSdk, storeId, auth })
        .then(appData => {
          productsEvents(appData, storeId)
          res.send('OK')
        })
    })
}
