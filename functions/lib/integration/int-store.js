const getAppData = require('./../store-api/get-app-data')
const updateAppData = require('../store-api/update-app-data')
const Horus = require('../horus/client')
const { sendMessageTopic } = require('../pub-sub/utils')
const { topicProductsHorus } = require('../utils-variables')

module.exports = async ({ appSdk, storeId, auth }, appData) => {
  const _appData = appData || await getAppData({ appSdk, storeId, auth })
  const { username, password, baseURL, init_store: { cod_item_end: codEnd } } = _appData
  const horus = new Horus(username, password, baseURL)
  const query = `?COD_ITEM_INI=1&COD_ITEM_FIM=${codEnd}`
  let offset = 0
  const limit = 10
  const promisesProducts = []
  const listProducts = []
  while ((offset + limit) <= codEnd) {
    // create Object Horus to request api Horus
    const endpoint = `/Busca_Acervo${query}&offset=${offset}&limit=${limit}`
    promisesProducts.push(
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

  await updateAppData({ appSdk, storeId, auth }, { init_store: { cod_item_end: undefined } })
  await Promise.all(promisesProducts)
  listProducts.forEach((productHorus) => {
    sendMessageTopic(topicProductsHorus, { storeId, productHorus })
  })
}
