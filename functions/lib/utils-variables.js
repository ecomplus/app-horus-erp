const { logger } = require('firebase-functions')

// Firestore collections names
const collectionHorusEvents = 'horusEvents'

// Events Names
const topicExportToHorus = 'export_to_horus'
const topicResourceToEcom = 'resource_to_ecom'

const removeAccents = str => str.trim()
  .replace(/[áàãâÁÀÃÂ]/gi, 'a')
  .replace(/[éêÉÊ]/gi, 'e')
  .replace(/[óõôÓÕÔ]/gi, 'o')
  .replace(/[íÍ]/gi, 'i')
  .replace(/[úÚ]/gi, 'u')
  .replace(/[çÇ]/gi, 'c')
  .replace(/[-.]/gi, '')

const debugAxiosError = error => {
  const err = new Error(error.message)
  if (error.response) {
    err.status = error.response.status
    err.response = error.response.data
  }
  err.request = error.config
  logger.error(err, {
    request: error.config,
    response: error.response?.data
  })
}

module.exports = {
  removeAccents,
  collectionHorusEvents,
  topicExportToHorus,
  topicResourceToEcom,
  debugAxiosError
}
