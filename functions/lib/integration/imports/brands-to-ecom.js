const ecomUtils = require('@ecomplus/utils')
const { removeAccents } = require('../../utils-variables')

module.exports = async ({ appSdk, storeId, auth }, brandHorus) => {
  // metafields.namespace='horus-erp'
  // metafields.field='COD_EDITORA' || autor
  // metafields.value=categoriesHorus.COD_EDITORA || autor

  const {
    codEditora,
    nomeEditora
  } = brandHorus

  let endpoint = 'brands.json?metafields.namespace=horus-erp'
  if (codEditora) {
    endpoint += `&metafields.field=COD_EDITORA&metafields.value=${codEditora}`
  }
  endpoint += '&limit=1'

  const body = {
    name: nomeEditora,
    slug: removeAccents((nomeEditora).toLowerCase())
      .replace(/[^a-z0-9-_./]/gi, '_'),
    metafields: [
      {
        _id: ecomUtils.randomObjectId(),
        namespace: 'horus-erp',
        field: 'COD_EDITORA',
        value: `${codEditora}`
      }
    ]
  }

  if (codEditora) {
    const brands = await appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
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

    if (brands) {
      if (brands.result && brands.result.length) {
        return brands.result[0]
      }
    }

    endpoint = 'brands.json'
    const data = await appSdk.apiRequest(storeId, endpoint, 'POST', body, auth)
      .then(({ response }) => response.data)
      .catch((err) => {
        console.error(err)
        return null
      })

    return data ? { _id: data._id, name: nomeEditora } : data
  }
  return null
}
