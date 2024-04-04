const { firestore } = require('firebase-admin')
// const getAppData = require('../../lib/store-api/get-app-data')
// const { getCodePayment, getCodeDelivery } = require('../../lib/parsers/parse-to-horus')

// const getDoc = (doc) => new Promise((resolve) => {
//   doc?.onSnapshot(data => {
//     resolve(data)
//   })
// })

const getDocInFirestore = (documentId) => new Promise((resolve, reject) => {
  firestore().doc(documentId).get()
    .then((doc) => {
      // const t = doc.ref.listCollections()
      resolve(doc)
    })
    .catch(reject)
})

const runStore = async ({ appSdk, storeId, auth }) => {
  const docId = `sync/${storeId}`
  const doc = await getDocInFirestore(docId)
  //   console.log('>> ', doc, ' ', doc && JSON.stringify(doc.data()))
  const promisesResources = []
  const listResources = await doc.ref.listCollections()
  listResources?.forEach(resourceDoc => {
    const resource = resourceDoc.id
    const collectionName = `${docId}/${resource}`
    console.log('>> ', collectionName)
    // promisesResources.push(handle[resource]({ appSdk, storeId, auth }, collectionName))
  })
  return Promise.all(promisesResources)
}
exports.get = async ({ appSdk }, req, res) => {
  const listStoreIds = await firestore()
    .collection('sync')
    .listDocuments()
  let i = 0
  const promisesStore = []
  while (i <= listStoreIds.length - 1) {
    const docFirestore = listStoreIds[i]
    const storeId = docFirestore.id
    // const doc = await getDoc(docFirestore)
    console.log('>> id: ', storeId)
    promisesStore.push(
      appSdk.getAuth(storeId)
        .then(async (auth) => runStore({ appSdk, storeId, auth }))
    )
    i += 1
  }
  await Promise.all(promisesStore)
    .then(() => {
      console.log('OKKK')
    })
  res.send('ok')
  // const storeId = 1173
  // appSdk.getAuth(storeId)
  //   .then((auth) => {
  //     return getAppData({ appSdk, storeId, auth })
  //       .then(appData => {
  //         const payment = getCodePayment(paymentMethodCode, appData.payments)
  //         const delivey = getCodeDelivery(shippingApp, appData.delivery)
  //         res.send({
  //           payment,
  //           appDataPayments: appData.payments,
  //           paymentMethodCode,
  //           delivey,
  //           appDataDelivery: appData.delivery,
  //           shippingApp
  //         })
  //       })
  //   })
  //   .catch((err) => {
  //     console.error(err)
  //     res.send({ error: '' })
  //   })
}
