const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
// const getAppData = require('./store-api/get-app-data')
const getBrands = require('./imports/brands-to-ecom')
const { sendMessageTopic } = require('../pub-sub/utils')
const { topicResourceToEcom } = require('../utils-variables')

const updateProduct = async ({ appSdk, storeId, auth }, productId, brandId) => {
  const endpoint = `/products/${productId}/brands.json`
  await appSdk.apiRequest(storeId, endpoint, 'POST', { _id: brandId }, auth)
    .then(({ response }) => response.data)
}

const getDoc = (doc) => new Promise((resolve) => {
  doc?.onSnapshot(data => {
    resolve(data)
  })
})

const collectionName = 'sync/brand'
module.exports = context => setup(null, true, firestore())
  .then(async (appSdk) => {
    const listStoreIds = await firestore()
      .collection('sync')
      .doc('brand')
      .listCollections()

    console.log('>> Sync: ', listStoreIds.length)
    listStoreIds?.forEach(async docStore => {
      const storeId = parseInt(docStore.id, 10)
      await appSdk.getAuth(storeId)
        .then(async (auth) => {
          const listEditoras = await firestore()
            .collection(`${collectionName}/${storeId}`)
            .listDocuments()

          // const LIMIT = listGeneroAutor.length
          console.log('>> ', storeId, listEditoras.length)
          const promisesSendTopics = []
          listEditoras.forEach(async (docFirestore, index) => {
            // console.log('>> ', index, index <= LIMIT)
            if (index <= listEditoras.length) {
              const brandHorusId = docFirestore.id
              const doc = await getDoc(docFirestore)
              const brandHorus = doc.data()
              try {
                const brand = await getBrands({ appSdk, storeId, auth }, brandHorus)

                const promisesProducts = []
                const listProducts = await firestore()
                  .collection(`${collectionName}/${storeId}/${brandHorusId}/products`)
                  .listDocuments()

                if (brand && brand._id) {
                  console.log('>> try update')
                  if (listProducts.length) {
                    listProducts.forEach((docProduct) => {
                      promisesProducts.push(
                        updateProduct({ appSdk, storeId, auth }, docProduct.id, brand._id)
                          .then(() => {
                            console.log('>> Update Product ', docProduct.id)
                            return docProduct.delete()
                          })
                      )
                    })
                  } else {
                    await docFirestore.delete()
                      .catch()
                  }
                } else {
                  promisesSendTopics.push(
                    sendMessageTopic(
                      topicResourceToEcom,
                      {
                        storeId,
                        resource: 'brands',
                        objectHorus: brandHorus,
                        opts: { isCreate: true }
                      })
                  )
                }
                if (promisesSendTopics.length) {
                  await Promise.all(promisesSendTopics)
                }

                if (promisesProducts.length) {
                  await Promise.all(promisesProducts)
                    .then(async () => {
                      const listDocs = await firestore()
                        .collection(`${collectionName}/${storeId}/${brandHorusId}/products`)
                        .listDocuments()
                      if (!listDocs.length) {
                        console.log('> Remove ', brandHorusId)
                        return docFirestore.delete()
                      }
                      return null
                    })
                    .catch(() => {
                      console.log('> Error Delete ', JSON.stringify(brandHorus))
                    })
                }
              } catch (e) {
                console.log('> Error in ', JSON.stringify(brandHorus))
              }
            }
          })
        })
    })
    return null
  })
  .catch(console.error)
