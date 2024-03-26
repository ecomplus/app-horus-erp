const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const getAppData = require('./store-api/get-app-data')
const {
  collectionHorusEvents,
  topicResourceToEcom
  // topicProductsHorus
  // topicCustomerHorus
} = require('./utils-variables')
const { parseDate } = require('./parsers/parse-to-ecom')
const Horus = require('./horus/client')
const requestHorus = require('./horus/request')
const { sendMessageTopic } = require('./pub-sub/utils')

const listStoreIds = async () => {
  const storeIds = []
  const date = new Date()
  date.setHours(date.getHours() - 51) // 48 hours + 3 hours (cron update token)

  // console.log('>> ', date.toISOString(), ' <<')
  const querySnapshot = await firestore()
    .collection('ecomplus_app_auth')
    .where('updated_at', '>', firestore.Timestamp.fromDate(date))
    .get()

  querySnapshot?.forEach(documentSnapshot => {
    const storeId = documentSnapshot.get('store_id')
    if (storeIds.indexOf(storeId) === -1) {
      storeIds.push(storeId)
    }
  })

  return storeIds
}

const productsEvents = async (horus, storeId, opts) => {
  const resource = 'products'
  const field = 'lastUpdate' + resource.charAt(0).toUpperCase() + resource.substring(1)
  let dateInit = parseDate(new Date(1), true)
  const dateEnd = parseDate(new Date(), true)
  const docRef = firestore()
    .doc(`${collectionHorusEvents}/${storeId}_${resource}`)

  // console.log('>> ', resource, ' => ', field)
  const docSnapshot = await docRef.get()
  if (docSnapshot.exists) {
    const lastUpdateResource = docSnapshot.data()[field]
    dateInit = parseDate(new Date(lastUpdateResource), true)
  }

  const query = `?DATA_INI=${dateInit}&DATA_FIM=${dateEnd}`

  let hasRepeat = true
  let offset = 0
  const limit = 100

  let total = 0
  console.log('>>Cron s:', storeId, ' ', query, ' <')
  const promisesSendTopics = []
  while (hasRepeat) {
    // create Object Horus to request api Horus
    const endpoint = `/Busca_Acervo${query}&offset=${offset}&limit=${limit}`
    const products = await requestHorus(horus, endpoint, 'get')
      .catch((err) => {
        if (err.response) {
          console.warn(JSON.stringify(err.response))
        } else {
          console.error(err)
        }
        return null
      })

    if (products && Array.isArray(products)) {
      total += products.length
      products.forEach((productHorus, index) => {
        promisesSendTopics.push(
          sendMessageTopic(
            topicResourceToEcom,
            {
              storeId,
              resource,
              objectHorus: productHorus,
              opts
            })
            .catch(console.error)
        )
      })
    } else {
      hasRepeat = false
    }

    offset += limit
  }
  console.log('Total imports ', total)

  return Promise.all(promisesSendTopics)
    .then(() => {
      console.log('Finish Exec ', storeId)
    })
}

/*
const customerEvents = async (appData, storeId) => {
  const { username, password, baseURL } = appData
  const horus = new Horus(username, password, baseURL)
  let dateInit = parseDate(new Date(1), true)
  const dateEnd = parseDate(new Date(), true)
  const docRef = firestore()
    .doc(`${collectionHorusEvents}/${storeId}/customers`)

  const docSnapshot = await docRef.get()
  if (docSnapshot.exists) {
    const { lastUpdateCustomer } = docSnapshot.data()
    dateInit = parseDate(new Date(lastUpdateCustomer), true)
  }

  const query = `?DATA_INI=${dateInit}&DATA_FIM=${dateEnd}`
  console.log('>> Query ', query)
  const { data: listCustomers } = await horus.get(`/Busca_Cliente${query}`)
  listCustomers.forEach((customersHorus) => {
    sendMessageTopic(topicCustomerHorus, { storeId, customersHorus })
  })
}
*/

// Autores_item?COD_ITEM=1

module.exports = context => setup(null, true, firestore())
  .then(async (appSdk) => {
    const storeIds = await listStoreIds()
    const promises = []
    const now = new Date()
    const runEvent = async (storeId) => {
      console.log(`>> Run #${storeId} in ${now.toISOString()}`)
      await appSdk.getAuth(storeId)
        .then((auth) => {
          return getAppData({ appSdk, storeId, auth }, true)
        })
        .then((appData) => {
          const {
            username,
            password,
            baseURL
            // update_product: updateProduct,
            // update_price: updatePrice
          } = appData
          const horus = new Horus(username, password, baseURL)
          const opts = { appData }
          productsEvents(horus, storeId, opts)
          // if (now.getMinutes() % 5 === 0) {
          //   customerEvents(appData, storeId)
          // }
          return null
        })
    }
    console.log('>>Check Events ', storeIds.length, ' <')
    storeIds?.forEach(async (storeId) => {
      promises.push(runEvent(storeId))
    })

    return Promise.all(promises)
      .then(() => {
        console.log('> Finish Check Events stores')
      })
  })
  .catch(console.error)
