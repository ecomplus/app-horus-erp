const url = require('url')
const { getClientByCustomer } = require('./utils')
const getCustomerById = require('../../store-api/get-resource-by-id')
const Horus = require('../../horus/client')
const requestHorus = require('../../horus/request')
const createAddress = require('./address-to-horus')

module.exports = async ({ appSdk, storeId, auth }, customerId, opts = {}) => {
  const { isCreate, appData, address } = opts
  console.log(`> Customer => ${customerId} opts: ${JSON.stringify(opts)}`)

  const customer = await getCustomerById({ appSdk, storeId, auth }, 'customers', customerId)
  const logHead = `#${storeId} ${customer._id}`
  if (!customer) {
    console.log(`> Customer #${customerId} not found`)
    return null
  }
  const documentType = customer.registry_type === 'p' ? 'CPF' : 'CNPJ'
  const documentNumber = customer.doc_number
  let customerHorus

  if (isCreate && documentNumber && documentType) {
    const { username, password, baseURL } = appData
    const horus = new Horus(username, password, baseURL)
    customerHorus = await getClientByCustomer(storeId, horus, customer)
    // console.log(`customer: ${customerHorus && JSON.stringify(customerHorus)}`)
    // create/update customer in HORUS
    const method = customerHorus && customerHorus?.COD_CLI ? 'PUT' : 'POST'
    const body = {
      COD_CLI: customerHorus?.COD_CLI || 'NOVO',
      COD_RESPONSAVEL: appData.customers?.responsible_code || 1,
      NOM_RESP: appData.customers?.responsible_name || 'ecomplus',
      EMAIL: customer.main_email,
      NOM_REDUZIDO: customer.display_name,
      NOM_CLI: customer.display_name
    }

    if (customer.name) {
      const fristName = customer.name?.given_name
      const middleName = customer.name?.middle_name
      const lastName = customer.name?.family_name

      const name = ((fristName ? `${fristName} ` : '') +
            (middleName ? `${middleName} ` : '') +
            (lastName ? `${lastName}` : '')).trim()

      body.NOM_CLI = name.toUpperCase() // store 51504 use Upper Case
    }

    if (customer.birth_date) {
      const {
        day,
        month,
        year
      } = customer.birth_date

      body.DAT_NASCIMENTO = `${day < 10 ? '0' + day : day}/${month < 10 ? '0' + month : month}/${year}`
    }
    const documentType = customer.registry_type === 'p' ? 'CPF' : 'CNPJ'
    const documentNumber = customer.doc_number

    body.TPO_PESSOA = documentType === 'CPF' ? 'F' : 'J'
    body[documentType] = documentNumber

    if (customer.inscription_type) {
      body[`INS_${customer.inscription_type === 'State' ? 'ESTADUAL' : 'MUNICIPAL'}`] = customer.inscription_number
    }

    // Field is used in the store 51504 (minsterio ler) to NF in orders
    if (customer.corporate_name && storeId !== 51504) {
      body.NOM_CONTATO = customer.corporate_name
    }

    const params = new url.URLSearchParams(body)
    const endpoint = `/InsAltCliente?${params.toString()}`
    console.log('>> Insert Client', endpoint, method)

    return requestHorus(horus, endpoint, method)
      .then(async (data) => {
        if (data && data.length) {
          const customerCodeHorus = data[0].Cliente
          // /InsAltTipoCliente?COD_CLI=200596143&COD_TIPO_CLIENTE=4&STA_DEFAULT=S'
          const params = new url.URLSearchParams({
            COD_CLI: customerCodeHorus,
            COD_TIPO_CLIENTE: appData.customers?.type_customer_code || 31, // TODO: Default is 1
            STA_DEFAULT: 'S'
          })

          const endpoint = `/InsAltTipoCliente?${params.toString()}`
          console.log('>> Type Customer ', endpoint)
          await requestHorus(horus, endpoint, 'POST')
            .catch((err) => {
              if (err.response) {
                console.warn(JSON.stringify(err.response?.data))
              } else {
                console.error(err)
              }
            })

          if (address) {
            return createAddress(horus, customerCodeHorus, address, true)
              .then(() => customerId)
              .catch(() => null)
          }
          return customerId
        }

        return method === 'PUT' ? customerId : null
      })
      .catch(err => {
        console.error(err)
        throw err
      })
  }
  console.log(`> ${logHead} ignored with don't create or update client ${JSON.stringify(customer)}`)

  return customerHorus
    ? customerId
    : (!documentNumber ? 'skip' : null)
}
