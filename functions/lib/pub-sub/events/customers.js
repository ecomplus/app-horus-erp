const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const { collectionHorusEvents } = require('../../utils-variables')
const importCustomerToEcom = require('../../integration/imports/customers-to-ecom')

const getAppSdk = () => {
  return new Promise(resolve => {
    setup(null, true, firestore())
      .then(appSdk => resolve(appSdk))
  })
}

module.exports = async (
  {
    storeId,
    customerHorus
  },
  context
) => {
  const { eventId } = context
  const { DAT_ULT_ATL: lastUpdateCustomer } = customerHorus
  const logId = `${eventId}-s${storeId}`
  const docRef = firestore().doc(`${collectionHorusEvents}/${storeId}/customers`)
  console.log('>> Exec Event #', logId)
  const appSdk = await getAppSdk()

  return appSdk.getAuth(storeId)
    .then((auth) => {
      const appClient = { appSdk, storeId, auth }
      return importCustomerToEcom(appClient, customerHorus)
        .then(async () => {
          await docRef.set({
            lastUpdateCustomer: new Date().toISOString()
          }, { merge: true })
            .catch(console.error)

          return null
        })
    })
    .catch((err) => {
      console.error('Error in #', logId)
      if (err.appWithoutAuth) {
        console.error(err)
      } else {
        if (lastUpdateCustomer) {
          docRef.set({ lastUpdateCustomer }, { merge: true })
            .catch(console.error)
        }
        throw err
      }
    })
}
