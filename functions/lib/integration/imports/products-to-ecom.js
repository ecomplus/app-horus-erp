// const getAppData = require('../../store-api/get-app-data')
// const Horus = require('../horus/client')

module.exports = async ({ appSdk, storeId, auth }, productHorus) => {
  const {
    COD_ITEM,
    // COD_BARRA_ITEM,
    // COD_BARRA_ITEM_ALT,
    // COD_ISBN_ITEM,
    // COD_ISSN_ITEM,
    NOM_ITEM,
    // COD_EDITORA,
    // NOM_EDITORA,
    // SELO,
    // COD_GRUPO_ITEM,
    // NOM_GRUPO_ITEM,
    // COD_UNIDADE,
    // NOM_UNIDADE,
    // TIPO,
    // COD_GENERO,
    // GENERO_NIVEL_1,
    // COD_GENERO_NIVEL2,
    // GENERO_NIVEL_2,
    // COD_GENERO_NIVEL3,
    // GENERO_NIVEL_3,
    SUBTITULO,
    // DESC_SINOPSE,
    // OBS_ESPECIAIS,
    // INFO_COMP_ITEM,
    // PESO_ITEM,
    // LARGURA_ITEM,
    // COMPRIMENTO_ITEM,
    // ALTURA_ITEM,
    // QTD_PAGINAS,
    SALDO_DISPONIVEL,
    // EBOOK,
    // FORMATO_EBOOK,
    // TAMANHO_EBOOK,
    VLR_CAPA,
    // DAT_CADASTRO,
    // DAT_ULT_ATL,
    STATUS_ITEM
    // SITUACAO_ITEM,
    // SITUACAO_ITEM_DESC,
    // DAT_EXP_LANCTO,
    // PALAVRAS_CHAVE,
    // KIT,
    // COD_ORIGEM_EDITORA,
    // POD,
    // DISPONIBILIDADE_MERCADO,
    // NCM
  } = productHorus
  const price = parseFloat(VLR_CAPA)
  const endpoint = `/products.json?sku=COD_ITEM${COD_ITEM}&limit=1`

  const product = await appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
    .then(({ response }) => response.data)
    .then(({ result }) => {
      const endpoint = `/products/${result[0]._id}.json`
      return appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
        .then(async ({ response }) => response.data)
    })
    .catch((err) => {
      console.error(err)
      if (err.response?.status === 404) {
        return null
      }
      throw err
    })

  if (product) {
    if (price !== product.price) {
      const endpoint = `/products/${product._id}.json`
      const body = {
        price
      }
      return appSdk.apiRequest(storeId, endpoint, 'PATCH', body, auth)
    }
    return null
  } else {
    const body = {
      sku: `COD_ITEM${COD_ITEM}`,
      name: NOM_ITEM,
      price,
      status: STATUS_ITEM,
      quantity: SALDO_DISPONIVEL || 0
    }

    if (SUBTITULO) {
      body.subtitle = SUBTITULO
    }

    // todo:  find categories
    // if not found create category and add in product

    // todo: check kit

    const endpoint = '/products.json'
    return appSdk.apiRequest(storeId, endpoint, 'POST', body, auth)
  }
}
