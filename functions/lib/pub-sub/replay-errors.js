const { firestore } = require('firebase-admin')

const collectionName = 'pubSubErro'

const replayPubSub = async (appSdk) => {
  const listErrors = await firestore()
    .collection(collectionName)
    .get()

  listErrors.forEach((doc) => {
    // const docRef = doc.ref
    const data = doc.data()
    console.log('>> data: ', JSON.stringify(data))
  })
}
module.exports = replayPubSub
