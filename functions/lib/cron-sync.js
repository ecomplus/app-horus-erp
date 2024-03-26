const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const getAppData = require('./store-api/get-app-data')
const importCategories = require('../lib/integration/imports/categories-to-ecom')

const updateProduct = async ({ appSdk, storeId, auth }, productId, categoryId) => {
  const endpoint = `/products/${productId}/categories.json`
  await appSdk.apiRequest(storeId, endpoint, 'POST', { _id: categoryId }, auth)
    .then(({ response }) => response.data)
}

const collectionName = 'syncCategory'
module.exports = context => setup(null, true, firestore())
  .then(async (appSdk) => {
    const querySnapshot = await firestore()
      .collection(collectionName)
      .listDocuments()

    console.log('>> Sync :', querySnapshot.length)
    querySnapshot?.forEach(async docStore => {
      const storeId = docStore.id
      const auth = await appSdk.getAuth(storeId)
      // const appData = await getAppData({ appSdk, storeId, auth }, true)
      const listCategories = await docStore.listCollections()

      const promisesProducts = []

      listCategories.forEach(async docCategory => {
        const products = await docCategory.listDocuments()
        let categoryHorus
        products.forEach(async (docProduct, index) => {
          const productId = docProduct.id
          const getData = new Promise((resolve) => {
            docProduct.onSnapshot(data => {
              resolve(data)
            })
          })
          if (index === 0) {
            categoryHorus = await getData
            delete categoryHorus.productId
          }
          const category = await importCategories({ appSdk, storeId, auth }, categoryHorus, true)
          if (category) {
            promisesProducts.push(
              updateProduct({ appSdk, storeId, auth }, productId, category._id)
                .then(() => {
                  return docProduct.delete()
                })
            )
          }
        })
      })
    })
    return null
  })
  .catch(console.error)
