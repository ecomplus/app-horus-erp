const functions = require('firebase-functions')
const { firestore } = require('firebase-admin')
const { PubSub } = require('@google-cloud/pubsub')

const saveFirestore = (idDoc, body) => firestore()
  .doc(idDoc)
  .set(body, { merge: true })
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
  try {
    const messageId = await new PubSub()
      .topic(topicName)
      .publishMessage({ json })

    let msg = `>> Topic: ${topicName} MessageId: #${messageId}-s${json?.storeId} - `
    msg += `[${json?.resource}] - COD_ITEM: ${json?.objectHorus?.COD_ITEM}`
    console.log(msg)
  } catch (e) {
    console.warn('Error send pub/sub')
    const collectionName = 'pubSubErro'
    return saveFirestore(`${collectionName}/${Date.now()}`, { eventName, json })
  }

  return null
}

module.exports = {
  createEventsFunction,
  getPubSubTopic,
  sendMessageTopic
}
