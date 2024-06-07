const { firestore } = require('firebase-admin')
const { sendMessageTopic } = require('./utils')
const Horus = require('../horus/client')
const checkHorusApi = require('../horus/check-horus-api')

const collectionName = 'queuePubSub'

const replayPubSub = async (_appSdk) => {
  console.log('>> Exec Queue Pub/Sub')
  const listPubSubs = await firestore()
    .collection(collectionName)
    .limit(20)
    .get()
  const promises = []
  let i = 0

  while (i < listPubSubs.docs.length) {
    const doc = listPubSubs.docs[i]
    const docRef = doc.ref
    const { eventName, json } = doc.data()
    let isSendMessage = true
    if (json?.opts?.appData) {
      const {
        exportation,
        importation,
        username,
        password,
        baseURL
      } = json.opts.appData

      if (importation.products) {
        delete importation.products
      }
      if (exportation.orders) {
        delete exportation.orders
      }

      if (username && password && baseURL) {
        console.log('Queue Pub/Sub => check Horus Api')
        const horus = new Horus(username, password, baseURL)
        isSendMessage = await checkHorusApi(horus)
      }
    }
    const run = async () => {
      await docRef.delete()
      return sendMessageTopic(eventName, json)
    }
    if (isSendMessage) {
      promises.push(run())
    }

    i += 1
  }
  return Promise.all(promises)
    .then(() => {
      console.log('>> End Queue Pub/Sub ', promises?.length)
    })
}
module.exports = replayPubSub
