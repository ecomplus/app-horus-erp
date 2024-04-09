const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const updateAppData = require('../../store-api/update-app-data')
const getAppData = require('../../store-api/get-app-data')
const handleExports = {
  orders: require('../../integration/exports/orders-to-horus'),
  customers: require('../../integration/exports/custormers-to-horus')
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
  if (queueEntry && queueEntry.action && queueEntry.queue) {
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
  return null
}

module.exports = async (
  {
    storeId,
    resource,
    resourceId,
    opts
  },
  context
) => {
  const { eventId } = context
  const logId = `${eventId}-s${storeId}`
  const docRef = firestore().doc(`sync/${storeId}/${resource}/${resourceId}`)
  const appSdk = await getAppSdk()
  console.log(`>> Exec Event #${logId} Export: ${resource} #${resourceId}`)

  return appSdk.getAuth(storeId)
    .then(async (auth) => {
      const appClient = { appSdk, storeId, auth }
      if (!opts || !Object.keys(opts).length || !opts.appData) {
        const appData = await getAppData(appClient, true)
        opts = {
          appData
        }
        if (resource === 'orders') {
          const queueEntry = { action: 'exportation', queue: resource, nextId: resourceId }
          Object.assign(opts, { queueEntry })
        }
      }
      return handleExports[resource](appClient, resourceId, opts)
        .then(async (responseId) => {
          if (!responseId) {
            await docRef.set(
              {
                resource,
                resourceId,
                opts,
                updated_at: new Date().toISOString()
              },
              { merge: true }
            )
              .catch(console.error)
          }
          return updateApp(appClient, 'remove_queue', opts)
            .then(() => {
              if (responseId) {
                return docRef.delete()
              }
            })
        })
    })
    .catch(async (err) => {
      console.error(`>> Error Event #${logId} Export [${resource}: ${resourceId}] => Horus`)
      if (err.appWithoutAuth) {
        console.error(err)
      }
      console.error(err)
      throw err
    })
}
