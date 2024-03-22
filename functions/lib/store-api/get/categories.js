const ecomUtils = require('@ecomplus/utils')
const { removeAccents } = require('../../utils-variables')
const { sendMessageTopic } = require('../../pub-sub/utils')
const { topicResourceToEcom } = require('../../utils-variables')

module.exports = async ({ appSdk, storeId, auth }, categoriesHorus, isSendCreate) => {
  // metafields.namespace='horus-erp'
  // metafields.field='COD_GENERO'
  // metafields.value=categoriesHorus.codGenero
  const {
    codGenero,
    nomeGenero
  } = categoriesHorus

  const body = {
    name: nomeGenero,
    slug: removeAccents(nomeGenero.toLowerCase())
      .replace(/[^a-z0-9-_./]/gi, '_'),
    metafields: [
      {
        _id: ecomUtils.randomObjectId(),
        namespace: 'horus-erp',
        field: 'COD_GENERO',
        value: `${codGenero}`
      }
    ]

  }

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

  if (isSendCreate) {
    endpoint = 'categories.json'
    sendMessageTopic(topicResourceToEcom, { storeId, endpoint, method: 'POST', body })
  }

  return null
}
