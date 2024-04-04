const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
// const syncBrands = require('./handles-queues/queue-brands')
// const syncCategories = require('./handles-queues/queue-categories')
// const syncKits = require('./handles-queues/queue-kit')

const collectionName = 'sync'
module.exports = context => setup(null, true, firestore())
  .then(async (appSdk) => {
    const listStoreIds = await firestore()
      .collection('sync')
      .get()

    // return Promise.all([
    //   syncBrands(appSdk),
    //   syncCategories(appSdk),
    //   syncKits(appSdk)
    // ])
  })
  .catch(console.error)
