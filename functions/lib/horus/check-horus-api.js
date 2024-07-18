const requestCheckHorus = (horus, isRetry) => new Promise((resolve, _reject) => {
  horus.get('/Teste1')
    .then((resp) => {
      const { data } = resp
      if (data && data.length) {
        const [response] = data
        if (response.ATIVA !== 'S') {
          console.log('Check API', JSON.stringify(response))
        }
        resolve(true)
      } else {
        resolve(false)
      }
    })
    .catch((_err) => {
      if (!isRetry) {
        setTimeout(() => requestCheckHorus(horus, true), 700)
      }

      // if (err.response) {
      //   console.log(err.response)
      // } else {
      //   console.error(err)
      // }

      resolve(false)
    })
})

module.exports = requestCheckHorus
