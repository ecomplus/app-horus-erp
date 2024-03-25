// Firestore collections names
const collectionHorusEvents = 'horusEvents'

// Events Names
const topicProductsHorus = 'products_update'
const topicResourceToEcom = 'resource_to_ecom'

const removeAccents = str => str.replace(/[áàãâÁÀÃÂ]/gi, 'a')
  .replace(/[éêÉÊ]/gi, 'e')
  .replace(/[óõôÓÕÔ]/gi, 'o')
  .replace(/[íÍ]/gi, 'e')
  .replace(/[úÚ]/gi, 'u')
  .replace(/[çÇ]/gi, 'c')

module.exports = {
  removeAccents,
  collectionHorusEvents,
  topicProductsHorus,
  topicResourceToEcom
}
