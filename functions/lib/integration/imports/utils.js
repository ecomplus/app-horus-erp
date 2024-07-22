const requestHorus = require('../../horus/request')
const Horus = require('../../horus/client')
const getCategories = require('./categories-to-ecom')
const { sendMessageTopic } = require('../../pub-sub/utils')
const { topicResourceToEcom } = require('../../utils-variables')

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
  const limit = 50

  const promisesSendTopics = []
  while (hasRepeat) {
    // create Object Horus to request api Horus
    const endpoint = `/Autores_item?COD_ITEM=${codItem}&offset=${offset}&limit=${limit}`
    // console.log('>> endpoint: ', endpoint)
    const autores = await requestHorus(horus, endpoint)
      .catch((err) => {
        if (err.response) {
          console.warn(JSON.stringify(err.response?.data))
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
    .catch((_err) => {
      // if (err.response) {
      //   console.warn(JSON.stringify(err.response?.data))
      // } else {
      //   console.error(err)
      // }
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
  const limit = 50

  const promisesSendTopics = []
  while (hasRepeat) {
    // create Object Horus to request api Horus
    const endpoint = `/Busca_Acervo_kit?COD_ITEM=${cod}&offset=${offset}&limit=${limit}`
    // console.log('>> endpoint: ', endpoint)
    const items = await requestHorus(horus, endpoint)
      .catch((err) => {
        if (err.response) {
          console.warn(JSON.stringify(err.response?.data))
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

const getItemHorusAndSendProductToImport = async (storeId, codItem, appData, options) => {
  const {
    username,
    password,
    baseURL
  } = appData
  const endpoint = `/Busca_Acervo?COD_ITEM=${codItem}&offset=0&limit=1`
  const horus = new Horus(username, password, baseURL)
  const item = await requestHorus(horus, endpoint, 'get')
    .catch((err) => {
      if (err.response) {
        console.warn(JSON.stringify(err.response?.data))
      } else {
        console.error(err)
      }
      return null
    })

  // console.log('>> item', JSON.stringify(item))

  const opts = {
    appData,
    isUpdateDate: false,
    ...options
  }
  // console.log('>> opts', JSON.stringify(opts))
  return sendMessageTopic(
    topicResourceToEcom,
    {
      storeId,
      resource: 'products',
      objectHorus: item && item.length && item[0],
      opts
    })
}

const getAllItemsHorusToImport = async (horus, storeId, opts) => {
  let hasRepeat = true
  let offset = 0
  const limit = 50

  const init = Date.now()
  const listItemsToImport = []
  const codCaract = opts?.appData?.code_characteristic || 5
  const codTpoCaract = opts?.appData?.code_type_characteristic || 3

  let baseEndpoint = ''
  baseEndpoint = `/Busca_Caracteristicas?COD_TPO_CARACT=${codTpoCaract}` +
  `&COD_CARACT=${codCaract}`

  while (hasRepeat) {
    // create Object Horus to request api Horus
    const endpoint = `${baseEndpoint}&offset=${offset}&limit=${limit}`
    const items = await requestHorus(horus, endpoint, 'get', true)
      .catch((_err) => {
        // if (err.response) {
        //   console.warn(JSON.stringify(err.response?.data))
        // } else {
        //   console.error(err)
        // }
        return null
      })

    if (items && items.length) {
      hasRepeat = items?.length === limit

      items.forEach((productHorus, index) => {
        listItemsToImport.push(productHorus.COD_ITEM)
      })
      const now = Date.now()
      const time = now - init
      if (time >= 20000) {
        console.log('>> time stop', offset)
        hasRepeat = false
      }
    } else {
      hasRepeat = false
    }

    offset += limit
  }

  return listItemsToImport
}

module.exports = {
  getHorusAutores,
  getProductByCodItem,
  getHorusKitComposition,
  getItemHorusAndSendProductToImport,
  getAllItemsHorusToImport
}
