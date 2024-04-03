const requestHorus = require('../../horus/request')
// const Horus = require('../../horus/client')

const getClientByCustomer = (storeId, horus, customer) => {
  const logHead = `#${storeId} ${customer._id}`
  const documentType = customer.registry_type === 'p' ? 'CPF' : 'CNPJ'
  const documentNumber = customer.doc_number
  let queryHorus = '/Busca_Cliente'
  if (!documentNumber || !documentType) {
    console.log(`> ${logHead} skipped with no document`)
    return null
  }
  queryHorus += `?${documentType}=${documentNumber}&OFFSET=0&LIMIT=1`

  return requestHorus(horus, queryHorus)
    .then((data) => {
      return data && data.length ? data[0] : null
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

// const findTransportCompany = async (horus, companyCode, subsidiaryCode) => {
//   let hasRepeat = true
//   let offset = 0
//   const limit = 100

//   const promisesSendTopics = []
//   while (hasRepeat) {
//     // create Object Horus to request api Horus
//     // const endpoint = `/Busca_Acervo_kit?COD_ITEM=${cod}&offset=${offset}&limit=${limit}`
//     const endpoint = `Busca_Transportadora?COD_EMPRESA=${companyCode}&COD_FILIAL=${subsidiaryCode}` +
//       `&OFFSET=${offset}&LIMIT=${limit}`

//     // console.log('>> endpoint: ', endpoint)
//     const items = await requestHorus(horus, endpoint)
//       .catch((err) => {
//         if (err.response) {
//           console.warn(JSON.stringify(err.response))
//         } else {
//           console.error(err)
//         }
//         return null
//       })
//     if (items && Array.isArray(items)) {
//       //
//     } else {
//       hasRepeat = false
//     }
//     offset += limit
//   }
// }

module.exports = {
  getClientByCustomer
}
