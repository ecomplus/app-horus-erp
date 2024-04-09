const requestHorus = (horus, endpoint, method = 'get', isRetry) => new Promise((resolve, reject) => {
  horus[method.toLowerCase()](endpoint)
    .then((resp) => {
      const { data } = resp
      if (data && data.length && !data[0].Mensagem) {
        resolve(data)
      }
      if (data && data.length && data[0].Falha) {
        console.error(data[0], ` endpoint: ${endpoint}`)
        throw new Error(data[0].Mensagem)
      } else {
        console.warn(`>Warn: ${typeof data === 'object' ? JSON.stringify(data) : data}`)
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
