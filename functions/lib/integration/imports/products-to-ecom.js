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
  const docFirestore = `sync/${storeId}/${resource}`
  let resourceId
  if (objectHorus.codGenero) {
    resourceId = `COD_GENERO${objectHorus.codGenero}`
  } else if (objectHorus.codAutor) {
    resourceId = `COD_AUTOR${objectHorus.codAutor}`
  } else if (objectHorus.codEditora) {
    resourceId = `COD_EDITORA${objectHorus.codEditora}`
  } else if (objectHorus.productId) {
    resourceId = `${objectHorus.productId}`
  }

  if (resourceId) {
    const createdAt = new Date().toISOString()
    const docFirestoreId = docFirestore + `/${resourceId}`
    const bodyResource = { ...objectHorus, createdAt, resourceId }
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
    update_price: updatePrice,
    update_quantity: updateStock
  } = opts.appData.products

  const {
    COD_ITEM,
    NOM_ITEM,
    COD_EDITORA,
    NOM_EDITORA,
    SUBTITULO,
    DESC_SINOPSE,
    OBS_ESPECIAIS,
    INFO_COMP_ITEM,
    PESO_ITEM,
    LARGURA_ITEM,
    COMPRIMENTO_ITEM,
    ALTURA_ITEM,
    // QTD_PAGINAS,
    SALDO_DISPONIVEL,
    VLR_CAPA,
    STATUS_ITEM,
    PALAVRAS_CHAVE,
    KIT,
    SALDO // field sent in update stock event
  } = productHorus
  if (!COD_ITEM) {
    throw new Error(productHorus.Mensagem)
  }
  const priceHorus = parsePrice(VLR_CAPA)
  let quantity = 0

  if (SALDO_DISPONIVEL) {
    quantity = SALDO_DISPONIVEL
  } else if (SALDO) {
    quantity = SALDO
  }
  const product = await getProductByCodItem({ appSdk, storeId, auth }, COD_ITEM)
  const isUpdatePriceOrStock = !opts.queueEntry?.mustUpdateAppQueue && (updatePrice || updateStock)
  const isUpdateStock = updateStock && (SALDO_DISPONIVEL >= 0 || SALDO >= 0)

  console.log(
    '> COD_ITEM =>', COD_ITEM,
    productHorus && JSON.stringify(productHorus),
    'isUpdatePriceOrStock:',
    isUpdatePriceOrStock,
    ' isUpdateStock:',
    isUpdateStock
  )

  if ((isUpdatePriceOrStock || (product && !updateProduct))) {
    // Update product in E-com

    if (!product && isUpdatePriceOrStock) {
      // product not found to update
      return { _id: 'skip_stock_or_price' }
    }
    const endpoint = `products/${product._id}.json`
    const body = {}

    if (priceHorus && updatePrice) {
      // create a product without a price, but as unavailable if the value is available,
      // the product becomes available (used in the kit)
      if (!product.price) {
        body.price = priceHorus
      }

      if (priceHorus !== product.base_price) {
        body.base_price = priceHorus
      }

      if (!product.base_price) {
        body.available = true
      }
    }

    console.log(`${product.quantity} ${quantity} ${isUpdateStock}`)
    if (quantity !== product.quantity && isUpdateStock) {
      body.quantity = quantity
    }

    if (Object.keys(body).length) {
      console.log('>> Update Product ', endpoint, JSON.stringify(body))
      return appSdk.apiRequest(storeId, endpoint, 'PATCH', body, auth)
        .then(() => product)
        .catch(err => {
          console.error(err)
          throw err
        })
    }
    return product
  } else {
    // New product in E-com
    const body = {
      sku: `COD_ITEM${COD_ITEM}`,
      name: NOM_ITEM,
      slug: removeAccents(NOM_ITEM.toLowerCase())
        .replace(/[^a-z0-9-_./]/gi, '-'),
      status: STATUS_ITEM,
      quantity,
      dimensions: {

        width: {
          value: LARGURA_ITEM || 5,
          unit: 'cm'
        },
        height: {
          value: ALTURA_ITEM || 2,
          unit: 'cm'
        },
        length: {
          value: COMPRIMENTO_ITEM || 15,
          unit: 'cm'
        }
      },
      weight: {
        value: PESO_ITEM || 500,
        unit: 'g'
      }
    }

    if (priceHorus) {
      body.base_price = priceHorus
      body.price = priceHorus
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
      let keywords
      if (PALAVRAS_CHAVE.includes(',')) {
        keywords = PALAVRAS_CHAVE.split(',')
      } else if (PALAVRAS_CHAVE.includes('-')) {
        keywords = PALAVRAS_CHAVE.split('-')
      } else {
        keywords = [PALAVRAS_CHAVE]
      }

      keywords?.forEach(keyword => {
        keyword = keyword.trim()
        if (keyword.length > 50) {
          keyword = keyword.substring(0, 50)
        }
      })
      if (keywords.length) {
        body.keywords = keywords
      }
    }

    if (
      DESC_SINOPSE ||
      OBS_ESPECIAIS ||
      INFO_COMP_ITEM
    ) {
      body.body_html = DESC_SINOPSE || ''
      body.body_html += OBS_ESPECIAIS ? `<br/>${OBS_ESPECIAIS}<br/>` : '<br/>'
      body.body_html += INFO_COMP_ITEM ? `${INFO_COMP_ITEM}<br/>` : ''
    }

    const fieldsGtin = ['COD_BARRA_ITEM', 'COD_BARRA_ITEM_ALT', 'COD_ISBN_ITEM']

    const gtin = []
    fieldsGtin.forEach(field => {
      const isGtinValid = productHorus[field] && /^([0-9]{8}|[0-9]{12,14})$/.test(productHorus[field])
      if (isGtinValid && !gtin.includes(productHorus[field])) {
        gtin.push(productHorus[field])
      }
    })

    if (gtin.length) {
      body.gtin = gtin
    }

    const sendSyncKit = []
    if (KIT === 'S') {
      const productsKit = await getHorusKitComposition({ appSdk, storeId, auth }, COD_ITEM, opts.appData, sendSyncKit)
      productsKit.forEach((kit) => {
        if (kit) {
          if (!Array.isArray(body.kit_composition)) {
            body.kit_composition = []
          }
          body.kit_composition.push({ _id: kit._id, quantity: 1 })
        }
      })
    }

    if (sendSyncKit.length || !priceHorus) {
      // Incomplete Kit
      body.available = false
    }

    const method = !product ? 'POST' : 'PATCH'
    let endpoint = 'products'
    endpoint += !product ? '.json' : `/${product._id}.json`
    const newProduct = await appSdk.apiRequest(storeId, endpoint, method, body, auth)
      .then(({ response }) => {
        if (method === 'POST') {
          console.log(`> Product ${method === 'POST' ? 'created' : 'updated'} => COD_ITEM: ${COD_ITEM}`)
        }
        return response.data
      })
      .catch(err => {
        console.error(
          `>> error ${method === 'POST' ? 'created' : 'updated'} product: `,
          err?.response?.data && JSON.stringify(err.response.data),
          'body: ', JSON.stringify(body)
        )
        // throw err
        return null
      })
    if (!newProduct) {
      return null
    }

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

    if (sendSyncKit.length) {
      sendForSync.push(
        sendToQueueForSync(storeId, 'kit', { items: sendSyncKit, productId })
      )
    }

    await Promise.all(sendForSync)

    return { _id: productId }
  }
}
