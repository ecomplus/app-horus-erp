const getAppData = require('./../store-api/get-app-data')
const Horus = require('../horus/client')

module.exports = async ({ appSdk, storeId, auth }) => {
  const appData = await getAppData({ appSdk, storeId, auth })
  console.log('>> ', appData)
  const { username, password, baseURL } = appData
  const horus = new Horus(username, password, baseURL)
  // create Object Horus to request api Horus
  const { data: listProducts } = await horus.get('/Busca_Acervo')
  console.log('>> ', listProducts)
  // findProduct in storeApi by hidden_metafield? or name? or not find product and create product
}
