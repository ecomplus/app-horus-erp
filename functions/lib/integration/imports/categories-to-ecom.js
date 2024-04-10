const ecomUtils = require('@ecomplus/utils')
const { removeAccents } = require('../../utils-variables')
const {
  getResource: getCategory,
  createResource: createCategory
} = require('../../store-api/utils')

module.exports = async ({ appSdk, storeId, auth }, categoriesHorus, opts = {}) => {
  const {
    isCreate
  } = opts
  // metafields.namespace='horus-erp'
  // metafields.field='COD_GENERO'
  // metafields.value=categoriesHorus.codGenero
  const {
    codGenero,
    nomeGenero,
    codAutor,
    nomeAutor
  } = categoriesHorus

  console.log('> Category => ', JSON.stringify(categoriesHorus))

  const name = codGenero ? nomeGenero : nomeAutor
  const body = {
    name,
    slug: removeAccents(name.toLowerCase())
      .replace(/[^a-z0-9-_./]/gi, '_')
  }

  let endpoint = 'categories.json?metafields.namespace=horus-erp'
  if (codGenero) {
    endpoint += `&metafields.field=COD_GENERO&metafields.value=${codGenero}`
    body.metafields = [{
      _id: ecomUtils.randomObjectId(),
      namespace: 'horus-erp',
      field: 'COD_GENERO',
      value: `${codGenero}`
    }]
  } else if (codAutor) {
    endpoint += `&metafields.field=COD_AUTOR&metafields.value=${codAutor}`
    body.metafields = [{
      _id: ecomUtils.randomObjectId(),
      namespace: 'horus-erp',
      field: 'COD_AUTOR',
      value: `${codAutor}`
    }]
  }
  endpoint += '&limit=1'

  const category = await getCategory({ appSdk, storeId, auth }, endpoint)
  if (!category && isCreate) {
    if (codAutor) {
      const categoryAuthors = await getCategory({ appSdk, storeId, auth }, 'categories.json?name=Autores&limit=1')
      if (categoryAuthors) {
        body.parent = {
          _id: categoryAuthors._id,
          name: categoryAuthors.name,
          slug: categoryAuthors.slug
        }
      }
    }
    return createCategory({ appSdk, storeId, auth }, 'categories.json', body)
  }

  return category
}
