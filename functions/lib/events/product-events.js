const { firestore } = require('firebase-admin')
const {
  collectionHorusEvents,
  topicResourceToEcom
} = require('../utils-variables')
const requestHorus = require('../horus/request')
const { parseDate } = require('../parsers/parse-to-horus')
const { sendMessageTopic } = require('../pub-sub/utils')
const releaseDate = '2024-04-01T00:00:00.000Z'

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

  const promisesSendTopics = []

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

    if (hasRepeatDoc || updatedAtDoc) {
      isExec = Boolean(hasRepeatDoc || (now.getTime() >= (updatedAtDoc.getTime() + (24 * 60 * 60 * 1000))))
    }

    if (hasRepeatDoc) {
      dateInit = dateInitDoc ? new Date(dateInitDoc) : dateInit
      dateEnd = dateEndtDoc ? new Date(dateEndtDoc) : dateEnd
      offset = offsetDoc || 0
    } else {
      dateInit = dateEndtDoc ? new Date(dateEndtDoc) : dateEnd
    }
  }

  // Runs if there are repeats or every 24 hours
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

const getQuery = (
  codItem,
  codTpoCaract,
  codCaract,
  companyCode,
  subsidiaryCode,
  stockCode
) => `?COD_ITEM_INI=${codItem}&COD_ITEM_FIM=${codItem}` +
  `&COD_TPO_CARACT=${codTpoCaract}&COD_CARACT=${codCaract}` +
  `&COD_EMPRESA=${companyCode}&COD_FILIAL=${subsidiaryCode}` +
  `&TIPO_SALDO=V${stockCode ? `&COD_LOCAL_ESTOQUE=${stockCode}` : ''}`

const productsEvents = async ({ appSdk, storeId }, horus, appData) => {
  console.time('test')
  const companyCode = appData?.company_code || 1
  const subsidiaryCode = appData?.subsidiary_code || 1
  const codCaract = appData?.code_characteristic || 5
  const codTpoCaract = appData?.code_type_characteristic || 3

  let stockCode = appData?.stock_code
  if (storeId === 51504) {
    stockCode = stockCode || 20
  }

  await appSdk.apiRequest(storeId, '/products', 'GET', null)
    .then(({ response }) => {
      const result = response.data.result
      if (result && result.length) {
        console.log(`> ${result.length}`)

        result.forEach(product => {
          if (product.sku.startsWith('COD_ITEM')) {
            const codItem = product.sku.replace('COD_ITEM', '')
            const query = getQuery(codItem, codTpoCaract, codCaract, companyCode, subsidiaryCode, stockCode)
            const endpoint = `/Estoque${query}&offset=0&limit=1`

            // console.log(`${codItem} => ${endpoint}`)
          }
        })
      }
    })
  console.timeEnd('test')
}

module.exports = {
  productsStocksEvents,
  productsEvents,
  productsPriceEvents
}
