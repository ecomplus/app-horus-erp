const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')

const getAppSdk = () => {
  return new Promise(resolve => {
    setup(null, true, firestore())
      .then(appSdk => resolve(appSdk))
  })
}

module.exports = async (
  {
    storeId,
    endpoint,
    method,
    body
  },
  context
) => {
  const resourse = endpoint.replace('.json')
  const { eventId } = context
  const logId = `${eventId}-s${storeId}`

  console.log('>> Exec Event #', logId, ' import ', resourse)
  const appSdk = await getAppSdk()

  return appSdk.getAuth(storeId)
    .then((auth) => {
      return appSdk.apiRequest(storeId, endpoint, method, body, auth)
        .then(({ response }) => {
          console.log('>> Created ', resourse, ' ', response?.data?._id)
        })
    })
    .catch((err) => {
      console.error('Error in #', logId, ' import ', resourse)
      if (err.appWithoutAuth) {
        console.error(err)
      } else {
        throw err
      }
    })
}
