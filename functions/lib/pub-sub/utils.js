const functions = require('firebase-functions')
const { firestore } = require('firebase-admin')
const { PubSub } = require('@google-cloud/pubsub')

const saveFirestore = (idDoc, body) => firestore()
  .doc(idDoc)
  .set(body, { merge: true })
  // .then(() => { console.log('Save in firestore') })
  .catch(console.error)

const getPubSubTopic = (eventName) => {
  return `${eventName}_events`
}

const createPubSubFunction = (
  pubSubTopic,
  fn,
  eventMaxAgeMs = 60000
) => {
  return functions
    .runWith({ failurePolicy: true })
    .pubsub.topic(pubSubTopic).onPublish((message, context) => {
      const eventAgeMs = Date.now() - Date.parse(context.timestamp)
      if (eventAgeMs > eventMaxAgeMs) {
        console.warn(`Dropping event ${context.eventId} with age[ms]: ${eventAgeMs}`)
        return
      }
      return fn(message.json, context, message)
    })
}

const createEventsFunction = (
  eventName,
  fn,
  eventMaxAgeMs = 58000
) => {
  const topicName = getPubSubTopic(eventName)
  return createPubSubFunction(topicName, fn, eventMaxAgeMs)
}

const sendMessageTopic = async (eventName, json) => {
  const topicName = getPubSubTopic(eventName)
  json.eventName = eventName
  let isSend = true
  const isProductOrOrders = json?.resource === 'orders' || json?.resource === 'products'
  let docId
  if (isProductOrOrders) {
    // isSend
    const resourceId = json?.objectHorus?.COD_ITEM
      ? `COD_ITEM${json?.objectHorus?.COD_ITEM}`
      : json?.resourceId

    docId = `queue/${json?.storeId}_${json?.resource}_${resourceId}`
    const docRef = firestore().doc(docId)
    const docSnapshot = await docRef.get()

    // check in queue if doc exists
    if (docSnapshot.exists) {
      isSend = false
    }
  }
  if (isSend) {
    try {
      const messageId = await new PubSub()
        .topic(topicName)
        .publishMessage({ json })

      let msg = `>> Topic: ${topicName} MessageId: #${messageId}-s${json?.storeId} - `
      msg += `[${json?.resource}]`

      if (json?.objectHorus?.COD_ITEM) {
        msg += ` COD_ITEM: ${json?.objectHorus?.COD_ITEM}`
      } else if (json?.objectHorus) {
        let resource
        if (json.objectHorus.codGenero) {
          resource = 'codGenero'
        } else if (json.objectHorus.codAutor) {
          resource = 'codAutor'
        } else if (json.objectHorus.codEditora) {
          resource = 'codEditora'
        }
        if (resource) {
          msg += ` ${resource}: ${json.objectHorus[resource]}`
        } else {
          msg += ` ${JSON.stringify(json.objectHorus)}`
        }
      } else if (json.resourceId) {
        msg += ` ${json.resourceId}`
      }
      console.log(msg)

      // queue to resource
      if (isProductOrOrders && docId) {
        return saveFirestore(docId, { updated_at: new Date().toISOString() })
      }
    } catch (e) {
      if (json?.objectHorus?.COD_ITEM || json?.resource === 'orders') {
        console.warn('Error send pub/sub')
        const collectionName = 'pubSubErro'
        return saveFirestore(`${collectionName}/${Date.now()}`, { eventName, json })
      }
    }
  }

  return null
}

module.exports = {
  createEventsFunction,
  getPubSubTopic,
  sendMessageTopic,
  saveFirestore
}
