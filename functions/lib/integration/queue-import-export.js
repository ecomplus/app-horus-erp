const { firestore } = require('firebase-admin')
const getAppData = require('../store-api/get-app-data')
const Horus = require('../horus/client')
const checkHorusApi = require('../horus/check-horus-api')
const handle = {
  // Import To Ecom
  brand: require('./handles-queues/queue-brands'),
  category: require('./handles-queues/queue-categories'),
  kit: require('./handles-queues/queue-kit'),
  // Export To Horus
  orders: require('./handles-queues/queue-exports'),
  customers: require('./handles-queues/queue-exports')
}

const getDocInFirestore = (documentId) => new Promise((resolve, reject) => {
  firestore().doc(documentId).get()
    .then((doc) => {
      resolve(doc)
    })
    .catch(reject)
})

const runStore = async ({ appSdk, storeId, auth }) => {
  // console.log('>> Run Sync ', storeId)
  const docId = `sync/${storeId}`
  const doc = await getDocInFirestore(docId)
  const promisesResources = []
  const listResources = await doc.ref.listCollections()
  listResources?.forEach(resourceDoc => {
    const resource = resourceDoc.id
    const collectionName = `${docId}/${resource}`
    promisesResources.push(handle[resource]({ appSdk, storeId, auth }, collectionName))
  })
  return Promise.all(promisesResources)
}

module.exports = async (appSdk) => {
  const listStoreIds = await firestore()
    .collection('sync')
    .listDocuments()
  let i = 0
  const promisesStore = []
  while (i <= listStoreIds.length - 1) {
    const docFirestore = listStoreIds[i]
    const storeId = parseInt(docFirestore.id, 10)
    // console.log('>> Sync: ', storeId)
    promisesStore.push(
      appSdk.getAuth(storeId)
        .then(async (auth) => {
          const isHorusApiOk = await getAppData({ appSdk, storeId, auth }, true)
            .then(appData => {
              const {
                username,
                password,
                baseURL
              } = appData
              const horus = new Horus(username, password, baseURL)
              return checkHorusApi(horus)
            })

          console.log('>> Horus API', isHorusApiOk ? 'OK' : 'OffLine')
          if (isHorusApiOk) {
            return runStore({ appSdk, storeId, auth })
          }
          return null
        })
    )
    i += 1
  }
  return Promise.all(promisesStore)
    .catch(console.error)
}
