const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const getAppData = require('./store-api/get-app-data')
const { collectionUpdateProdcts, topicUpdateProducts } = require('./utils-variables')
const parseDate = require('./parsers/date')
const Horus = require('./horus/client')
const { sendMessageTopic } = require('./pub-sub/utils')

const listStoreIds = async () => {
  const storeIds = []
  const date = new Date()
  date.setHours(date.getHours() - 24)

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

const productsUpdateEvents = async (appData, storeId) => {
  const { username, password, baseURL } = appData
  const horus = new Horus(username, password, baseURL)
  let dateInit = parseDate(new Date(1), true)
  const dateEnd = parseDate(new Date(), true)
  const docRef = firestore()
    .doc(`${collectionUpdateProdcts}/${storeId}`)

  const docSnapshot = await docRef.get()
  if (docSnapshot.exists) {
    const { lastUpdateProduct } = docSnapshot.data()
    dateInit = parseDate(new Date(lastUpdateProduct), true)
  }

  const query = `?DATA_INI=${dateInit}&DATA_FIM=${dateEnd}`
  console.log('>> Query ', query)
  const { data: listProducts } = await horus.get(`/Busca_Acervo${query}`)
  listProducts.forEach((productHorus) => {
    sendMessageTopic(topicUpdateProducts, { storeId, productHorus })
  })
}

module.exports = context => setup(null, true, firestore())
  .then(async (appSdk) => {
    const storeIds = await listStoreIds()
    const promises = []
    const runEvent = async (storeId) => {
      await appSdk.getAuth(storeId)
        .then((auth) => {
          return getAppData({ appSdk, storeId, auth }, true)
        })
        .then((appData) => {
          productsUpdateEvents(appData, storeId)
        })
    }
    console.log('>>Check Events ', storeIds.length, ' <')
    storeIds?.forEach(async (storeId) => {
      promises.push(runEvent(storeId))
    })

    return Promise.all(promises)
  })
  .catch(console.error)
