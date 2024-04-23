const { firestore } = require('firebase-admin')
const { sendMessageTopic } = require('./utils')

const collectionName = 'queuePubSub'

const replayPubSub = async (_appSdk) => {
  console.log('>> Exec Queue Pub/Sub')
  const listPubSubs = await firestore()
    .collection(collectionName)
    .limit(10)
    .get()
  const promises = []
  listPubSubs.forEach((doc) => {
    const docRef = doc.ref
    const { eventName, json } = doc.data()
    const run = async () => {
      await docRef.delete()
      return sendMessageTopic(eventName, json)
    }
    promises.push(run())
  })
  return Promise.all(promises)
    .then(() => {
      console.log('>> End Queue Pub/Sub ', promises?.length)
    })
}
module.exports = replayPubSub
