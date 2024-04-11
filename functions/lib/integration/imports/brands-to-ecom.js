const ecomUtils = require('@ecomplus/utils')
const { removeAccents } = require('../../utils-variables')
const {
  getResource: getBrands,
  createResource: createBrands
} = require('../../store-api/utils')

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

  // console.log('> Brand => ', JSON.stringify(brandHorus))

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

  const brand = await getBrands({ appSdk, storeId, auth }, endpoint)

  if (!brand && isCreate) {
    return createBrands({ appSdk, storeId, auth }, 'brands.json', body)
  }
  return brand
}
