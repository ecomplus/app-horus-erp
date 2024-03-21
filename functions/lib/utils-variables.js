// Firestore collections names
const collectionHorusEvents = 'horusEvents'

// Events Names
const topicProductsHorus = 'products_update'
const topicCustomerHorus = 'customers'

const removeAccents = str => str.replace(/áàãâÁÀÃÂ/g, 'a')
  .replace(/éêÉÊ/g, 'e')
  .replace(/óõôÓÕÔ/g, 'o')
  .replace(/íÍ/g, 'e')
  .replace(/úÚ/g, 'u')
  .replace(/çÇ/g, 'c')

module.exports = {
  removeAccents,
  collectionHorusEvents,
  topicProductsHorus,
  topicCustomerHorus
}
