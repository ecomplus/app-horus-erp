// read configured E-Com Plus app data
const getAppData = require('./../../lib/store-api/get-app-data')
const updateAppData = require('./../../lib/store-api/update-app-data')
const Horus = require('../../lib/horus/client')
const requestHorus = require('../../lib/horus/request')
const importProductsToEcom = require('../../lib/integration/imports/products-to-ecom')
// const { getItemHorusAndSendProductToImport } = require('../../lib/integration/imports/utils')
const { saveAndSendExportOrderToHorus } = require('../../lib/integration/exports/utils')
const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'

const queueRetry = (appClient, { action, queue, nextId }, appData) => {
  const retryKey = `${appClient.storeId}_${action}_${queue}_${nextId}`
  console.warn(retryKey)

  let queueList = appData[action] && appData[action][queue]
  if (!Array.isArray(queueList)) {
    queueList = [nextId]
  } else if (!queueList.includes(nextId)) {
    queueList.unshift(nextId)
  }
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      updateAppData(appClient, {
        [action]: {
          ...appData[action],
          [queue]: queueList
        }
      })
        .then(resolve)
        .catch(reject)
    }, 7000)
  })
}

const updateApp = async ({ appSdk, storeId, auth }, _id, opts) => {
  const {
    queueEntry,
    appData
  } = opts
  const { action, queue, nextId } = queueEntry
  let queueList = appData[action][queue]
  if (Array.isArray(queueList)) {
    const idIndex = queueList.indexOf(nextId)
    if (idIndex > -1) {
      queueList.splice(idIndex, 1)
    }
  } else {
    queueList = []
  }
  const data = {
    [action]: {
      ...appData[action],
      [queue]: queueList
    }
  }
  console.log(`Update App #${storeId} ${JSON.stringify(data)}`)
  return updateAppData({ appSdk, storeId, auth }, data)
    .then(() => {
      return { _id }
    })
    .catch(async (err) => {
      if (err.response && (!err.response.status || err.response.status >= 500)) {
        await queueRetry({ appSdk, storeId, auth }, queueEntry, appData, err.response)
        return { _id }
      } else {
        throw err
      }
    })
}

const getItemByIdHorusAndCreateProduct = async ({ appSdk, storeId, auth }, appData, queueEntry) => {
  console.log('>> Import Products: ', JSON.stringify(queueEntry))
  // return getItemHorusAndSendProductToImport(storeId, queueEntry.nextId, appData, { queueEntry })
  // const getItemHorusAndSendProductToImport = async (storeId, codItem, appData, options) => {
  const codItem = queueEntry.nextId
  const {
    username,
    password,
    baseURL
  } = appData
  const appClient = { appSdk, storeId, auth }
  const opts = {
    appData,
    isUpdateDate: false,
    queueEntry
  }
  const endpoint = `/Busca_Acervo?COD_ITEM=${codItem}&offset=0&limit=1`
  const horus = new Horus(username, password, baseURL)
  const item = await requestHorus(horus, endpoint, 'get')
    .catch((err) => {
      if (err.response) {
        console.warn(JSON.stringify(err.response?.data))
      } else {
        console.error(err)
      }
      return null
    })
  // console.log('>> item', JSON.stringify(item))
  if (item && item.length && item[0]) {
    const objectHorus = item && item.length && item[0]
    return importProductsToEcom(appClient, objectHorus, opts)
      .then(response => {
        const _id = response?._id || 'not_update'
        return updateApp(appClient, _id, opts)
      })
      .catch(console.error)
    // const options = {
    //   storeId,
    //   resource: 'products',
    //   objectHorus: item && item.length && item[0],
    //   opts: {
    //     appData,
    //     isUpdateDate: false,
    //     queueEntry
    //   },
    //   eventName: `${topicResourceToEcom}_events`
    // }

    // return importToEcom(options, { eventId: Date.now() })
  }
  return updateApp(appClient, 'item_not_found_horus', opts)
}

const exportOrder = async ({ appSdk, storeId, auth }, appData, queueEntry) => {
  console.log('>> Exports Orders: ', JSON.stringify(queueEntry))
  return saveAndSendExportOrderToHorus(storeId, queueEntry.nextId, appData, { queueEntry })
    .then(() => {
      const opts = {
        queueEntry,
        appData
      }
      return updateApp({ appSdk, storeId, auth }, queueEntry.nextId, opts)
    })
}

