const ecomUtils = require('@ecomplus/utils')

const findCustomer = async ({ appSdk, storeId, auth }, codClient, docCustomer) => {
  let endpoint = '/custormers.json?'
  if (codClient) {
    endpoint += 'metafields.namespace=horus-erp' +
    `&metafields.field=COD_CLI&metafields.value=${codClient}&limit=1`
  } else {
    endpoint += `doc_country=${docCustomer.doc_country}&doc_number=${docCustomer.doc_number}`
  }

  return appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
    .then(({ response }) => response.data)
    .then(({ result }) => {
      if (result.length) {
        const endpoint = `/custormers/${result[0]._id}.json`
        return appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
          .then(async ({ response }) => response.data)
      }
      throw new Error('not found')
    })
    .catch((err) => {
      console.error(err)
      if (err.response?.status === 404) {
        return null
      } else if (err.message === 'not found') {
        return findCustomer({ appSdk, storeId, auth }, null, docCustomer)
      }
      throw err
    })
}

module.exports = async ({ appSdk, storeId, auth }, customerHorus, opts = {}) => {
  const {
    COD_CLI,
    NOM_CLI,
    NOM_REDUZIDO,
    NOM_CONTATO,
    EMAIL,
    TPO_PESSOA,
    CNPJ,
    // RG,
    CPF,
    INSC_ESTADUAL,
    INS_MUNICIPAL,
    // TIPO_CARTAO,
    // NRO_CARTAO,
    // VAL_CARTAO,
    // ASSINANTE_CLI,
    // STA_APROV_FIN,
    // DAT_CADASTRO,
    DAT_NASCIMENTO,
    // DAT_ULT_ATL,
    // NOM_USUARIO,
    // NOM_RESP,
    // DIAS_APROV_FIN,
    // STA_CONTRIBUINTE,
    VLR_DESC_CLI
    // COD_FORMA,
    // PRAZO_VENCIMENTOS,
    // COD_CLI_MONITOR,
    // COD_RESPONSAVEL,
    // CONDICAO_PAGAMENTO,
    // COD_TRANSP,
    // DESC_BANCO,
    // DESC_AGENCIA,
    // DESC_CONTAC,
    // OBS_FINANCEIRAS,
    // CAD_ORGAO,
    // STA_ATIVO,
    // IMAGEM1,
    // IMAGEM2,
    // STA_FIDELIDADE,
    // INFO_ADIC_1,
    // INFO_ADIC_2,
    // INFO_ADIC_3,
    // INFO_ADIC_4,
    // INFO_ADIC_5,
    // INFO_ADIC_6,
    // INFO_ADIC_7,
    // INFO_ADIC_8,
    // OBS_ATIVO,
    // ORGAO_PUBLICO,
    // REVENDA,
    // STATUS,
    // DATA_STA_APROV_FIN
  } = customerHorus

  const registryType = TPO_PESSOA === 'J' ? 'j' : 'p'

  const names = NOM_CLI.split(' ')

  const body = {
    main_email: EMAIL,
    display_name: NOM_REDUZIDO || names[0],
    name: {
      family_name: names[names.length - 1],
      given_name: names[0],
      middle_name: names.reduce((acc, name, index) => {
        if (index !== 0 && index !== (names.length - 1) && name !== ' ' && name !== '') {
          return acc + name + ' '
        }
        return acc
      }, '').trim()
    },
    registry_type: registryType,
    metafields: [
      {
        _id: ecomUtils.randomObjectId(),
        namespace: 'horus-erp',
        field: 'COD_CLI',
        value: COD_CLI
      }
    ]
  }

  if (DAT_NASCIMENTO) {
    const birthDate = new Date(DAT_NASCIMENTO)
    body.birth_date = {
      day: birthDate.getDay(),
      month: birthDate.getMonth() + 1,
      year: birthDate.getFullYear()
    }
  }

  if (registryType === 'j') {
    if (CNPJ && CNPJ !== '') {
      body.doc_country = 'CNPJ'
      body.doc_number = CNPJ
    }
    if (NOM_CONTATO) {
      body.corporate_name = NOM_CONTATO
    }

    if (INSC_ESTADUAL) {
      body.inscription_type = 'State'
      body.inscription_number = INSC_ESTADUAL
    } else if (INS_MUNICIPAL) {
      body.inscription_type = 'Municipal'
      body.inscription_number = INS_MUNICIPAL
    }
  } else {
    if (CPF && CPF !== '') {
      body.doc_country = 'CPF'
      body.doc_number = CPF
    }
  }

  if (VLR_DESC_CLI) {
    body.discount = {
      apply_at: 'subtotal',
      type: 'fixed',
      value: parseFloat(VLR_DESC_CLI)
    }
  }

  const customer = await findCustomer(
    { appSdk, storeId, auth },
    COD_CLI,
    {
      doc_country: body.doc_country,
      doc_number: body.doc_number
    }
  )

  const method = customer ? 'PATCH' : 'POST'
  const endpoint = '/custormers.json'
  return appSdk.apiRequest(storeId, endpoint, method, body, auth)
}
