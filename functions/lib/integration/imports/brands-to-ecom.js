const ecomUtils = require('@ecomplus/utils')
const { removeAccents } = require('../../utils-variables')

const getBrand = ({ appSdk, storeId, auth }, endpoint, isReplay) => {
  return appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
    .then(({ response }) => {
      const { data } = response
      if (data && data.result && data.result.length) {
        return data.result[0]
      }
      return null
    })
    .catch((err) => {
      if (err.response) {
        console.warn(JSON.stringify(err.response))
      } else {
        console.error(err)
      }
      return null
    })
}

const createBrands = async ({ appSdk, storeId, auth }, endpoint, body) => {
  const data = await appSdk.apiRequest(storeId, endpoint, 'POST', body, auth)
    .then(({ response }) => response.data)
    .catch((err) => {
      if (err.response) {
        console.warn(JSON.stringify(err.response))
      } else {
        console.error(err)
      }
      return null
    })

  return data ? { _id: data._id, name: body.name } : data
}

module.exports = async ({ appSdk, storeId, auth }, brandHorus, opts = {}) => {
  const {
    isCreate
  } = opts
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

  const brand = await getBrand({ appSdk, storeId, auth }, endpoint)

  if (!brand && isCreate) {
    return createBrands({}, 'brands.json', body)
  }
  return brand
}
