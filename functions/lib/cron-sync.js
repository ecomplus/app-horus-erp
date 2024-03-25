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
      .listDocuments()

    console.log('>> querySnapshot ', querySnapshot.length)
    querySnapshot?.forEach(async docStore => {
      const storeId = docStore.id
      const listCategories = await docStore.listCollections()
      console.log('>> id: ', storeId, listCategories.length)
      listCategories.forEach(async docCategory => {
        console.log('>> docId: ', docCategory.id)
      })
    })
    return null

    // return Promise.all(promises)
    //   .then(() => {
    //     console.log('> Finish Check Events stores')
    //   })
  })
  .catch(console.error)
