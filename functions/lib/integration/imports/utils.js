const requestHorus = require('../../horus/request')
const Horus = require('../../horus/client')
const getCategories = require('./categories-to-ecom')

const getHorusAutores = async ({ appSdk, storeId, auth }, codItem, appData, sendSyncCategories) => {
  const {
    username,
    password,
    baseURL
  } = appData
  const horus = new Horus(username, password, baseURL)
  // /Autores_item?COD_ITEM=1&offset=0&limit=100
  let hasRepeat = true
  let offset = 0
  const limit = 100

  const promisesSendTopics = []
  while (hasRepeat) {
    // create Object Horus to request api Horus
    const endpoint = `/Autores_item?COD_ITEM=${codItem}&offset=${offset}&limit=${limit}`
    // console.log('>> endpoint: ', endpoint)
    const autores = await requestHorus(horus, endpoint)
      .catch((err) => {
        if (err.response) {
          console.warn(JSON.stringify(err.response))
        } else {
          console.error(err)
        }
        return null
      })

    if (autores && Array.isArray(autores)) {
      autores.forEach((autor, index) => {
        const {
          COD_AUTOR: codAutor,
          NOM_AUTOR: nomeAutor
        } = autor
        promisesSendTopics.push(
          getCategories({ appSdk, storeId, auth },
            {
              codAutor,
              nomeAutor
            }
          ).then(resp => {
            if (!resp) {
              sendSyncCategories.push({ codAutor, nomeAutor })
            }
            return resp
          })
        )
      })
    } else {
      hasRepeat = false
    }

    offset += limit
  }
  const categories = await Promise.all(promisesSendTopics)
  // console.log('>> categories ', categories)
  return categories
}

const getProductByCodItem = async ({ appSdk, storeId, auth }, codItem) => {
  const endpoint = `products.json?sku=COD_ITEM${codItem}&limit=1`

  return appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
    .then(({ response }) => response.data)
    .then(({ result }) => {
      if (result.length) {
        const endpoint = `products/${result[0]._id}.json`
        return appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
          .then(async ({ response }) => response.data)
      }
      throw new Error('not found')
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

const getHorusKitComposition = async ({ appSdk, storeId, auth }, cod, appData, sendSyncKit) => {
  const {
    username,
    password,
    baseURL
  } = appData
  const horus = new Horus(username, password, baseURL)
  // /Autores_item?COD_ITEM=1&offset=0&limit=100
  let hasRepeat = true
  let offset = 0
  const limit = 100

  const promisesSendTopics = []
  while (hasRepeat) {
    // create Object Horus to request api Horus
    const endpoint = `/Busca_Acervo_kit?COD_ITEM=${cod}&offset=${offset}&limit=${limit}`
    console.log('>> endpoint: ', endpoint)
    const items = await requestHorus(horus, endpoint)
      .catch((err) => {
        if (err.response) {
          console.warn(JSON.stringify(err.response))
        } else {
          console.error(err)
        }
        return null
      })

    if (items && Array.isArray(items)) {
      items.forEach((autor, index) => {
        const {
          COD_ITEM_KIT: codItem,
          NOM_ITEM_KIT: nomeItem
        } = autor
        promisesSendTopics.push(
          getProductByCodItem({ appSdk, storeId, auth }, codItem)
            .then(resp => {
              if (!resp) {
                sendSyncKit.push({ codItem, nomeItem })
              }
              return resp
            })
        )
      })
    } else {
      hasRepeat = false
    }

    offset += limit
  }
  const categories = await Promise.all(promisesSendTopics)
  // console.log('>> categories ', categories)
  return categories
}

module.exports = {
  getHorusAutores,
  getProductByCodItem,
  getHorusKitComposition
}
