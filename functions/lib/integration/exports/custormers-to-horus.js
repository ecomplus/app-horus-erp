const url = require('url')
const { getClientByCustomer } = require('./utils')
const getCustomerById = require('../../store-api/get-resource-by-id')
const Horus = require('../../horus/client')
const requestHorus = require('../../horus/request')
const createAddress = require('./address-to-horus')

module.exports = async ({ appSdk, storeId, auth }, customerId, opts = {}) => {
  const { isCreate, appData, address } = opts
  console.log('> Customer => ', customerId)

  const customer = await getCustomerById({ appSdk, storeId, auth }, 'customers', customerId)
  const logHead = `#${storeId} ${customer._id}`
  if (!customer) {
    console.log(`> Customer #${customerId} not found`)
    return null
  }
  const { username, password, baseURL } = appData
  const horus = new Horus(username, password, baseURL)
  const customerHorus = await getClientByCustomer(storeId, horus, customer)
  if (isCreate) {
  // create/update customer in HORUS
    const method = customerHorus && customerHorus?.COD_CLI ? 'PUT' : 'POST'
    const body = {
      COD_CLI: customerHorus?.COD_CLI || 'NOVO',
      COD_RESPONSAVEL: appData.orders?.responsible?.code || 1,
      NOM_RESP: appData.orders?.responsible?.name || 'ecomplus',
      EMAIL: customer.main_email,
      NOM_REDUZIDO: customer.display_name,
      NOM_CLI: customer.display_name
    }

    if (customer.name) {
      const {
        given_name: fristName,
        middle_name: middleName,
        family_name: lastName
      } = customer.name
      const name = ((fristName ? `${fristName} ` : '') +
            (middleName ? `${middleName} ` : '') +
            (lastName ? `${lastName}` : '')).trim()

      body.NOM_CLI = name
    }

    if (customer.birth_date) {
      const {
        day,
        month,
        year
      } = customer.birth_date

      body.DAT_NASCIMENT = `${day}/${month}/${year}`
    }
    const documentType = customer.registry_type === 'p' ? 'CPF' : 'CNPJ'
    const documentNumber = customer.doc_number

    body.TPO_PESSOA = documentType === 'CPF' ? 'F' : 'J'
    body[documentType] = documentNumber

    if (customer.inscription_type) {
      body[`INS_${customer.inscription_type === 'State' ? 'ESTADUAL' : 'MUNICIPAL'}`] = customer.inscription_number
    }

    if (customer.corporate_name) {
      body.NOM_CONTATO = customer.corporate_name
    }
    const params = new url.URLSearchParams(body)
    const endpoint = `/InsAltCliente?${params.toString()}`
    console.log('>> Insert Client', endpoint, method)

    return requestHorus(horus, endpoint, method)
      .then(async (data) => {
        if (data && data.length) {
          const customerCodeHorus = data[0].Cliente
          if (address) {
            return createAddress(horus, customerCodeHorus, address, true)
              .then(() => customerId)
              .catch(() => null)
          }
          return customerId
        }
        return null
      })
  }
  console.log(`> ${logHead} ignored with don't create or update client`)
  return customerHorus ? customerId : null
}
