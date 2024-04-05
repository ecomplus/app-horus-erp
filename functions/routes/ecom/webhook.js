// read configured E-Com Plus app data
const getAppData = require('./../../lib/store-api/get-app-data')
// const Horus = require('../../lib/horus/client')
// const requestHorus = require('../../lib/horus/request')
// const { topicResourceToEcom } = require('../../lib/utils-variables')
// const { sendMessageTopic } = require('../../lib/pub-sub/utils')
const { getItemHorusAndSendProductToImport } = require('../../lib/integration/imports/utils')
const { exportOrderToHorus } = require('../../lib/integration/exports/utils')
const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'

const sendHorusProductForImportByCodItem = async ({ _appSdk, storeId, _auth }, appData, queueEntry) => {
  // console.log('>> Import Products')
  return getItemHorusAndSendProductToImport(storeId, queueEntry.nextId, appData, { queueEntry })
}

const exportOrder = async ({ _appSdk, storeId, _auth }, appData, queueEntry) => {
  console.log('>> Exports Orders: ', JSON.stringify(queueEntry))
  return exportOrderToHorus(storeId, queueEntry.nextId, appData, { queueEntry })
}

const integrationHandlers = {
  exportation: {
    orders: exportOrder
  },
  importation: {
    products: sendHorusProductForImportByCodItem
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
                    const isHiddenQueue = action.charAt(0) === '_'
                    const mustUpdateAppQueue = trigger.resource === 'applications'
                    const handler = integrationHandlers[handlerName][queue.toLowerCase()]
                    const nextId = ids[0]
                    console.log('>> ', isHiddenQueue, ' ', mustUpdateAppQueue, ' ', handlerName, ' ', nextId, queue.toLowerCase())
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
