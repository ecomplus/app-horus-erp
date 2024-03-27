// read configured E-Com Plus app data
const getAppData = require('./../../lib/store-api/get-app-data')

const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'
const integrationHandlers = {
  // init_store: require('../../lib/integration/int-store'),
  exportation: {
    // product_ids: require('./../../lib/integration/export-product'),
    // order_ids: require('./../../lib/integration/export-order')
  },
  importation: {
    // skus: require('./../../lib/integration/import-product'),
    // order_numbers: require('./../../lib/integration/import-order')
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

          if (trigger.resource === 'applications') {
            // actionsQueue.push(...Object.keys(trigger.body))
            integrationConfig = appData
            // canCreateNew = true
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
                Object.keys(actionQueues).forEach((queue) => {
                  const ids = actionQueues[queue]
                  const handlerName = action.replace(/^_+/, '')
                  if (action !== 'init_store') {
                    // console.log('>> queue: ', queue, ' ', ids)
                    if (Array.isArray(ids) && ids.length) {
                      // const isHiddenQueue = action.charAt(0) === '_'
                      // const mustUpdateAppQueue = trigger.resource === 'applications'
                      // const handler = integrationHandlers[handlerName][queue.toLowerCase()]
                      // const nextId = ids[0]
                      // console.log('>> ', isHiddenQueue, ' ', mustUpdateAppQueue, ' ', handlerName, ' ', nextId)
                    }
                  } else if (ids) {
                    const handler = integrationHandlers[handlerName]
                    return handler({ appSdk, storeId, auth }, appData)
                      .then(() => ({ appData, action, queue }))
                  }
                })
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
