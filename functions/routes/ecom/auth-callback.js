// E-Com Plus Procedures to register
const { procedures } = require('./../../ecom.config')
// handle Store API errors
const errorHandling = require('./../../lib/store-api/error-handling')
const {
  getResource: getCategory,
  createResource: createCategory
} = require('../../lib/store-api/utils')

exports.post = ({ appSdk }, req, res) => {
  const { storeId } = req

  // handle callback with E-Com Plus app SDK
  // https://github.com/ecomplus/application-sdk
  appSdk.handleCallback(storeId, req.body)
    .then(async ({ isNew, authenticationId }) => {
      if (isNew) {
        console.log(`Installing store #${storeId}`)
        /**
         * You may also want to send request to external server here:

        return require('axios').post(`https://yourserver.com/new-ecom-store?store_id=${storeId}`, {
          store_id: storeId,
          authentication_id: authenticationId
        })
         */

        return true
      }

      // not new store, just refreshing access token
      if (procedures.length) {
        return appSdk.getAuth(storeId, authenticationId).then(async auth => {
          const { row, docRef } = auth
          if (!row.setted_up) {
            console.log(`Try saving procedures for store #${storeId}`)

            /**
             * You may want to be notified when app "self" data is edited:
            */

            procedures[0].triggers.push({
              resource: 'applications',
              resource_id: row.application_id,
              field: 'data'
            })

            // must save procedures once only
            return appSdk.saveProcedures(storeId, procedures, auth)
              .then(() => docRef.set({ setted_up: true }, { merge: true }))
              .then(async () => {
                const endpoint = 'categories.json?name=Autores&limit=1'
                const authorsCategory = await getCategory({ appSdk, storeId, auth }, endpoint)
                if (!authorsCategory) {
                  const name = 'Autores'
                  const body = {
                    name,
                    slug: 'autores'
                  }
                  console.log(`Try create category 'Autores' for store #${storeId}`)
                  return createCategory({ appSdk, storeId, auth }, 'categories.json', body, true)
                }
              })
          }
        })
      }
    })

    .then(() => {
      // authentication tokens were updated
      res.status(204)
      res.end()
    })

    .catch(err => {
      const { message, response } = err
      if (response) {
        errorHandling(err)
      } else {
        // Firestore error ?
        console.error(err)
      }
      res.status(500)
      res.send({
        error: 'auth_callback_error',
        message
      })
    })
}
