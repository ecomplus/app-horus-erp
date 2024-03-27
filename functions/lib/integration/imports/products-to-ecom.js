const getCategories = require('./categories-to-ecom')
const getBrands = require('./brands-to-ecom')
const {
  getHorusAutores,
  getProductByCodItem,
  getHorusKitComposition
} = require('./utils')
const { removeAccents } = require('../../utils-variables')
const { parsePrice } = require('../../parsers/parse-to-ecom')
const { firestore } = require('firebase-admin')

const saveFirestore = (idDoc, body) => firestore()
  .doc(idDoc)
  .set(body, { merge: true })
  .catch(console.error)

const sendToQueueForSync = async (storeId, resource, objectHorus, productId) => {
  const docFirestore = `sync/${resource}/${storeId}`
  let resouceId
  if (objectHorus.codGenero) {
    resouceId = `COD_GENERO${objectHorus.codGenero}`
  } else if (objectHorus.codAutor) {
    resouceId = `COD_AUTOR${objectHorus.codAutor}`
  } else if (objectHorus.codEditora) {
    resouceId = `COD_EDITORA${objectHorus.codEditora}`
  } else if (objectHorus.productId) {
    resouceId = `${objectHorus.productId}`
  }

  if (resouceId) {
    const createdAt = new Date().toISOString()
    const docFirestoreId = docFirestore + `/${resouceId}`
    const bodyResource = { ...objectHorus, createdAt }
    const promises = []
    if (!objectHorus.productId) {
      const bodyProduct = { productId, createdAt }
      promises.push(saveFirestore(`${docFirestoreId}/products/${productId}`, bodyProduct))
    }

    promises.push(saveFirestore(docFirestoreId, bodyResource))

    await Promise.all(promises)
  }
}

module.exports = async ({ appSdk, storeId, auth }, productHorus, opts) => {
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
    PALAVRAS_CHAVE,
    KIT
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
  const product = await getProductByCodItem({ appSdk, storeId, auth }, COD_ITEM)

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

    const promisesGenders = []
    const promisesPublishingCompanies = []
    const categoriesForSync = []
    const brandsForSync = []

    const genders = ['COD_GENERO', 'COD_GENERO_NIVEL2', 'COD_GENERO_NIVEL3']

    genders.forEach(gender => {
      if (productHorus[gender]) {
        const strNumeral = gender.replace('COD_GENERO_NIVEL', '')
        const numeral = Number.isInteger(parseInt(strNumeral)) && parseInt(strNumeral)
        const codGenero = productHorus[gender]
        const nomeGenero = productHorus[`GENERO_NIVEL_${numeral || 1}`]
        promisesGenders.push(
          getCategories({ appSdk, storeId, auth },
            {
              codGenero,
              nomeGenero
            }
          ).then(async (resp) => {
            if (!resp) {
              categoriesForSync.push({ codGenero, nomeGenero })
            }
            return resp
          })
        )
      }
    })

    if (COD_EDITORA) {
      const codEditora = COD_EDITORA
      const nomeEditora = NOM_EDITORA
      promisesPublishingCompanies.push(
        getBrands({ appSdk, storeId, auth },
          {
            codEditora,
            nomeEditora
          }
        )
          .then(resp => {
            if (!resp) {
              brandsForSync.push({ codEditora, nomeEditora })
            }
            return resp
          })
      )
    }

    const gendersHorus = await Promise.all(promisesGenders)
    const authorsHorus = await getHorusAutores({ appSdk, storeId, auth }, COD_ITEM, opts.appData, categoriesForSync)
    const brands = await Promise.all(promisesPublishingCompanies)

    const categories = [...gendersHorus, ...authorsHorus]
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

    const sendSyncKit = []
    if (KIT === 'S') {
      const productsKit = await getHorusKitComposition({ appSdk, storeId, auth }, COD_ITEM, opts.appSdk, sendSyncKit)
      productsKit.forEach((kit) => {
        if (kit) {
          if (!Array.isArray(body.kit_composition)) {
            body.kit_composition = []
          }
          body.kit_composition.push({ _id: kit._id, quantity: 1 })
        }
      })
    }

    const endpoint = 'products.json'
    const method = !product ? 'POST' : 'PATCH'
    const newProduct = await appSdk.apiRequest(storeId, endpoint, method, body, auth)
      .then(({ response }) => response.data)
    const productId = product ? product._id : newProduct._id
    const sendForSync = []
    categoriesForSync.forEach((categoryHorus) => {
      sendForSync.push(
        sendToQueueForSync(storeId, 'category', categoryHorus, productId)
      )
    })

    brandsForSync.forEach((brandHorus) => {
      sendForSync.push(
        sendToQueueForSync(storeId, 'brand', brandHorus, productId)
      )
    })

    if (sendSyncKit) {
      sendForSync.push(
        sendToQueueForSync(storeId, 'kit', { items: sendSyncKit, productId })
      )
    }

    await Promise.all(sendForSync)

    return newProduct
  }
}
