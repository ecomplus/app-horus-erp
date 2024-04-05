// Firestore collections names
const collectionHorusEvents = 'horusEvents'

// Events Names
const topicExportToHorus = 'export_to_horus'
const topicResourceToEcom = 'resource_to_ecom'

const removeAccents = str => str.replace(/[áàãâÁÀÃÂ]/gi, 'a')
  .replace(/[éêÉÊ]/gi, 'e')
  .replace(/[óõôÓÕÔ]/gi, 'o')
  .replace(/[íÍ]/gi, 'i')
  .replace(/[úÚ]/gi, 'u')
  .replace(/[çÇ]/gi, 'c')
  .replace(/[-.]/gi, '')

module.exports = {
  removeAccents,
  collectionHorusEvents,
  topicExportToHorus,
  topicResourceToEcom
}
