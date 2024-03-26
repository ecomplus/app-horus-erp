const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
// const getAppData = require('./store-api/get-app-data')
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

    console.log('>> Sync: ', querySnapshot.length)
    querySnapshot?.forEach(async docStore => {
      const storeId = parseInt(docStore.id, 10)
      console.log('>> ', storeId, typeof storeId)
      await appSdk.getAuth(storeId)
        .then(async (auth) => {
        // const appData = await getAppData({ appSdk, storeId, auth }, true)
          const listGeneroAutor = await docStore.listCollections()
          const promisesProducts = []

          listGeneroAutor.forEach(async docGeneroAutor => {
            const products = await docGeneroAutor.listDocuments()
            let categoryHorus
            products.forEach(async (docProduct, index) => {
              const productId = docProduct.id
              const getData = new Promise((resolve) => {
                docProduct.onSnapshot(data => {
                  resolve(data.data())
                })
              })
              if (index === 0) {
                categoryHorus = await getData
                delete categoryHorus.productId
              }
              console.log('>>Cat ', categoryHorus)
              if (categoryHorus) {
                const category = await importCategories({ appSdk, storeId, auth }, categoryHorus, true)
                  .catch(() => null)
                if (category) {
                  promisesProducts.push(
                    updateProduct({ appSdk, storeId, auth }, productId, category._id)
                      .then(() => {
                        return docProduct.delete()
                      })
                  )
                }
              }
            })
          })
        })
    })
    return null
  })
  .catch(console.error)
