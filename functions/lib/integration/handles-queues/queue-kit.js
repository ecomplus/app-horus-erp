const { firestore } = require('firebase-admin')
const getAppData = require('../../store-api/get-app-data')
const {
  getProductByCodItem,
  getItemHorusAndSendProductToImport
} = require('../imports/utils')

const updateProduct = async ({ appSdk, storeId, auth }, endpoint, method, body) => {
  await appSdk.apiRequest(storeId, endpoint, method, body, auth)
    .then(({ response }) => response.data)
}

const getDoc = (doc) => new Promise((resolve) => {
  doc?.onSnapshot(data => {
    resolve(data)
  })
})
/*
  Idea: read the Firestore documents, browse the stores, browse the products (kit) already created,
  for each product (kit), look for its other items, check if they are all already created in the API,
  if yes, update the product (kit) like the other items and update it to 'available: true',
  if there is non-existing item , search for the item in horus-erp,
  and send it to pub/sub to be able to import it into the API
*/

const collectionName = 'sync/kit'
const runStore = (appSdk, storeId) => appSdk.getAuth(storeId)
  .then(async (auth) => {
    const listProducts = await firestore()
      .collection(`${collectionName}/${storeId}`)
      .listDocuments()

    console.log('>> Sync Kit', storeId, listProducts.length)
    const promisesProducts = []
    let index = 0
    while (index <= listProducts.length - 1) {
      const docFirestore = listProducts[index]
      // const docId = docFirestore.id
      const doc = await getDoc(docFirestore)
      const { items, productId } = doc.data()
      // console.log('>> ', JSON.stringify(items), docId, productId)
      const promises = []
      const promisesSendProduct = []
      try {
        const appData = await getAppData({ appSdk, storeId, auth })
        items.forEach((item) => {
          promises.push(
            getProductByCodItem({ appSdk, storeId, auth }, item.codItem)
              .then((data) => {
                return { _id: data._id }
              })
              .catch(() => {
                promisesSendProduct.push(
                  getItemHorusAndSendProductToImport(storeId, item.codItem, appData)
                )
              })
          )
        })
        const products = await Promise.all(promises)
        if (promisesSendProduct.length) {
          await Promise.all(promisesSendProduct)
        } else {
          // update products
          products.forEach(product => {
            if (product._id) {
              const endpoint = `/products/${productId}/kit_composition.json`
              const body = { _id: product._id, quantity: 1 }
              promisesProducts.push(
                updateProduct({ appSdk, storeId, auth }, endpoint, 'POST', body)
                  .catch(err => {
                    throw err
                  })
              )
            }
          })
        }
        if (promisesProducts.length) {
          // TODO: checar pq não está atualizando
          await Promise.all(promisesProducts)
            .then(async () => {
              console.log('>> Update')
              const endpoint = `/products/${productId}.json`
              await updateProduct({ appSdk, storeId, auth }, endpoint, 'PATCH', { available: true })
                .then(() => {
                  console.log('>> Update Product ', docFirestore.id)
                  return docFirestore.delete()
                }).catch(err => {
                  if (err.response?.status === 404) {
                    return docFirestore.delete()
                  }
                  console.error(err)
                  throw err
                })
            })
        }
      } catch (e) {
        console.log('> Error in ', JSON.stringify(doc))
        console.error(e)
      }
      index += 1
    }
  })

const syncKit = async (appSdk) => {
  const listStoreIds = await firestore()
    .collection('sync')
    .doc('kit')
    .listCollections()

  console.log('>> Sync Kit: ', listStoreIds.length)
  const promisesStores = []
  listStoreIds?.forEach(async docStore => {
    const storeId = parseInt(docStore.id, 10)
    promisesStores.push(runStore(appSdk, storeId))
  })
  return Promise.all(promisesStores)
    .then(() => {
      console.log('Finish Sync Kit')
    })
}
module.exports = syncKit
