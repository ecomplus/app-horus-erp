const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const { collectionHorusEvents } = require('../../utils-variables')
const updateAppData = require('../../store-api/update-app-data')
const imports = {
  products: require('../../integration/imports/products-to-ecom'),
  categories: require('../../integration/imports/categories-to-ecom'),
  brands: require('../../integration/imports/brands-to-ecom')
}

const getAppSdk = () => {
  return new Promise(resolve => {
    setup(null, true, firestore())
      .then(appSdk => resolve(appSdk))
  })
}
const queueRetry = (appClient, { action, queue, nextId }, appData) => {
  const retryKey = `${appClient.storeId}_${action}_${queue}_${nextId}`
  console.warn(retryKey)

  let queueList = appData[action] && appData[action][queue]
  if (!Array.isArray(queueList)) {
    queueList = [nextId]
  } else if (!queueList.includes(nextId)) {
    queueList.unshift(nextId)
  }
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      updateAppData(appClient, {
        [action]: {
          ...appData[action],
          [queue]: queueList
        }
      })
        .then(resolve)
        .catch(reject)
    }, 7000)
  })
}

const updateApp = async ({ appSdk, storeId, auth }, _id, opts) => {
  const {
    queueEntry,
    appData
  } = opts
  const { action, queue, nextId } = queueEntry
  let queueList = appData[action][queue]
  if (Array.isArray(queueList)) {
    const idIndex = queueList.indexOf(nextId)
    if (idIndex > -1) {
      queueList.splice(idIndex, 1)
    }
  } else {
    queueList = []
  }
  const data = {
    [action]: {
      ...appData[action],
      [queue]: queueList
    }
  }
  console.log(`> Update app #${storeId} ${JSON.stringify(data)}`)
  return updateAppData({ appSdk, storeId, auth }, data)
    .then(() => {
      return { _id }
    })
    .catch(async (err) => {
      if (err.response && (!err.response.status || err.response.status >= 500)) {
        await queueRetry({ appSdk, storeId, auth }, queueEntry, appData, err.response)
        return { _id }
      } else {
        throw err
      }
    })
}

module.exports = async (
  {
    storeId,
    resource,
    objectHorus,
    opts
  },
  context
) => {
  let isUpdateDate = true
  if (typeof opts.isUpdateDate === 'boolean') {
    isUpdateDate = opts.isUpdateDate
  }
  const { eventId } = context
  const { DAT_ULT_ATL: lastUpdate } = objectHorus
  const logId = `${eventId}-s${storeId}`
  const docRef = firestore().doc(`${collectionHorusEvents}/${storeId}_${resource}`)
  console.log(`>> Exec Event #${logId} import: ${resource}`)
  const field = 'lastUpdate' + resource.charAt(0).toUpperCase() + resource.substring(1)
  let lastUpdateDoc
  const appSdk = await getAppSdk()
  const docSnapshot = await docRef.get()
  if (docSnapshot.exists) {
    lastUpdateDoc = docSnapshot.data()[field]
  }

  const now = new Date(Date.now() - 3 * 60 * 60 * 1000) // UTC-3

  return appSdk.getAuth(storeId)
    .then((auth) => {
      const appClient = { appSdk, storeId, auth }
      if (objectHorus && lastUpdateDoc) {
        return imports[resource](appClient, objectHorus, opts)
          .then(async (response) => {
            const _id = response?._id
            if (!_id) {
              // console.log('>>context ', JSON.stringify(context))
              return { _id: 'error' }
              // const collectionName = 'pubSubErro'
              // return saveFirestore(`${collectionName}/${Date.now()}`, { eventName, json })
            }
            if (isUpdateDate) {
              const date = new Date(lastUpdate || Date.now())
              const lastUpdateResource = new Date(date.getTime() + 60 * 1000).toISOString()

              const body = { [`${field}`]: lastUpdateResource }
              await docRef.set(body, { merge: true })
                .catch(console.error)
            }
            if (opts.queueEntry) {
              return updateApp(appClient, _id, opts)
            }
            return { _id }
          })
      }
      return updateApp(appClient, 'remove_queue', opts)
    })
    .then(({ _id }) => {
      console.log(`>> Sucess #${logId} import [${resource}: ${_id}]`)
    })
    .catch(async (err) => {
      console.error(`>> Error Event #${logId} import: ${resource}`)
      if (err.appWithoutAuth) {
        console.error(err)
      } else {
        if (isUpdateDate) {
          const date = new Date(lastUpdate || Date.now())
          const lastDoc = lastUpdateDoc ? new Date(lastUpdateDoc) : now
          const lastUpdateResource = lastDoc.getTime() < date.getTime()
            ? lastDoc.toISOString()
            : date.toISOString()

          const body = { [`${field}`]: lastUpdateResource }
          await docRef.set(body, { merge: true })
            .catch(console.error)
        }
        throw err
      }
    })
}
