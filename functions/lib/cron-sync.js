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
const collectionName = 'syncCategory'
module.exports = context => setup(null, true, firestore())
  .then(async (appSdk) => {
    console.log('>>init sync')
    const querySnapshot = await firestore()
      .collection(collectionName)
      .get()

    console.log('>> querySnapshot ', querySnapshot)
    querySnapshot?.forEach(documentSnapshot => {
      const storeId = documentSnapshot.id
      const docId = `${collectionName}/${storeId}`
      const data = documentSnapshot.data()
      console.log('>> ', storeId, JSON.stringify(data), docId)
    })
    return null

    // return Promise.all(promises)
    //   .then(() => {
    //     console.log('> Finish Check Events stores')
    //   })
  })
  .catch(console.error)
