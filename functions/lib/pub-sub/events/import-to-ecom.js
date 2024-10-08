const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const { saveFirestore } = require('../utils')
const { collectionHorusEvents } = require('../../utils-variables')

const imports = {
  products: require('../../integration/imports/products-to-ecom'),
  categories: require('../../integration/imports/categories-to-ecom'),
  brands: require('../../integration/imports/brands-to-ecom')
}
const releaseDate = '2024-04-01T00:00:00.000Z'

const getAppSdk = () => {
  return new Promise(resolve => {
    setup(null, true, firestore())
      .then(appSdk => resolve(appSdk))
  })
}

module.exports = async (
  {
    storeId,
    resource: resourcePrefix,
    objectHorus,
    opts,
    eventName
  },
  context
) => {
  const resource = resourcePrefix
    .replace('_stocks', '')
    .replace('_price', '')

  // let isUpdateDate = true
  // if (typeof opts.isUpdateDate === 'boolean') {
  //   isUpdateDate = opts.isUpdateDate
  // }

  const { eventId } = context
  // const { DAT_ULT_ATL: lastUpdate } = objectHorus
  const logId = `${eventId}-s${storeId}`
  const docRef = firestore().doc(`${collectionHorusEvents}/${storeId}_${resourcePrefix}`)
  console.log(`>> Exec Event #${logId} import: ${resource}`)
  const field = 'lastUpdate' + resource.charAt(0).toUpperCase() + resource.substring(1)
  let lastUpdateDoc = releaseDate
  const appSdk = await getAppSdk()
  const docSnapshot = await docRef.get()
  if (docSnapshot.exists) {
    const data = docSnapshot.data()[field]
    lastUpdateDoc = typeof data === 'string' ? data : releaseDate
  }

  // const now = new Date(Date.now() - 3 * 60 * 60 * 1000) // UTC-3
  // const now = new Date()

  return appSdk.getAuth(storeId)
    .then((auth) => {
      const appClient = { appSdk, storeId, auth }
      if (objectHorus && lastUpdateDoc) {
        if (resource === 'products') {
          console.log('> try COD_ITEM: ', objectHorus?.COD_ITEM, ' ', resourcePrefix)
        }
        return imports[resource](appClient, objectHorus, opts)
          .then(async (response) => {
            const _id = response?._id || 'not_update'

            // if (resourcePrefix.startsWith('products')) {
            //   await checkAndUpdateLastUpdateDate(isUpdateDate, lastUpdate, field, now, docRef)
            // }

            return { _id }
          })
      }
      return { _id: 'not_found' }
    })
    .then(async ({ _id }) => {
      console.log(`>> Sucess #${logId} [${resourcePrefix}: ${_id}]`)
    })
    .catch(async (err) => {
      console.error(`>> Error Event #${logId} ${resourcePrefix}`)

      if (err.appWithoutAuth) {
        console.error(err)
      } else {
        let countErr = opts.countErr || 0
        countErr += 1
        opts.countErr = countErr

        const json = {
          storeId,
          resource,
          objectHorus,
          opts,
          eventName
        }
        const collectionName = 'queuePubSub'
        const id = objectHorus.COD_ITEM || objectHorus.resourceId
        await saveFirestore(
          `${collectionName}/${id ? `_${id}` : Date.now()}`,
          { eventName, json }
        )
          .catch()

        throw err
      }
    })
}