const integrationHandlers = {
  exportation: {
    orders: exportOrder
  },
  importation: {
    products: getItemByIdHorusAndCreateProduct
  }
}

exports.post = ({ appSdk }, req, res) => {
  // receiving notification from Store API
  const { storeId } = req

  /**
   * Treat E-Com Plus trigger body here
   * Ref.: https://developers.e-com.plus/docs/api/#/store/triggers/
   */
  const trigger = req.body
  const resourceId = trigger.resource_id || trigger.inserted_id

  // get app configured options
  appSdk.getAuth(storeId)
    .then((auth) => {
      return getAppData({ appSdk, storeId, auth })

        .then(appData => {
          if (
            Array.isArray(appData.ignore_triggers) &&
            appData.ignore_triggers.indexOf(trigger.resource) > -1
          ) {
            // ignore current trigger
            const err = new Error()
            err.name = SKIP_TRIGGER_NAME
            throw err
          }
          console.log(`> Webhook #${storeId} ${resourceId} [${trigger.resource}]`)
          let integrationConfig
          // const actionsQueue = []
          // let canCreateNew = false

          if (trigger.resource === 'applications') {
            integrationConfig = appData
          } else if (trigger.authentication_id !== auth.myId) {
            switch (trigger.resource) {
              case 'orders':
                if (trigger.body) {
                  // canCreateNew = appData.new_orders ? undefined : false
                  integrationConfig = {
                    _exportation: {
                      orders: [resourceId]
                    }
                  }
                }
                break

              default:
                break
            }
          }
          if (integrationConfig) {
            const actions = Object.keys(integrationHandlers)
            actions.forEach(action => {
              for (let i = 1; i <= 3; i++) {
                actions.push(`${('_'.repeat(i))}${action}`)
              }
            })
            for (let i = 0; i < actions.length; i++) {
              const action = actions[i]
              const actionQueues = integrationConfig[action]
              // console.log('>> ', action, ' ', actionQueues)
              if (typeof actionQueues === 'object' && actionQueues) {
                let j = 0
                const queues = Object.keys(actionQueues)
                while (j < queues.length) {
                  const queue = queues[j]
                  // Object.keys(actionQueues).forEach((queue) => {
                  const ids = actionQueues[queue]
                  const handlerName = action.replace(/^_+/, '')
                  if (Array.isArray(ids) && ids.length) {
                    // const isHiddenQueue = action.charAt(0) === '_'
                    const mustUpdateAppQueue = trigger.resource === 'applications'
                    const handler = integrationHandlers[handlerName][queue.toLowerCase()]
                    const nextId = ids[0]
                    // console.log('>> ', isHiddenQueue, ' ', mustUpdateAppQueue, ' ', handlerName, ' ', nextId, queue.toLowerCase())
                    const queueEntry = { action, queue, nextId, mustUpdateAppQueue }
                    return handler({ appSdk, storeId, auth }, appData, queueEntry)
                      .then(() => ({ appData, action, queue }))
                  }
                  j += 1
                }
                //
              }
              //
            }
            //
          }
          // nothing to do
          return {}
        })
    })

    .then(({ appData, action, queue }) => {
      // removeFromQueue(resourceId)
      if (appData) {
        if (appData[action] && Array.isArray(appData[action][queue])) {
          res.status(202)
        } else {
          res.status(201)
        }
        return res.send(`> Processed \`${action}.${queue}\``)
      } else {
        return res.send(ECHO_SUCCESS)
      }
    })

    .catch(err => {
      if (err.name === SKIP_TRIGGER_NAME) {
        // trigger ignored by app configuration
        res.send(ECHO_SKIP)
      } else if (err.appWithoutAuth === true) {
        const msg = `Webhook for ${storeId} unhandled with no authentication found`
        const error = new Error(msg)
        error.trigger = JSON.stringify(trigger)
        console.error(error)
        res.status(412).send(msg)
      } else {
        // console.error(err)
        // request to Store API with error response
        // return error status code
        res.status(500)
        const { message } = err
        res.send({
          error: ECHO_API_ERROR,
          message
        })
      }
    })
}
