const axios = require('axios')

const requestStoreApi = axios.create({
  baseURL: 'https://api.e-com.plus/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

exports.post = async ({ appSdk }, req, res) => {
  const { headers: reqHeaders, query } = req
  const url = '/authentications/me.json'
  const headers = {
    'x-store-id': reqHeaders['x-store-id'],
    'x-my-id': reqHeaders['x-my-id'],
    'x-access-token': reqHeaders['x-access-token']
  }

  requestStoreApi.get(url, { headers })
    .then(({ data }) => data)

    .then(async (data) => {
      const storeId = data.store_id
      const auth = await appSdk.getAuth(storeId)
      const updateResourses = []

      if (query.resource === 'categories') {
        await appSdk.apiRequest(storeId, 'categories.json?fields=slug', 'GET', null, auth)
          .then(({ response }) => response.data)
          .then(({ result }) => {
            if (result.length) {
              result.forEach(category => {
                if (category.slug && category.slug.includes('_')) {
                  const newSlug = category.slug.replace('_', '-')
                  updateResourses.push(
                    appSdk.apiRequest(storeId, `categories/${category._id}.json`, 'PATCH', { slug: newSlug }, auth)
                  )
                }
              })
            }
          })
      }

      if (query.resource === 'brands') {
        await appSdk.apiRequest(storeId, 'brands.json?fields=slug', 'GET', null, auth)
          .then(({ response }) => response.data)
          .then(({ result }) => {
            if (result.length) {
              result.forEach(brand => {
                if (brand.slug && brand.slug.includes('_')) {
                  const newSlug = brand.slug.replace('_', '-')
                  updateResourses.push(
                    appSdk.apiRequest(storeId, `brands/${brand._id}.json`, 'PATCH', { slug: newSlug }, auth)
                  )
                }
              })
            }
          })
      }
      return Promise.all(updateResourses)
        .then(() => {
          console.log('Sucess Update')
          return storeId
        })
    })
    .then(() => {
      res.status(201)
        .send('Updating....')
    })
    .catch(err => {
      let message = err.name
      let status = 400
      if (err.response) {
        status = err.response.status || status
        message = err.response.statusText || message
        console.error(err.response)
      } else {
        console.error(err)
      }

      res.status(status).send({
        statusCode: status,
        message
      })
    })
}
