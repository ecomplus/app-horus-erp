const { firestore } = require('firebase-admin')
const getCategories = require('../imports/categories-to-ecom')
const { sendMessageTopic } = require('../../pub-sub/utils')
const { topicResourceToEcom } = require('../../utils-variables')

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
const runStore = (appSdk, storeId) => appSdk.getAuth(storeId)
  .then(async (auth) => {
    const listGeneroAutor = await firestore()
      .collection(`${collectionName}/${storeId}`)
      .listDocuments()

    console.log('>> Sync Categories ', storeId, listGeneroAutor.length)
    const promisesSendTopics = []
    let index = 0
    while (index <= listGeneroAutor.length - 1) {
      const docFirestore = listGeneroAutor[index]
      const categoryHorusId = docFirestore.id
      const doc = await getDoc(docFirestore)
      const categoryHorus = doc.data()
      try {
        const category = await getCategories({ appSdk, storeId, auth }, categoryHorus)

        const promisesProducts = []

        if (category && category._id) {
          const listProducts = await firestore()
            .collection(`${collectionName}/${storeId}/${categoryHorusId}/products`)
            .listDocuments()
          if (listProducts.length) {
            listProducts.forEach((docProduct) => {
              promisesProducts.push(
                updateProduct({ appSdk, storeId, auth }, docProduct.id, category._id)
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
                resource: 'categories',
                objectHorus: categoryHorus,
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
        }
      } catch (e) {
        console.log('> Error in ', JSON.stringify(categoryHorus))
      }
      index += 1
    }
  })

const syncCategories = async (appSdk) => {
  const listStoreIds = await firestore()
    .collection('sync')
    .doc('category')
    .listCollections()

  console.log('>> Sync Categories: ', listStoreIds.length)
  const promisesStores = []
  listStoreIds?.forEach(async docStore => {
    const storeId = parseInt(docStore.id, 10)
    promisesStores.push(runStore(appSdk, storeId))
  })
  return Promise.all(promisesStores)
    .then(() => {
      console.log('Finish Sync Categories')
    })
}
module.exports = syncCategories
