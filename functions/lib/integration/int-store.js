/*
const getAppData = require('./../store-api/get-app-data')
// const updateAppData = require('../store-api/update-app-data')
const Horus = require('../horus/client')
// const { sendMessageTopic } = require('../pub-sub/utils')
// const { topicProductsHorus } = require('../utils-variables')
const handler = {
  categories: require('./imports/categories-to-ecom')
}

const requestGetHorus = (horus, endpoint, isRetry) => new Promise((resolve, reject) => {
  horus.get(endpoint)
    .then((resp) => {
      const { data } = resp
      if (data && data.length && !data[0].Mensagem) {
        resolve(data)
      }
      resolve(null)
    })
    .catch((err) => {
      if (!isRetry) {
        setTimeout(() => requestGetHorus(horus, endpoint, true), 1000)
      }
      reject(err)
    })
})

// const importGeneros = async ({ appSdk, storeId, auth }, horus) => {
//   let hasRepeat = true
//   let offset = 0
//   const limit = 100

//   const promisesImportCategories = []
//   while (hasRepeat) {
//     // create Object Horus to request api Horus
//     const endpoint = `/Arvore_generos?offset=${offset}&limit=${limit}`
//     const generos = await requestGetHorus(horus, endpoint)
//       .catch((err) => {
//         if (err.response) {
//           console.warn(JSON.stringify(err.response))
//         } else {
//           console.error(err)
//         }
//         return null
//       })

//     if (generos && Array.isArray(generos)) {
//       generos.forEach((genero, index) => {
//         const {
//           COD_GENERO: codGenero,
//           NOM_GENERO: nomeGenero
//         } = genero
//         promisesImportCategories.push(
//           handler.categories({ appSdk, storeId, auth }, { codGenero, nomeGenero })
//         )
//       })
//     } else {
//       hasRepeat = false
//     }

//     offset += limit
//   }
//   await Promise.all(promisesImportCategories)
// }

module.exports = async ({ appSdk, storeId, auth }, appData) => {
  const _appData = appData || await getAppData({ appSdk, storeId, auth })
  const { username, password, baseURL, init_store: { cod_item_end: codEnd } } = _appData
  const horus = new Horus(username, password, baseURL)
  // importGeneros({ appSdk, storeId, auth }, horus)
}
*/
