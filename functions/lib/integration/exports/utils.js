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

const getClientAddressByZipCode = (horus, customerCodeHorus, zipCode) => {
  const endpoint = `/Busca_EndCliente?COD_CLI=${customerCodeHorus}&CEP=${zipCode || 0}&OFFSET=0&LIMIT=1`

  return requestHorus(horus, endpoint)
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

module.exports = {
  getClientByCustomer,
  getClientAddressByZipCode
}
