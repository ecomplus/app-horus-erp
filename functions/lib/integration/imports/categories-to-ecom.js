module.exports = async ({ appSdk, storeId, auth }, categoriesHorus) => {
  // metafields.namespace='horus-erp'
  // metafields.field='COD_GENERO'
  // metafields.value=categoriesHorus.codGenero
  const {
    codGenero,
    nomeGenero
  } = categoriesHorus

  let endpoint = '/categories.json?metafields.namespace=horus-erp' +
    `&metafields.field=COD_GENERO&metafields.value=${codGenero}&limit=1`

  let data = await appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
    .then(({ response }) => response.data)
    .catch((err) => {
      console.error(err)
      if (err.response?.status === 404) {
        return null
      }
      throw err
    })

  if (data) {
    if (data.result && data.result.length) {
      return data.result[0]
    }
  }
  const body = {
    name: nomeGenero,
    metafields: [
      {
        namespace: 'horus-erp',
        field: 'COD_GENERO',
        value: codGenero
      }
    ]

  }

  endpoint = '/categories.json'
  data = await appSdk.apiRequest(storeId, endpoint, 'POST', body, auth)
    .then(({ response }) => response.data)
    .catch((err) => {
      console.error(err)
      return null
    })

  return data ? { _id: data._id, name: nomeGenero } : data
}
