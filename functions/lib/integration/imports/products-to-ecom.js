const importCategories = require('./categories-to-ecom')
const importBrands = require('./brands-to-ecom')
const { removeAccents } = require('../../utils-variables')
const { parsePrice } = require('../../parsers/parse-to-ecom')
const requestHorus = require('../../horus/request')
const Horus = require('../../horus/client')

const getHorusAutores = async ({ appSdk, storeId, auth }, codItem, appData) => {
  const {
    username,
    password,
    baseURL
  } = appData
  const horus = new Horus(username, password, baseURL)
  // /Autores_item?COD_ITEM=1&offset=0&limit=100
  let hasRepeat = true
  let offset = 0
  const limit = 100

  const promisesSendTopics = []
  while (hasRepeat) {
    // create Object Horus to request api Horus
    const endpoint = `/Autores_item${codItem}&offset=${offset}&limit=${limit}`
    const autores = await requestHorus(horus, endpoint)
      .catch((err) => {
        if (err.response) {
          console.warn(JSON.stringify(err.response))
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
          importCategories({ appSdk, storeId, auth },
            {
              codAutor,
              nomeAutor
            }
          )
        )
      })
    } else {
      hasRepeat = false
    }

    offset += limit
  }
  const categories = await Promise.all(promisesSendTopics)
  console.log('>> categories ', categories)
  return categories
}

module.exports = async ({ appSdk, storeId, auth }, productHorus, opts) => {
  // const { updateProduct, updatePrice, horus } = opts
  const {
    update_product: updateProduct,
    update_price: updatePrice
  } = opts.appData

  const {
    COD_ITEM,
    // COD_BARRA_ITEM,
    // COD_BARRA_ITEM_ALT,
    // COD_ISBN_ITEM,
    // COD_ISSN_ITEM,
    NOM_ITEM,
    COD_EDITORA,
    NOM_EDITORA,
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
    DESC_SINOPSE,
    OBS_ESPECIAIS,
    INFO_COMP_ITEM,
    PESO_ITEM,
    LARGURA_ITEM,
    COMPRIMENTO_ITEM,
    ALTURA_ITEM,
    QTD_PAGINAS,
    SALDO_DISPONIVEL,
    // EBOOK,
    // FORMATO_EBOOK,
    // TAMANHO_EBOOK,
    VLR_CAPA,
    // DAT_CADASTRO,
    // DAT_ULT_ATL,
    STATUS_ITEM,
    // SITUACAO_ITEM,
    // SITUACAO_ITEM_DESC,
    // DAT_EXP_LANCTO,
    PALAVRAS_CHAVE
    // KIT,
    // COD_ORIGEM_EDITORA,
    // POD,
    // DISPONIBILIDADE_MERCADO,
    // NCM
  } = productHorus
  if (!COD_ITEM) {
    throw new Error(productHorus.Mensagem)
  }
  console.log('> product ', JSON.stringify(productHorus))
  const price = parsePrice(VLR_CAPA)
  const endpoint = `products.json?sku=COD_ITEM${COD_ITEM}&limit=1`

  const product = await appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
    .then(({ response }) => response.data)
    .then(({ result }) => {
      if (result.length) {
        const endpoint = `products/${result[0]._id}.json`
        return appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
          .then(async ({ response }) => response.data)
      }
      throw new Error('not found')
    })
    .catch((err) => {
      if (err.response?.status === 404 || err.message === 'not found') {
        return null
      }
      console.error(err)
      throw err
    })

  if (product && !updateProduct) {
    const endpoint = `products/${product._id}.json`
    const body = {}
    if (price !== product.price && updatePrice) {
      body.price = price
    }

    if (Object.keys(body).length) {
      return appSdk.apiRequest(storeId, endpoint, 'PATCH', body, auth)
    }
    return null
  } else {
    const body = {
      sku: `COD_ITEM${COD_ITEM}`,
      name: NOM_ITEM,
      slug: removeAccents(NOM_ITEM.toLowerCase())
        .replace(/[^a-z0-9-_./]/gi, '_'),
      price,
      status: STATUS_ITEM,
      quantity: SALDO_DISPONIVEL || 0,
      dimensions: {

        width: {
          value: LARGURA_ITEM || 0,
          unit: 'cm'
        },
        height: {
          value: ALTURA_ITEM || 0,
          unit: 'cm'
        },
        length: {
          value: COMPRIMENTO_ITEM || 0,
          unit: 'cm'
        }
      },
      weight: {
        value: PESO_ITEM || 0,
        unit: 'mg'
      }

    }

    if (SUBTITULO) {
      body.subtitle = SUBTITULO
    }

    const promisesCategories = []
    const promisesBrands = []
    const generos = ['COD_GENERO_NIVEL', 'COD_GENERO_NIVEL2', 'COD_GENERO_NIVEL3']

    generos.forEach(genero => {
      if (productHorus[genero]) {
        const strNumeral = genero.replace('COD_GENERO_NIVEL', '')
        const numeral = Number.isInteger(parseInt(strNumeral)) && parseInt(strNumeral)
        promisesCategories.push(
          importCategories({ appSdk, storeId, auth },
            {
              codGenero: productHorus[genero],
              nomeGenero: productHorus[`GENERO_NIVEL_${numeral || 1}`]
            }
          )
        )
      }
    })

    // /Autores_item?COD_ITEM=1&offset=0&limit=100

    if (COD_EDITORA) {
      promisesBrands.push(
        importBrands({ appSdk, storeId, auth },
          {
            codEditora: COD_EDITORA,
            nomeEditora: NOM_EDITORA
          }
        )
      )
    }

    const categories = await Promise.all(
      promisesCategories,
      ...getHorusAutores({ appSdk, storeId, auth }, COD_ITEM, opts.appData)
    )
    const brands = await Promise.all(promisesBrands)

    categories.forEach((category) => {
      if (category) {
        if (!Array.isArray(body.categories)) {
          body.categories = []
        }
        body.categories.push({ _id: category._id, name: category.name })
      }
    })

    brands.forEach((brand) => {
      if (brand) {
        if (!Array.isArray(body.brands)) {
          body.brands = []
        }
        body.brands.push({ _id: brand._id, name: brand.name })
      }
    })

    if (PALAVRAS_CHAVE) {
      body.keywords = PALAVRAS_CHAVE.split(',')
    }

    if (DESC_SINOPSE) {
      body.body_html = DESC_SINOPSE
    }

    if (
      OBS_ESPECIAIS ||
      INFO_COMP_ITEM ||
      QTD_PAGINAS
    ) {
      body.body_html = `${OBS_ESPECIAIS}<br/>` || ''
      body.body_html += INFO_COMP_ITEM ? `${INFO_COMP_ITEM}<br/>` : ''
      body.body_html += QTD_PAGINAS ? ` Quantidade de páginas: ${QTD_PAGINAS} <br/>` : ''
    }

    // TODO: Actor Names create brands ?
    // TODO: check kit

    console.log('>> body ', JSON.stringify(body))
    const endpoint = 'products.json'
    const method = !product ? 'POST' : 'PATCH'
    return appSdk.apiRequest(storeId, endpoint, method, body, auth)
  }
}
