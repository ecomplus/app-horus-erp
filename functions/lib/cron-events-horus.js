const { firestore } = require('firebase-admin')
const getAppData = require('./store-api/get-app-data')
const updateAppData = require('./store-api/update-app-data')

const Horus = require('./horus/client')
const checkHorusApi = require('./horus/check-horus-api')
const { getAllItemsHorusToImport } = require('../lib/integration/imports/utils')
const ecomClient = require('@ecomplus/client')
const {
  productsStocksEvents,
  productsPriceEvents
  // productsEvents
} = require('./events/product-events')

const listStoreIds = async () => {
  const storeIds = []
  const date = new Date()
  date.setHours(date.getHours() - 48)

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

const checkProductsImports = async ({ appSdk, storeId }, horus, opts) => {
  console.log(`Exec Check New PRODUCT in #${storeId}`)
  const codigoItems = await getAllItemsHorusToImport(horus, storeId, opts)
  console.log('> Codes ERP: ', codigoItems.length)
  const newProducts = await ecomClient.search({
    storeId,
    url: '/items.json',
    data: {
      size: codigoItems.length + 50 // 50 for products heven't ERP
    }
  }).then(({ data }) => {
    const { hits: { hits } } = data
    console.log('>> Skus: ', hits.length)
    const skus = hits?.reduce((acc, current) => {
      const { _source } = current
      if (_source.sku.startsWith('COD_ITEM')) {
        acc.push(Number(_source.sku.replace('COD_ITEM', '')))
      }
      return acc
    }, [])
    return codigoItems.filter(codigo => !skus.includes(codigo))
  })
    .catch(() => [])

  const productsQueue = opts?.appData?.importation.products || []
  const products = productsQueue.reduce((acc, current) => {
    if (!acc.includes(current)) {
      acc.push(current)
    }
    return acc
  }, newProducts || [])
    ?.sort()

  return updateAppData({ appSdk, storeId }, {
    importation: { products }
  }).then(() => {
    console.log(`Finish Exec Check New PRODUCT in #${storeId} add queue ${products.length}`)
  })
}

module.exports = async (appSdk) => {
  const storeIds = await listStoreIds()
  const promises = []
  const now = new Date()
  const runEvent = async (storeId) => {
    console.log(`>> Run #${storeId} in ${now.toISOString()}`)
    await appSdk.getAuth(storeId)
      .then((auth) => {
        return getAppData({ appSdk, storeId, auth }, true)
      })
      .then(async (appData) => {
        const {
          username,
          password,
          baseURL
        } = appData
        const horus = new Horus(username, password, baseURL)
        const opts = { appData }
        const isHorusApiOk = await checkHorusApi(horus)
        const promises = []
        console.log('>> Horus API', isHorusApiOk ? 'OK' : 'OffLine')
        if (isHorusApiOk) {
          promises.push(productsStocksEvents(horus, storeId, opts))
          // promises.push(productsEvents({ appSdk, storeId }, horus, appData))

          // check in the function
          promises.push(productsPriceEvents(horus, storeId, opts))

          const now = new Date()
          if (now.getMinutes() % 30 === 0) {
            // new Product
            // run at 30 in 30min
            promises.push(checkProductsImports({ appSdk, storeId }, horus, opts))
          }
        }

        return Promise.all(promises)
      })
      .then(() => {
        console.log(`Finish Exec #${storeId}`)
      })
  }
  console.log('>>Check Events ', storeIds.length, ' <')
  storeIds?.forEach(async (storeId) => {
    promises.push(runEvent(storeId))
  })

  return Promise.all(promises)
    .then(() => {
      console.log('> Finish Check Events All Stores')
    })
    .catch(console.error)
}
