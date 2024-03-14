// const getAppData = require('../../store-api/get-app-data')
// const Horus = require('../horus/client')

module.exports = async ({ appSdk, storeId, auth }, productHorus) => {
  const endpoint = '/products.json' +
    '?hidden_metafields.namespace=horus-erp&hidden_metafields.field=COD_ITEM' +
    `hidden_metafields.value${productHorus.COD_ITEM}&limit=1`

  const product = await appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
    .then(({ response }) => response.data)
    .then(({ result }) => {
      const endpoint = `/products/${result[0]._id}.json`
      return appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
        .then(async ({ response }) => response.data)
    })
    .catch((err) => {
      console.error(err)
      if (err.response.status === 404) {
        return null
      }
      throw err
    })

  if (product) {
    const { VLR_CAPA } = productHorus
    const price = parseFloat(VLR_CAPA)
    if (price !== product.price) {
      const endpoint = `/products/${product._id}.json`
      const body = {
        price
      }
      return appSdk.apiRequest(storeId, endpoint, 'PATCH', body, auth)
    }
    return null
  } else {
    // new product
    return null
  }
}
