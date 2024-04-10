module.exports = ({ appSdk, storeId, auth }, resource, resourceId) => appSdk
  .apiRequest(storeId, `/${resource}/${resourceId}.json`, 'GET', null, auth)
  .then(({ response }) => {
    return response.data
  })
  .catch((err) => {
    if (err.response) {
      console.warn(JSON.stringify(err.response?.data))
    } else {
      console.error(err)
    }
    return null
  })
