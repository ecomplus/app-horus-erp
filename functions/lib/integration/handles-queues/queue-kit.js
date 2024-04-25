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

const runStore = async ({ appSdk, storeId, auth }, collectionName) => {
  const listProducts = await firestore()
    .collection(`${collectionName}`)
    .listDocuments()

  console.log('>> Sync Kit', storeId, listProducts.length)
  const addProductToKit = []
  let index = 0
  while (index <= listProducts.length - 1) {
    const docFirestore = listProducts[index]
    const doc = await getDoc(docFirestore)
    const { items, productId } = doc.data()
    const promises = []
    const createProducts = []
    try {
      const appData = await getAppData({ appSdk, storeId, auth })
      items.forEach((item) => {
        promises.push(
          // checks whether all products in the kit have already been registered
          getProductByCodItem({ appSdk, storeId, auth }, item.codItem)
            .then((data) => {
              return { _id: data._id }
            })
            .catch(() => {
              createProducts.push(
                // If product not registered, send pub/sub to register
                getItemHorusAndSendProductToImport(storeId, item.codItem, appData)
              )
            })
        )
      })
      // parallel checks
      const kitProducts = await Promise.all(promises)

      // if there is a single product to be created, send the pub/sub
      if (createProducts.length) {
        await Promise.all(createProducts)
      } else {
        kitProducts.forEach(product => {
          if (product._id) {
            const endpoint = `/products/${productId}/kit_composition.json`
            const body = { _id: product._id, quantity: 1 }
            addProductToKit.push(
              updateProduct({ appSdk, storeId, auth }, endpoint, 'POST', body)
                .catch(err => {
                  throw err
                })
            )
          }
        })
      }
      if (addProductToKit.length) {
        await Promise.all(addProductToKit)
          .then(async () => {
            // upgrade kit for available
            const endpoint = `/products/${productId}.json`
            await updateProduct({ appSdk, storeId, auth }, endpoint, 'PATCH', { available: true })
              .then(() => {
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
    } catch (err) {
      console.log('> Error in ', JSON.stringify(doc))
      // console.error(e)
    }
    index += 1
  }
}

const syncKit = async ({ appSdk, storeId, auth }, collectionName) => {
  return runStore({ appSdk, storeId, auth }, collectionName)
    .then(() => {
      console.log('Finish Sync Kit')
    })
}
module.exports = syncKit
