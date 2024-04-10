const getResource = ({ appSdk, storeId, auth }, endpoint, isReplay) => {
  return appSdk.apiRequest(storeId, endpoint, 'GET', null, auth)
    .then(({ response }) => {
      const { data } = response
      if (data && data.result && data.result.length) {
        return data.result[0]
      }
      return null
    })
    .catch((err) => {
      if (err.response) {
        console.warn(JSON.stringify(err.response))
      } else {
        console.error(err)
      }
      return null
    })
}

const createResource = async ({ appSdk, storeId, auth }, endpoint, body, isThrow) => {
  return appSdk.apiRequest(storeId, endpoint, 'POST', body, auth)
    .then(({ response }) => {
      const data = response.data
      return data ? { _id: data._id, name: body.name } : data
    })
    .catch((err) => {
      if (err.response) {
        console.warn(JSON.stringify(err.response))
      } else {
        console.error(err)
      }
      if (!isThrow) {
        return null
      }
      throw err
    })
}

module.exports = {
  getResource,
  createResource
}
