const ecomUtils = require('@ecomplus/utils')
const { removeAccents } = require('../../utils-variables')

const getCategory = ({ appSdk, storeId, auth }, endpoint, isReplay) => {
  return appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
    .then(({ response }) => {
      const { data } = response
      if (data && data.result && data.result.length) {
        return data.result[0]
      }
      return null
    })
    .catch((err) => {
      if (err.response?.status === 404 || err.message === 'not found') {
        return null
      }
      if (!isReplay) {
        setTimeout(() => getCategory({ appSdk, storeId, auth }, endpoint, true))
      } else if (err.response) {
        console.warn(JSON.stringify(err.response))
      } else {
        console.error(err)
      }
      throw err
    })
}

const createCategory = async ({ appSdk, storeId, auth }, endpoint, body) => {
  const data = await appSdk.apiRequest(storeId, endpoint, 'POST', body, auth)
    .then(({ response }) => response.data)
    .catch((err) => {
      console.error(err)
      return null
    })

  return data ? { _id: data._id, name: body.name } : data
}

module.exports = async ({ appSdk, storeId, auth }, categoriesHorus, isCreate) => {
  // metafields.namespace='horus-erp'
  // metafields.field='COD_GENERO'
  // metafields.value=categoriesHorus.codGenero
  const {
    codGenero,
    nomeGenero,
    codAutor,
    nomeAutor
  } = categoriesHorus

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
