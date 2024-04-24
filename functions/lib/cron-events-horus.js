const { firestore } = require('firebase-admin')
// const { setup } = require('@ecomplus/application-sdk')
const getAppData = require('./store-api/get-app-data')
const {
  collectionHorusEvents,
  topicResourceToEcom
} = require('./utils-variables')
const { parseDate } = require('./parsers/parse-to-horus')
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

const productsStocksEvents = async (horus, storeId, opts) => {
  const resource = 'products'
  const field = 'lastUpdate' + resource.charAt(0).toUpperCase() + resource.substring(1)
  let dateInit = parseDate(new Date(1), true)
  const dateEnd = parseDate(new Date(), true)
  const resourcePrefix = `${resource}_stocks`
  const docRef = firestore()
    .doc(`${collectionHorusEvents}/${storeId}_${resourcePrefix}`)

  // console.log('>> ', resource, ' => ', field)
  const docSnapshot = await docRef.get()
  if (docSnapshot.exists) {
    const lastUpdateResource = docSnapshot.data()[field]
    dateInit = parseDate(new Date(lastUpdateResource), true)
  }
  const companyCode = opts.appData.company_code || 1
  const subsidiaryCode = opts.appData.subsidiary_code || 1

  const codCaract = 5 // TODO: opts.appData.code_characteristic
  const codTpoCaract = 3 // TODO: opts.appData.code_type_characteristic

  const query = `?DATA_INI=${dateInit}&DATA_FIM=${dateEnd}` +
    `COD_TPO_CARACT=${codTpoCaract}&COD_CARACT=${codCaract}` +
    `&COD_EMPRESA=${companyCode}&COD_FILIAL=${subsidiaryCode}`

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
  console.log(`>>Cron #${storeId} [${query}] total imports ${total}`)

  return Promise.all(promisesSendTopics)
    .then(() => {
      console.log(`Finish Exec Products in #${storeId}`)
    })
}

// const productsPriceEvents = async (horus, storeId, opts) => {
//   const resource = 'products'
//   const field = 'lastUpdate' + resource.charAt(0).toUpperCase() + resource.substring(1)
//   let dateInit = parseDate(new Date(1), true)
//   const dateEnd = parseDate(new Date(), true)
//   const docRef = firestore()
//     .doc(`${collectionHorusEvents}/${storeId}_${resource}_price`)

//   // console.log('>> ', resource, ' => ', field)
//   const docSnapshot = await docRef.get()
//   if (docSnapshot.exists) {
//     const lastUpdateResource = docSnapshot.data()[field]
//     dateInit = parseDate(new Date(lastUpdateResource), true)
//   }

//   const query = `?DATA_INI=${dateInit}&DATA_FIM=${dateEnd}`

//   let hasRepeat = true
//   let offset = 0
//   const limit = 50

//   let total = 0
//   // const init = Date.now()
//   const promisesSendTopics = []
//   while (hasRepeat) {
//     // create Object Horus to request api Horus
//     const endpoint = `/Busca_Acervo${query}&offset=${offset}&limit=${limit}`
//     const products = await requestHorus(horus, endpoint, 'get', true)
//       .catch((_err) => {
//         // if (_err.response) {
//         //   console.warn(JSON.stringify(_err.response))
//         // } else {
//         //   console.error(_err)
//         // }
//         return null
//       })

//     if (products && Array.isArray(products)) {
//       total += products.length
//       products.forEach((productHorus, index) => {
//         promisesSendTopics.push(
//           sendMessageTopic(
//             topicResourceToEcom,
//             {
//               storeId,
//               resource,
//               objectHorus: productHorus,
//               opts
//             })
//         )
//       })
//       // const now = Date.now()
//       // const time = now - init
//       // if (time >= 50000) {
//       //   hasRepeat = false
//       // }
//     } else {
//       hasRepeat = false
//     }

//     offset += limit
//   }
//   console.log(`>>Cron #${storeId} [${query}] total imports ${total}`)

//   return Promise.all(promisesSendTopics)
//     .then(() => {
//       console.log(`Finish Exec Products in #${storeId}`)
//     })
// }

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
      .then((appData) => {
        const {
          username,
          password,
          baseURL
        } = appData
        const horus = new Horus(username, password, baseURL)
        const opts = { appData }
        const promises = []
        promises.push(productsStocksEvents(horus, storeId, opts))
        // TODO: every day
        // promises.push(productsPriceEvents(horus, storeId, opts))
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
