const ecomUtils = require('@ecomplus/utils')

module.exports = async ({ appSdk, storeId, auth }, categoriesHorus) => {
  // metafields.namespace='horus-erp'
  // metafields.field='COD_GENERO'
  // metafields.value=categoriesHorus.codGenero
  const {
    codGenero,
    nomeGenero
  } = categoriesHorus

  let endpoint = 'categories.json?metafields.namespace=horus-erp' +
    `&metafields.field=COD_GENERO&metafields.value=${codGenero}&limit=1`

  const category = await appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
    .then(({ response }) => response.data)
    .catch((err) => {
      if (err.response?.status === 404 || err.message === 'not found') {
        return null
      }
      if (err.response) {
        console.warn(JSON.stringify(err.response))
      } else {
        console.error(err)
      }
      throw err
    })

  if (category) {
    if (category.result && category.result.length) {
      return category.result[0]
    }
  }
  const body = {
    name: nomeGenero,
    metafields: [
      {
        _id: ecomUtils.randomObjectId(),
        namespace: 'horus-erp',
        field: 'COD_GENERO',
        value: `${codGenero}`
      }
    ]

  }

  endpoint = 'categories.json'
  const data = await appSdk.apiRequest(storeId, endpoint, 'POST', body, auth)
    .then(({ response }) => response.data)
    .catch((err) => {
      console.error(err)
      return null
    })

  return data ? { _id: data._id, name: nomeGenero } : data
}
