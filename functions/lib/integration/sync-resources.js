const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const handle = {
  brand: require('./handles-queues/queue-brands'),
  category: require('./handles-queues/queue-categories'),
  kit: require('./handles-queues/queue-kit')
}

// const collectionName = 'sync'
// module.exports = context => setup(null, true, firestore())
//   .then(async (appSdk) => {
//     const listStoreIds = await firestore()
//       .collection('sync')
//       .get()

//     // return Promise.all([
//     //   syncBrands(appSdk),
//     //   syncCategories(appSdk),
//     //   syncKits(appSdk)
//     // ])
//   })
//   .catch(console.error)

const getDocInFirestore = (documentId) => new Promise((resolve, reject) => {
  firestore().doc(documentId).get()
    .then((doc) => {
      // const t = doc.ref.listCollections()
      resolve(doc)
    })
    .catch(reject)
})

const runStore = async ({ appSdk, storeId, auth }) => {
  console.log('>> Run Sync ', storeId)
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

module.exports = context => setup(null, true, firestore)
  .then(async (appSdk) => {
    const listStoreIds = await firestore()
      .collection('sync')
      .listDocuments()
    let i = 0
    const promisesStore = []
    while (i <= listStoreIds.length - 1) {
      const docFirestore = listStoreIds[i]
      const storeId = parseInt(docFirestore.id, 10)
      console.log('>> Sync: ', storeId)
      promisesStore.push(
        appSdk.getAuth(storeId)
          .then(async (auth) => runStore({ appSdk, storeId, auth }))
      )
      i += 1
    }
    return Promise.all(promisesStore)
  })
  .catch(console.error)
