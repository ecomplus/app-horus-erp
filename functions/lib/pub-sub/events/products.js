const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const { collectionHorusEvents } = require('../../utils-variables')
const importProductToEcom = require('../../integration/imports/products-to-ecom')

const getAppSdk = () => {
  return new Promise(resolve => {
    setup(null, true, firestore())
      .then(appSdk => resolve(appSdk))
  })
}

module.exports = async (
  {
    storeId,
    productHorus
  },
  context
) => {
  const { eventId } = context
  const { DAT_ULT_ATL: lastUpdate } = productHorus
  const logId = `${eventId}-s${storeId}`
  const docRef = firestore().doc(`${collectionHorusEvents}/${storeId}_products`)
  console.log('>> Exec Event #', logId)
  const appSdk = await getAppSdk()

  return appSdk.getAuth(storeId)
    .then((auth) => {
      const appClient = { appSdk, storeId, auth }
      return importProductToEcom(appClient, productHorus)
        .then(async () => {
          const date = new Date(lastUpdate)
          const now = new Date()
          const lastUpdateProduct = now.getTime() > date.getTime()
            ? now.toISOString()
            : date.toISOString()

          await docRef.set({
            lastUpdateProduct
          }, { merge: true })
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

          await docRef.set({ lastUpdateProduct }, { merge: true })
            .catch(console.error)
        }
        throw err
      }
    })
}
