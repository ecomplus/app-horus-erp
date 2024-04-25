const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const { saveFirestore } = require('../utils')
const { collectionHorusEvents } = require('../../utils-variables')
const updateAppData = require('../../store-api/update-app-data')
const imports = {
  products: require('../../integration/imports/products-to-ecom'),
  categories: require('../../integration/imports/categories-to-ecom'),
  brands: require('../../integration/imports/brands-to-ecom')
}
const releaseDate = '2024-04-01T00:00:00.000Z'

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
  if (queueEntry) {
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

  return { _id }
}

const checkAndUpdateLastUpdateDate = async (isUpdateDate, lastUpdate, field, now, docRef) => {
  if (isUpdateDate) {
    const date = new Date(lastUpdate || Date.now())
    const lastUpdateResource = now.getTime() > date.getTime()
      ? now.toISOString()
      : new Date(date.getTime() + 60 * 1000).toISOString()
    const body = { [`${field}`]: lastUpdateResource, updated_at: now.toISOString() }
    await docRef.set(body, { merge: true })
      .catch(console.error)
  }
}

module.exports = async (
  {
    storeId,
    resource: resourcePrefix,
    objectHorus,
    opts,
    eventName
  },
  context
) => {
  const resource = resourcePrefix
    .replace('_stocks', '')
    .replace('_price', '')

  let isUpdateDate = true
  if (typeof opts.isUpdateDate === 'boolean') {
    isUpdateDate = opts.isUpdateDate
  }

  const { eventId } = context
  const { DAT_ULT_ATL: lastUpdate } = objectHorus
  const logId = `${eventId}-s${storeId}`
  const docRef = firestore().doc(`${collectionHorusEvents}/${storeId}_${resourcePrefix}`)
  console.log(`>> Exec Event #${logId} import: ${resource}`)
  const field = 'lastUpdate' + resource.charAt(0).toUpperCase() + resource.substring(1)
  let lastUpdateDoc = releaseDate
  const appSdk = await getAppSdk()
  const docSnapshot = await docRef.get()
  if (docSnapshot.exists) {
    const data = docSnapshot.data()[field]
    lastUpdateDoc = typeof data === 'string' ? data : releaseDate
  }

  // const now = new Date(Date.now() - 3 * 60 * 60 * 1000) // UTC-3
  const now = new Date()

  return appSdk.getAuth(storeId)
    .then((auth) => {
      const appClient = { appSdk, storeId, auth }
      // console.log('>> ', resourcePrefix, ' ', resource, ' ', lastUpdateDoc)
      if (objectHorus && lastUpdateDoc) {
        if (resource === 'products') {
          console.log('> try COD_ITEM: ', objectHorus?.COD_ITEM, ' ', resourcePrefix)
        }
        return imports[resource](appClient, objectHorus, opts)
          .then(async (response) => {
            const _id = response?._id || 'not_update'

            if (resourcePrefix.startsWith('products')) {
              await checkAndUpdateLastUpdateDate(isUpdateDate, lastUpdate, field, now, docRef)
            }

            if (opts.queueEntry) {
              return updateApp(appClient, _id, opts)
            }
            return { _id }
          })
      }
      return updateApp(appClient, 'remove_queue_app', opts)
    })
    .then(async ({ _id }) => {
      console.log(`>> Sucess #${logId} [${resourcePrefix}: ${_id}]`)
    })
    .catch(async (err) => {
      console.error(`>> Error Event #${logId} ${resourcePrefix}`)

      if (err.appWithoutAuth) {
        console.error(err)
      } else {
        const json = {
          storeId,
          resource,
          objectHorus,
          opts,
          eventName
        }
        const collectionName = 'queuePubSub'
        const id = objectHorus.COD_ITEM || objectHorus.resourceId
        await saveFirestore(
          `${collectionName}/${id ? `_${id}` : Date.now()}`,
          { eventName, json }
        )
          .catch()

        throw err
      }
    })
}
