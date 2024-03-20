const getAppData = require('./../store-api/get-app-data')
const Horus = require('../horus/client')
const { sendMessageTopic } = require('../pub-sub/utils')
const { topicProductsHorus } = require('../utils-variables')

module.exports = async ({ appSdk, storeId, auth }) => {
  const appData = await getAppData({ appSdk, storeId, auth })
  console.log('>> ', appData)
  const { username, password, baseURL, cod_item_end: codEnd } = appData
  const horus = new Horus(username, password, baseURL)
  const query = `?COD_ITEM_INI=1&COD_ITEM_FIM=${codEnd}`
  console.log('>> Query ', query)
  let offset = 0
  const limit = 10
  const promises = []
  const listProducts = []
  while ((offset + limit) < codEnd) {
    // create Object Horus to request api Horus
    const endpoint = `/Busca_Acervo${query}&offset=${offset}&limit=${limit}`
    promises.push(
      horus.get(endpoint)
        .then(({ data }) => {
          if (data.length) {
            listProducts.push(...data)
          }
        })
        .catch(console.error)
    )
    offset += limit
  }

  await Promise.all(promises)
  listProducts.forEach((productHorus) => {
    sendMessageTopic(topicProductsHorus, { storeId, productHorus })
  })
}
