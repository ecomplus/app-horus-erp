const functions = require('firebase-functions')
const { PubSub } = require('@google-cloud/pubsub')

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

    console.log(`>> Topic: ${topicName} MessageId: #${messageId}-s${json?.storeId} - ${json?.resource}`)
  } catch (e) {
    //
  }

  return null
}

module.exports = {
  createEventsFunction,
  getPubSubTopic,
  sendMessageTopic
}
