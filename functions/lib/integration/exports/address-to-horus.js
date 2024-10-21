const url = require('url')
const {
  getClientAddressByZipCode
} = require('./utils')
const requestHorus = require('../../horus/request')
const { parseZipCode } = require('../../parsers/parse-to-horus')

const parsePhone = (phone) => {
  // limit ERP is 14 characteres
  const { number } = phone
  const start = number.length > 14 ? number.length - 14 : 0
  return number.substring(start, number.length)
}

module.exports = async (horus, customerCodeHorus, customerAddress) => {
  const zipCode = parseZipCode(customerAddress.zip) || 0
  console.log('> Address Customer => CLI: ', customerCodeHorus, ' ZipCode: ', zipCode)

  const addressCustomerHorus = await getClientAddressByZipCode(horus, customerCodeHorus, zipCode)

  if (addressCustomerHorus) {
    return addressCustomerHorus
  }

  const body = {
    COD_CLI: customerCodeHorus, // Código do Cliente - Parâmetro obrigatório
    COD_TPO_END: 1, // Código do tipo de endereço - Parâmetro obrigatório.
    NOM_PAIS: customerAddress.country ? customerAddress.country.toUpperCase() : 'BRASIL', // Nome do país - Parâmetro obrigatório
    SIGLA_UF: customerAddress.province_code, // SIGLA_UF - Parâmetro Obrigatório, informar a sigla do estado (unidade da federação, ex: SP)
    NOME_UF: customerAddress.province, // NOME_UF - Parâmetro Obrigatório, informar O NOME do estado (unidade da federação, ex: São Paulo)
    NOM_LOCAL: customerAddress.city, // Nome do município - Parâmetro obrigatório - Informar corretamente a cidade do endereço
    NOM_BAIRRO: customerAddress.borough, // Nome do Bairro - Parâmetro obrigatório
    DESC_ENDERECO: customerAddress.street, // Endereço do cliente - Parâmetro obrigatório.
    NUM_END: customerAddress.number || 's/n', // Número do imóvel no endereço do cliente - Parâmetro obrigatório.
    COM_ENDERECO: customerAddress.complement, // Complemento do Endereço do cliente - Parâmetro opcional.
    CEP: zipCode, // CEP do endereço do cliente - Parâmetro obrigatório. Caso o endereço não possua CEP informar zero para Nacional ou "99999999" para estrangeiros.
    // CEL_ENDERECO // Telefone celular do cliente - Parâmetro opcional
    // FAX_ENDERECO // fax do cliente - Parâmetro opcional
    STA_DEFAULT: 'S' // Parâmetro obrigatório - Informar se o endereço será definido como default para o cliente usando a letra S ou N
    // STA_VALIDO // Parâmetro opcional - Informar se o endereço é válido usando a letra S ou N
  }

  if (customerAddress.phone) {
    body.TEL_ENDERECO = parsePhone(customerAddress.phone) // Telefone do cliente - Parâmetro opcional
  }

  if (customerAddress.name) {
    let name = customerAddress.name
    name += customerAddress.last_name ? `${customerAddress.last_name}` : ''

    body.NOM_CONTATO = name // Nome de contato no endereço - Parâmetro opcional
  }

  const params = new url.URLSearchParams(body)
  const endpoint = `/InsAltEndCliente?${params.toString()}`

  return requestHorus(horus, endpoint, 'POST')
    .then(() => {
      const endpoint = `/Busca_EndCliente?COD_CLI=${customerCodeHorus}&CEP=${zipCode}&OFFSET=0&LIMIT=1`
      return requestHorus(horus, endpoint)
    })
    .then((data) => {
      let address
      if (data && data.length) {
        address = data.find(addressFind => addressFind.COD_TPO_END === 1)
        return address || data[0]
      }
      return null
    })
    .catch((err) => {
      if (err.response) {
        console.warn(JSON.stringify(err.response?.data))
      } else {
        console.error(err)
      }
      throw err
    })
}
