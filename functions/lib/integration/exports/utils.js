const { firestore } = require('firebase-admin')
const requestHorus = require('../../horus/request')
const { sendMessageTopic } = require('../../pub-sub/utils')
const { topicExportToHorus } = require('../../utils-variables')

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
        console.warn(JSON.stringify(err.response?.data))
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
        console.warn(JSON.stringify(err.response?.data))
      } else {
        console.error(err)
      }
      return null
    })
}

const saveAndSendExportOrderToHorus = async (storeId, orderId, appData, options) => {
  const body = {
    storeId,
    resource: 'orders',
    resourceId: orderId,
    created_at: new Date().toISOString()
  }

  return firestore()
    .doc(`sync/${storeId}/orders/${orderId}`)
    .set(body, { merge: true })
    .then(() => {
      const opts = {
        appData,
        isUpdateDate: false,
        ...options
      }
      return sendMessageTopic(topicExportToHorus, { ...body, opts })
    })
    // .catch(console.error)
}

module.exports = {
  getClientByCustomer,
  getClientAddressByZipCode,
  saveAndSendExportOrderToHorus
}
