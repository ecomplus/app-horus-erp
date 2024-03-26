const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
// const getAppData = require('./store-api/get-app-data')
const importCategories = require('./imports/categories-to-ecom')

const updateProduct = async ({ appSdk, storeId, auth }, productId, categoryId) => {
  const endpoint = `/products/${productId}/categories.json`
  await appSdk.apiRequest(storeId, endpoint, 'POST', { _id: categoryId }, auth)
    .then(({ response }) => response.data)
}

const getDoc = (doc) => new Promise((resolve) => {
  doc?.onSnapshot(data => {
    resolve(data)
  })
})

const collectionName = 'sync/category'
module.exports = context => setup(null, true, firestore())
  .then(async (appSdk) => {
    const listStoreIds = await firestore()
      .collection('sync')
      .doc('category')
      .listCollections()

    console.log('>> Sync: ', listStoreIds.length)
    listStoreIds?.forEach(async docStore => {
      const storeId = parseInt(docStore.id, 10)
      await appSdk.getAuth(storeId)
        .then(async (auth) => {
          const listGeneroAutor = await firestore()
            .collection(`${collectionName}/${storeId}`)
            .listDocuments()

          const LIMIT = 10
          console.log('>> ', storeId, listGeneroAutor.length)
          listGeneroAutor.forEach(async (docFirestore, index) => {
            console.log('>> ', index, index <= LIMIT)
            if (index <= LIMIT) {
              const categoryHorusId = docFirestore.id
              const doc = await getDoc(docFirestore)
              const categoryHorus = doc.data()
              try {
                const category = await importCategories({ appSdk, storeId, auth }, categoryHorus, true)

                const promisesProducts = []
                const listProducts = await firestore()
                  .collection(`${collectionName}/${storeId}/${categoryHorusId}/products`)
                  .listDocuments()

                if (category && category._id) {
                  listProducts.forEach((docProduct) => {
                    promisesProducts.push(
                      updateProduct({ appSdk, storeId, auth }, docProduct.id, category._id)
                        .then(() => {
                          console.log('>> Update Product ', docProduct.id)
                          return docProduct.delete()
                        })
                    )
                  })
                }
                await Promise.all(promisesProducts)
                  .then(async () => {
                    const listDocs = await firestore()
                      .collection(`${collectionName}/${storeId}/${categoryHorusId}/products`)
                      .listDocuments()
                    if (!listDocs.length) {
                      console.log('> Remove ', categoryHorusId)
                      return docFirestore.delete()
                    }
                    return null
                  })
                  .catch(() => {
                    console.log('> Error Delete ', JSON.stringify(categoryHorus))
                  })
              } catch (e) {
                console.log('> Error in ', JSON.stringify(categoryHorus))
              }
            }
          })
        })
    })
    return null
  })
  .catch(console.error)
