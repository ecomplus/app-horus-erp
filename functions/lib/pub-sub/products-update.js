const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const { collectionUpdateProdcts } = require('../utils-variables')

const getAppData = require('./../../lib/store-api/get-app-data')
// const updateAppData = require('./../../lib/store-api/update-app-data')
// const importProduct = require('./../../lib/integration/import-product')

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
  const { DAT_ULT_ATL: lastUpdateProduct } = productHorus
  const logId = `${eventId}-s${storeId}`
  const docRef = firestore().doc(`${collectionUpdateProdcts}/${storeId}`)
  console.log('>> Exec Event #', logId)
  const appSdk = await getAppSdk()

  return appSdk.getAuth(storeId)
    .then(auth => {
      const appClient = { appSdk, storeId, auth }
      return getAppData(appClient)
        .then((appData) => {
          // todo:
        })
        .then(async () => {
          await docRef.set({
            lastUpdateProduct: new Date().toISOString()
          }, { merge: true })
            .catch(console.error)
        })
    })
    .catch((err) => {
      console.error('Error in #', logId)
      if (err.appWithoutAuth) {
        console.error(err)
      } else {
        if (lastUpdateProduct) {
          docRef.set({ lastUpdateProduct })
            .catch(console.error)
        }
        throw err
      }
    })
}
