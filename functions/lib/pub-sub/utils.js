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
  eventMaxAgeMs = 60000,
  execOptions = {}
) => {
  return functions
    .runWith({ failurePolicy: true, ...execOptions })
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
  eventMaxAgeMs = 58000,
  execOptions
) => {
  const topicName = getPubSubTopic(eventName)
  return createPubSubFunction(topicName, fn, eventMaxAgeMs, execOptions)
}

const sendMessageTopic = async (eventName, json) => {
  const topicName = getPubSubTopic(eventName)
  json.eventName = eventName
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
  } catch (e) {
    console.warn('Error send pub/sub')
    const collectionName = 'queuePubSub'
    return saveFirestore(`${collectionName}/${Date.now()}`, { eventName, json })
  }

  return null
}

module.exports = {
  createEventsFunction,
  getPubSubTopic,
  sendMessageTopic,
  saveFirestore
}
