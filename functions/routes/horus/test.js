// const { firestore } = require('firebase-admin')
const getAppData = require('../../lib/store-api/get-app-data')
const { getCodePayment } = require('../../lib/parsers/parse-to-horus')
const transaction = {
  amount: 117.28,
  status: {
    updated_at: '2023-07-03T21:20:31.734Z',
    current: 'pending'
  },
  banking_billet: {
    link: 'https://pagar.me?format=pdf'
  },
  payment_link: 'https://pagar.me',
  type: 'recurrence',
  payment_method: {
    code: 'banking_billet',
    name: 'Assinatura Mensal p1 - Pagar.me'
  },
  currency_id: 'BRL',
  currency_symbol: 'R$',
  app: {
    _id: '649f35db5e606903704f55dc',
    label: 'p1',
    intermediator: {
      name: 'Pagar.me',
      link: 'https://pagar.me/',
      code: 'pagarme'
    }
  },
  _id: '64a33ba45e60690370527f47'
}

exports.get = async ({ appSdk }, req, res) => {
  const storeId = 1173
  const code = req.query.code
  if (code) {
    transaction.payment_method.code = code
  }

  appSdk.getAuth(storeId)
    .then((auth) => {
      return getAppData({ appSdk, storeId, auth })
        .then(appData => {
          const resp = getCodePayment(transaction, appData.orders)
          res.send({ resp })
        })
    })
    .catch((err) => {
      console.error(err)
      res.send({ error: '' })
    })
}
