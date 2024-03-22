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
  eventMaxAgeMs = 60000
) => {
  const topicName = getPubSubTopic(eventName)
  return createPubSubFunction(topicName, fn, eventMaxAgeMs)
}

const sendMessageTopic = async (eventName, json) => {
  const topicName = getPubSubTopic(eventName)
  console.log('>> Send msg: ', eventName, ' ', JSON.stringify(json))
  return new PubSub()
    .topic(topicName)
    .publishMessage({ json })
    .then((messageId) => {
      console.log('>> MessageId: ', messageId, '-s', json?.storeId, ' Topic: ', topicName)
    })
    .catch(err => console.error('E: ', err))
}

module.exports = {
  createEventsFunction,
  getPubSubTopic,
  sendMessageTopic
}
