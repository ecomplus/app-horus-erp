const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const { collectionHorusEvents } = require('../../utils-variables')
const imports = {
  products: require('../../integration/imports/products-to-ecom')
}

const getAppSdk = () => {
  return new Promise(resolve => {
    setup(null, true, firestore())
      .then(appSdk => resolve(appSdk))
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
      return imports[resource](appClient, objectHorus, opts)
        .then(async () => {
          const date = new Date(lastUpdate)
          const lastUpdateResource = new Date(date.getTime() + 60 * 1000).toISOString()

          const body = { [`${field}`]: lastUpdateResource }
          await docRef.set(body, { merge: true })
            .catch(console.error)

          return null
        })
    })
    .catch(async (err) => {
      console.error(`>> Error Event #${logId} import: ${resource}`)
      if (err.appWithoutAuth) {
        console.error(err)
      } else {
        if (lastUpdate) {
          const date = new Date(lastUpdate)
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
