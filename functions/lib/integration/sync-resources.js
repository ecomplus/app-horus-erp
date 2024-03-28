const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const syncBrands = require('./handles-queues/queue-brands')
const syncCategories = require('./handles-queues/queue-categories')
const syncKits = require('./handles-queues/queue-kit')

module.exports = context => setup(null, true, firestore())
  .then(async (appSdk) => {
    return Promise.all(
      syncBrands(appSdk),
      syncCategories(appSdk),
      syncKits(appSdk)
    )
  })
  .catch(console.error)
