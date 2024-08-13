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
  date.setHours(date.getHours() - 48)

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

const productsStocksEvents = async (horus, storeId, opts) => {
  const resourcePrefix = 'products_stocks'
  let dateInit = new Date(releaseDate)
  let dateEnd = new Date()

  let offset = 0
  const limit = 50

  const docRef = firestore()
    .doc(`${collectionHorusEvents}/${storeId}_${resourcePrefix}`)

  const docSnapshot = await docRef.get()
  if (docSnapshot.exists) {
    const data = docSnapshot.data()
    const dateInitDoc = data?.dateInit
    const dateEndtDoc = data?.dateEnd
    const offsetDoc = data?.offset
    const hasRepeatDoc = data?.hasRepeat

    if (hasRepeatDoc) {
      dateInit = dateInitDoc ? new Date(dateInitDoc) : dateInit
      dateEnd = dateEndtDoc ? new Date(dateEndtDoc) : dateEnd
      offset = offsetDoc || 0
    } else {
      dateInit = dateEndtDoc ? new Date(dateEndtDoc) : dateEnd
    }
  }
  const companyCode = opts.appData?.company_code || 1
  const subsidiaryCode = opts.appData?.subsidiary_code || 1
  let stockCode = opts.appData?.stock_code
  if (storeId === 51504) {
    stockCode = stockCode || 20
  }

  const codCaract = opts?.appData?.code_characteristic || 5
  const codTpoCaract = opts?.appData?.code_type_characteristic || 3

  console.log(`>> Check STOCKS ${parseDate(dateInit, true)} at ${parseDate(dateEnd, true)} offset ${offset}`)
  const query = `?DATA_INI=${parseDate(dateInit, true)}&DATA_FIM=${parseDate(dateEnd, true)}` +
    `&COD_TPO_CARACT=${codTpoCaract}&COD_CARACT=${codCaract}` +
    `&COD_EMPRESA=${companyCode}&COD_FILIAL=${subsidiaryCode}` +
    `&TIPO_SALDO=V${stockCode ? `&COD_LOCAL_ESTOQUE=${stockCode}` : ''}`

  console.log(' Query: ', query)

  let hasRepeat = true

  let total = 0
  // const init = Date.now()
  const promisesSendTopics = []
  // while (hasRepeat) {
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

  hasRepeat = products?.length === limit

  if (products?.length) {
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
  }

  offset = hasRepeat ? offset + limit : 0
  // }
  console.log(`>>Cron STOCKS #${storeId} Updates: ${total} Repeat ${hasRepeat}`)

  return Promise.all(promisesSendTopics)
    .then(async () => {
      await docRef.set({
        dateInit: dateInit.toISOString(),
        dateEnd: dateEnd.toISOString(),
        offset,
        hasRepeat,
        updated_at: new Date().toISOString()
      }, { merge: true })
        .catch(console.error)
      console.log(`Finish Exec STOCKS in #${storeId}`)
    })
}

const productsPriceEvents = async (horus, storeId, opts) => {
  const resourcePrefix = 'products_price'
  let dateInit = new Date(releaseDate)
  let dateEnd = new Date()

  let offset = 0
  const limit = 50

  const docRef = firestore()
    .doc(`${collectionHorusEvents}/${storeId}_${resourcePrefix}`)

  // console.log('>> ', resource, ' => ', field)
  const docSnapshot = await docRef.get()
  let isExec = true
  if (docSnapshot.exists) {
    const data = docSnapshot.data()
    const dateInitDoc = data?.dateInit
    const dateEndtDoc = data?.dateEnd
    const offsetDoc = data?.offset
    const hasRepeatDoc = data?.hasRepeat
    const updatedAtDoc = data?.updated_at && new Date(data?.updated_at)
    const now = new Date()

    isExec = Boolean(hasRepeatDoc || (now.getTime() >= (updatedAtDoc.getTime() + (5 * 60 * 1000))))
    if (hasRepeatDoc) {
      dateInit = dateInitDoc ? new Date(dateInitDoc) : dateInit
      dateEnd = dateEndtDoc ? new Date(dateEndtDoc) : dateEnd
      offset = offsetDoc || 0
    } else {
      dateInit = dateEndtDoc ? new Date(dateEndtDoc) : dateEnd
    }

    console.log(`isExec: ${isExec} upDoc: ${updatedAtDoc.toISOString()} now ${now.toISOString()}`)
  }

  if (isExec) {
    const codCaract = opts?.appData?.code_characteristic || 5
    const codTpoCaract = opts?.appData?.code_type_characteristic || 3

    console.log(`>> Check PRICE ${parseDate(dateInit, true)} at ${parseDate(dateEnd, true)}`)
    const query = `?DATA_INI=${parseDate(dateInit, true)}&DATA_FIM=${parseDate(dateEnd, true)}` +
      `&COD_TPO_CARACT=${codTpoCaract}&COD_CARACT=${codCaract}`

    let hasRepeat = true

    let total = 0
    const promisesSendTopics = []
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

    hasRepeat = products?.length === limit

    if (products?.length) {
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
    }

    offset = hasRepeat ? offset + limit : 0
    console.log(`>>Cron PRICE #${storeId} Updates: ${total} Repeat ${hasRepeat}`)

    return Promise.all(promisesSendTopics)
      .then(async () => {
        await docRef.set({
          dateInit: dateInit.toISOString(),
          dateEnd: dateEnd.toISOString(),
          offset,
          hasRepeat,
          updated_at: new Date().toISOString()
        }, { merge: true })
          .catch(console.error)
        console.log(`Finish Exec PRICE in #${storeId}`)
      })
  }
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
          const now = new Date()
          console.log(`horas : ${now.getHours() - 3}`)
          if ((now.getHours() - 3) === 12 && now.getMinutes() % 5 === 0) {
          // if (now.getMinutes() % 10 === 0) {
            // run at 3 am (UTC -3) everyday
            promises.push(productsPriceEvents(horus, storeId, opts))
          }

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
