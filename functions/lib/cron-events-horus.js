const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const getAppData = require('./store-api/get-app-data')
const {
  collectionHorusEvents,
  topicProductsHorus
  // topicCustomerHorus
} = require('./utils-variables')
const { parseDate } = require('./parsers/parse-to-ecom')
const Horus = require('./horus/client')
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

const productsEvents = async (appData, storeId) => {
  const { username, password, baseURL } = appData
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

  console.log('>>Cron s:', storeId, ' ', dateInit, ' ', dateEnd, ' <')
  const promisesSendTopics = []
  while (reply) {
    // create Object Horus to request api Horus
    const endpoint = `/Busca_Acervo${query}&offset=${offset}&limit=${limit}`
    // console.log('>> ', reply, ' ', endpoint)
    const products = await horus.get(endpoint)
      .then((resp) => {
        console.log('>> Resp ', JSON.stringify(resp))
        const { data } = resp
        if (resp && data.length && !data[0].Mensagem) {
          console.log('>> Return data ')
          return data
        }
        console.log('>> Return null ')
        return null
      })
      .catch((err) => {
        console.error(err)
        return null
      })

    console.log('>> Offset ', offset, ' data exists ', products !== null)
    if (products && Array.isArray(products)) {
      products.forEach((productHorus, index) => {
        // console.log('> ', index, ' ', JSON.stringify(productHorus))
        promisesSendTopics.push(
          sendMessageTopic(topicProductsHorus, { storeId, productHorus })
            .catch(console.error)
        )
      })
    } else {
      reply = false
    }

    offset += limit
  }

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
          productsEvents(appData, storeId)
          // if (now.getMinutes() % 5 === 0) {
          //   customerEvents(appData, storeId)
          // }
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
