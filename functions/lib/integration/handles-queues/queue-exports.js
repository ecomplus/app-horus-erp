const { firestore } = require('firebase-admin')
// const getAppData = require('../../store-api/get-app-data')
// const { sendMessageTopic } = require('../../pub-sub/utils')
// const { topicExportToHorus } = require('../../utils-variables')
// const {
//   getProductByCodItem,
//   getItemHorusAndSendProductToImport
// } = require('../imports/utils')

const getDoc = (doc) => new Promise((resolve) => {
  doc?.onSnapshot(data => {
    resolve(data)
  })
})

const runStore = async ({ appSdk, storeId, auth }, collectionName) => {
  const listObjects = await firestore()
    .collection(`${collectionName}`)
    .listDocuments()

  console.log('>> Sync export ', storeId, listObjects.length)
  const promisesResources = []
  // const appData = await getAppData({ appSdk, storeId, auth })
  // const opts = {
  //   appData
  // }

  let index = 0
  while (index <= listObjects.length - 1) {
    const docFirestore = listObjects[index]
    // const docId = docFirestore.id
    const doc = await getDoc(docFirestore)
    const { resource, resourceId } = doc.data()
    const body = {
      storeId,
      resource,
      resourceId
      // opts
    }
    console.log('>> ', JSON.stringify(body))
    // TODO:
    // promisesResources.push(
    //   sendMessageTopic(topicExportToHorus, body)
    // )

    index += 1
  }

  return Promise.all(promisesResources)
}

const syncExportsToHorus = async ({ appSdk, storeId, auth }, collectionName) => {
  return runStore({ appSdk, storeId, auth }, collectionName)
    .then(() => {
      console.log(`Finish ${collectionName}`)
    })
}
module.exports = syncExportsToHorus
