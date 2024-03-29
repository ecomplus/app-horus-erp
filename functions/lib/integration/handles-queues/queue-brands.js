const { firestore } = require('firebase-admin')
const getBrands = require('../imports/brands-to-ecom')
const { sendMessageTopic } = require('../../pub-sub/utils')
const { topicResourceToEcom } = require('../../utils-variables')

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
const runStore = (appSdk, storeId) => appSdk.getAuth(storeId)
  .then(async (auth) => {
    const listEditoras = await firestore()
      .collection(`${collectionName}/${storeId}`)
      .listDocuments()

    console.log('>> Sync Brands', storeId, listEditoras.length)
    const promisesSendTopics = []
    let index = 0
    while (index <= listEditoras.length - 1) {
      const docFirestore = listEditoras[index]
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
          if (listProducts.length) {
            listProducts.forEach((docProduct) => {
              promisesProducts.push(
                updateProduct({ appSdk, storeId, auth }, docProduct.id, brand._id)
                  .then(() => {
                    console.log('>> Update Product ', docProduct.id)
                    return docProduct.delete()
                  }).catch(err => {
                    if (err.response?.status === 404) {
                      return docProduct.delete()
                    }
                    throw err
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
      index += 1
    }
  })

const syncBrands = async (appSdk) => {
  const listStoreIds = await firestore()
    .collection('sync')
    .doc('brand')
    .listCollections()

  console.log('>> Sync Brands: ', listStoreIds.length)
  const promisesStores = []
  listStoreIds?.forEach(async docStore => {
    const storeId = parseInt(docStore.id, 10)
    promisesStores.push(runStore(appSdk, storeId))
  })

  return Promise.all(promisesStores)
    .then(() => {
      console.log('Finish Sync Brands')
    })
}

module.exports = syncBrands
