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
    resourse,
    objectHorus,
    opts
  },
  context
) => {
  console.log('>> context ', JSON.stringify(context))
  const { eventId } = context
  const { DAT_ULT_ATL: lastUpdate } = objectHorus
  const logId = `${eventId}-s${storeId}`
  const docRef = firestore().doc(`${collectionHorusEvents}/${storeId}_${resourse}`)
  console.log('>> Exec Event #', logId, ' import ', resourse)
  const appSdk = await getAppSdk()

  return appSdk.getAuth(storeId)
    .then((auth) => {
      const appClient = { appSdk, storeId, auth }
      return imports[resourse](appClient, objectHorus, opts)
        .then(async () => {
          const date = new Date(lastUpdate)
          const now = new Date()
          const lastUpdateProduct = now.getTime() > date.getTime()
            ? now.toISOString()
            : date.toISOString()

          const body = { lastUpdateProduct }
          await docRef.set(body, { merge: true })
            .catch(console.error)

          return null
        })
    })
    .catch(async (err) => {
      console.error('Error in #', logId)
      if (err.appWithoutAuth) {
        console.error(err)
      } else {
        if (lastUpdate) {
          const date = new Date(lastUpdate)
          const now = new Date()
          const lastUpdateProduct = now.getTime() < date.getTime()
            ? now.toISOString()
            : date.toISOString()

          const body = { lastUpdateProduct }
          await docRef.set(body, { merge: true })
            .catch(console.error)
        }
        throw err
      }
    })
}
