const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
// const getAppData = require('./store-api/get-app-data')
const importCategories = require('../lib/integration/imports/categories-to-ecom')

const updateProduct = async ({ appSdk, storeId, auth }, productId, categoryId) => {
  const endpoint = `/products/${productId}/categories.json`
  await appSdk.apiRequest(storeId, endpoint, 'POST', { _id: categoryId }, auth)
    .then(({ response }) => response.data)
}

const collectionName = 'sync/category'
module.exports = context => setup(null, true, firestore())
  .then(async (appSdk) => {
    const querySnapshot = await firestore()
      .collection(collectionName)
      .listDocuments()

    console.log('>> Sync: ', querySnapshot.length)
    querySnapshot?.forEach(async docStore => {
      const storeId = parseInt(docStore.id, 10)
      // console.log('>> ', storeId, typeof storeId)
      await appSdk.getAuth(storeId)
        .then(async (auth) => {
          const listGeneroAutor = await docStore.collection(`${collectionName}/${storeId}`)
            .listDocuments()
          listGeneroAutor.forEach(a => {
            console.log('>> A', a.id)
          })
          // const listGeneroAutor = await docStore.
          // const promisesProducts = []
          // let index = 0

          // while (index < listGeneroAutor.length) {
          //   const docGeneroAutor = listGeneroAutor[index]
          //   const generoAutor = await docGeneroAutor.get()

          //   console.log('ID: ', docGeneroAutor.id)
          //   console.log('>: ', generoAutor)
          //   const products = await docGeneroAutor.listDocuments()

          //   const getDoc = (doc) => new Promise((resolve) => {
          //     doc.onSnapshot(data => {
          //       resolve(data)
          //     })
          //   })

          //   const doc = await getDoc(docGeneroAutor)
          //   let isRun = doc.data().isRun
          //   if (!isRun) {
          //     isRun = true
          //     await doc.set({ isRun }).catch(console.error)
          //     const categoryHorus = (await getDoc(products[0])).data()
          //     delete categoryHorus.productId
          //     const category = await importCategories({ appSdk, storeId, auth }, categoryHorus, true)
          //       .catch(() => null)
          //     if (category) {
          //       let i = 0
          //       while (i < products.length) {
          //         const docProduct = products[i]
          //         // products.forEach(async (docProduct) => {
          //         const productId = docProduct.id
          //         promisesProducts.push(
          //           updateProduct({ appSdk, storeId, auth }, productId, category._id)
          //             .then(() => {
          //               console.log('>> Update ', productId)
          //               return docProduct.delete()
          //             })
          //         )
          //         i += 1
          //       }
          //     }
          //   }
            // index += 1
          // }
          // await Promise.all(promisesProducts)
        })
    })
    return null
  })
  .catch(console.error)
