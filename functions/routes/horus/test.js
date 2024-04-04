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
exports.get = async ({ appSdk }, req, res) => {
  const listStoreIds = await firestore()
    .collection('sync')
    .listDocuments()
  // console.log('>> ', JSON.stringify(listStoreIds))
  // listStoreIds.forEach(store => {
  //   storeId.id
  // })
  // appSdk.getAuth(storeId)
  // .then(async (auth) => {})
  let i = 0
  while (i <= listStoreIds.length - 1) {
    const docFirestore = listStoreIds[i]
    const storeId = docFirestore.id
    // const doc = await getDoc(docFirestore)
    console.log('>> id: ', storeId)
    const docId = `sync/${storeId}`
    const doc = await getDocInFirestore(docId)
    console.log('>> ', doc, ' ', doc && JSON.stringify(doc.data()))
    const listCollections = await doc.ref.listCollections()
    listCollections?.forEach(element => {
      const id = element.id
      console.log('>> ', id)
    })
    i += 1
  }
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
