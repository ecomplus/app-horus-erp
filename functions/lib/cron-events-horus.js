const { firestore } = require('firebase-admin')
// const { setup } = require('@ecomplus/application-sdk')
const getAppData = require('./store-api/get-app-data')
const updateAppData = require('./store-api/update-app-data')
const {
  collectionHorusEvents,
  topicResourceToEcom
} = require('./utils-variables')
const { parseDate } = require('./parsers/parse-to-horus')
const Horus = require('./horus/client')
const requestHorus = require('./horus/request')
const checkHorusApi = require('./horus/check-horus-api')
const { sendMessageTopic } = require('./pub-sub/utils')
const { getAllItemsHorusToImport } = require('../lib/integration/imports/utils')
const ecomClient = require('@ecomplus/client')
const releaseDate = '2024-04-01T00:00:00.000Z'

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

const checkProductsImports = async ({ appSdk, storeId }, horus, opts) => {
  console.log(`Exec Check New PRODUCT in #${storeId}`)
  const codigoItems = await getAllItemsHorusToImport(horus, storeId, opts)
  console.log('> Codes ERP: ', codigoItems.length)
  const newProducts = await ecomClient.search({
    storeId,
    url: '/items.json',
    data: {
      size: codigoItems.length + 10
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
  const products = productsQueue.concat(newProducts || [])

  return updateAppData({ appSdk, storeId }, {
    importation: { products }
  }).then(() => {
    console.log(`Finish Exec Check New PRODUCT in #${storeId}`)
  })
}

const productsStocksEvents = async (horus, storeId, opts) => {
  const resource = 'products'
  const field = 'lastUpdate' + resource.charAt(0).toUpperCase() + resource.substring(1)
  let dateInit = parseDate(new Date(releaseDate), true)
  const dateEnd = parseDate(new Date(), true)
  const resourcePrefix = `${resource}_stocks`
  const docRef = firestore()
    .doc(`${collectionHorusEvents}/${storeId}_${resourcePrefix}`)

  const docSnapshot = await docRef.get()
  if (docSnapshot.exists) {
    const data = docSnapshot.data()
    const lastUpdateResource = data[field]
    // console.log('>> ', resource, ' ', resourcePrefix, ' => ', field, ' ', lastUpdateResource)
    // console.log('>> data ', data && JSON.stringify(data))
    dateInit = parseDate(new Date(lastUpdateResource), true)
  }
  const companyCode = opts.appData.company_code || 1
  const subsidiaryCode = opts.appData.subsidiary_code || 1

  const codCaract = opts?.appData?.code_characteristic || 5
  const codTpoCaract = opts?.appData?.code_type_characteristic || 3

  console.log(`>> Check STOCKS ${dateInit} at ${dateEnd}`)
  const query = `?DATA_INI=${dateInit}&DATA_FIM=${dateEnd}` +
    `&COD_TPO_CARACT=${codTpoCaract}&COD_CARACT=${codCaract}` +
    `&COD_EMPRESA=${companyCode}&COD_FILIAL=${subsidiaryCode}` +
    '&TIPO_SALDO=V'

  let hasRepeat = true
  let offset = 0
  const limit = 50

  let total = 0
  // const init = Date.now()
  const promisesSendTopics = []
  while (hasRepeat) {
    // create Object Horus to request api Horus
    const endpoint = `/Estoque${query}&offset=${offset}&limit=${limit}`
    const products = await requestHorus(horus, endpoint, 'get', true)
      .catch((_err) => {
        // if (_err.response) {
        //   console.warn(JSON.stringify(_err.response))
        // } else {
        //   console.error(_err)
        // }
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
              resource: resourcePrefix,
              objectHorus: productHorus,
              opts
            })
        )
      })
      // const now = Date.now()
      // const time = now - init
      // if (time >= 50000) {
      //   hasRepeat = false
      // }
    } else {
      hasRepeat = false
    }

    offset += limit
  }
  console.log(`>>Cron STOCKS #${storeId} Updates: ${total}`)

  return Promise.all(promisesSendTopics)
    .then(() => {
      console.log(`Finish Exec STOCKS in #${storeId}`)
    })
}

const productsPriceEvents = async (horus, storeId, opts) => {
  const resource = 'products'
  const field = 'lastUpdate' + resource.charAt(0).toUpperCase() + resource.substring(1)
  let dateInit = parseDate(new Date(releaseDate), true)
  const dateEnd = parseDate(new Date(), true)
  const resourcePrefix = `${resource}_price`
  const docRef = firestore()
    .doc(`${collectionHorusEvents}/${storeId}_${resourcePrefix}`)

  // console.log('>> ', resource, ' => ', field)
  const docSnapshot = await docRef.get()
  if (docSnapshot.exists) {
    const data = docSnapshot.data()
    const lastUpdateResource = data[field]
    // console.log('>> ', resource, ' ', resourcePrefix, ' => ', field, ' ', lastUpdateResource)
    // console.log('>> data ', data && JSON.stringify(data))
    dateInit = parseDate(new Date(lastUpdateResource), true)
  }
  const codCaract = opts?.appData?.code_characteristic || 5
  const codTpoCaract = opts?.appData?.code_type_characteristic || 3

  console.log(`>> Check PRICE ${dateInit} at ${dateEnd}`)
  const query = `?DATA_INI=${dateInit}&DATA_FIM=${dateEnd}` +
    `&COD_TPO_CARACT=${codTpoCaract}&COD_CARACT=${codCaract}`

  let hasRepeat = true
  let offset = 0
  const limit = 50

  let total = 0
  // const init = Date.now()
  const promisesSendTopics = []
  while (hasRepeat) {
    // create Object Horus to request api Horus
    const endpoint = `/Busca_preco_item${query}&offset=${offset}&limit=${limit}`
    const products = await requestHorus(horus, endpoint, 'get', true)
      .catch((_err) => {
        // if (_err.response) {
        //   console.warn(JSON.stringify(_err.response))
        // } else {
        //   console.error(_err)
        // }
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
              resource: resourcePrefix,
              objectHorus: productHorus,
              opts
            })
        )
      })
      // const now = Date.now()
      // const time = now - init
      // if (time >= 50000) {
      //   hasRepeat = false
      // }
    } else {
      hasRepeat = false
    }

    offset += limit
  }
  console.log(`>>Cron PRICE #${storeId} Updates: ${total}`)

  return Promise.all(promisesSendTopics)
    .then(() => {
      console.log(`Finish Exec PRICE in #${storeId}`)
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
        console.log('>> Horus API ok: ', isHorusApiOk)
        if (isHorusApiOk) {
          promises.push(productsStocksEvents(horus, storeId, opts))
          const now = new Date()

          if ((now.getHours() - 6) % 24 === 0 && now.getMinutes() === 3) {
            // run at 3 am (UTC -3) everyday
            promises.push(productsPriceEvents(horus, storeId, opts))
          }

          if (now.getMinutes() % 30 === 0) {
            // run at 30 in 30min
            promises.push(checkProductsImports({ appSdk, storeId }, horus, opts))
          }
        } else {
          console.log('> Horus API Offline')
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
