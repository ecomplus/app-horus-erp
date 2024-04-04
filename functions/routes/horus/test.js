const { firestore } = require('firebase-admin')
// const getAppData = require('../../lib/store-api/get-app-data')
// const { getCodePayment, getCodeDelivery } = require('../../lib/parsers/parse-to-horus')

exports.get = async ({ appSdk }, req, res) => {
  const listStoreIds = await firestore()
    .collection('sync')
    .listDocuments()
  console.log('>> ', JSON.stringify(listStoreIds))
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
