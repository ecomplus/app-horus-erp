const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
// const getAppData = require('./store-api/get-app-data')
// const {
//   // collectionHorusEvents,
//   // topicResourceToEcom
//   // topicProductsHorus
//   // topicCustomerHorus
// } = require('./utils-variables')
// const { parseDate } = require('./parsers/parse-to-ecom')
// const Horus = require('./horus/client')
// const requestHorus = require('./horus/request')
// const { sendMessageTopic } = require('./pub-sub/utils')
// syncCategory

module.exports = context => setup(null, true, firestore())
  .then(async (appSdk) => {
    const querySnapshot = await firestore()
      .collection('syncCategory')
      .get()

    querySnapshot?.forEach(documentSnapshot => {
      const storeId = documentSnapshot.id
      const data = documentSnapshot.data()
      console.log('>> ', storeId, JSON.stringify(data))
    })
    return null

    // return Promise.all(promises)
    //   .then(() => {
    //     console.log('> Finish Check Events stores')
    //   })
  })
  .catch(console.error)
