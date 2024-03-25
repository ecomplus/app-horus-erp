const requestHorus = (horus, endpoint, method = 'get', isRetry) => new Promise((resolve, reject) => {
  horus[method](endpoint)
    .then((resp) => {
      const { data } = resp
      if (data && data.length && !data[0].Mensagem) {
        resolve(data)
      }
      resolve(null)
    })
    .catch((err) => {
      if (!isRetry) {
        setTimeout(() => requestHorus(horus, endpoint, method, true), 1000)
      }
      reject(err)
    })
})

module.exports = requestHorus
