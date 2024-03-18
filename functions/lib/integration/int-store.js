const getAppData = require('./../store-api/get-app-data')
const Horus = require('../horus/client')
const { sendMessageTopic } = require('./pub-sub/utils')
const { topicUpdateProductsPrice } = require('./utils-variables')

module.exports = async ({ appSdk, storeId, auth }) => {
  const appData = await getAppData({ appSdk, storeId, auth })
  console.log('>> ', appData)
  const { username, password, baseURL } = appData
  const horus = new Horus(username, password, baseURL)
  // create Object Horus to request api Horus
  const { data: listProducts } = await horus.get('/Busca_Acervo')
  listProducts.forEach((productHorus) => {
    sendMessageTopic(topicUpdateProductsPrice, { storeId, productHorus })
  })
}
