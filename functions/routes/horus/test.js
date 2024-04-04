// const { firestore } = require('firebase-admin')
const getAppData = require('../../lib/store-api/get-app-data')
const { getCodePayment, getCodeDelivery } = require('../../lib/parsers/parse-to-horus')
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

const shipping = [
  {
    _id: 'e976355a1688419232452111',
    app: {
      _id: '6193f6b90c7c727225855632',
      label: 'PAC',
      carrier: 'Correios',
      carrier_doc_number: '34028316000103',
      service_code: '04510',
      service_name: 'PAC'
    },
    from: {
      zip: '35701127'
    },
    to: {
      zip: '35701134',
      province_code: 'MG',
      name: 'Wisley Alves',
      city: 'Sete Lagoas',
      borough: 'Progresso',
      street: 'Rua Santo André',
      number: 81
    },
    package: {
      dimensions: {
        width: {
          value: 30,
          unit: 'cm'
        },
        height: {
          value: 30,
          unit: 'cm'
        },
        length: {
          value: 30,
          unit: 'cm'
        }
      },
      weight: {
        value: 0.5,
        unit: 'kg'
      }
    },
    price: 21,
    declared_value: 99.75,
    declared_value_price: 1.51,
    own_hand: false,
    own_hand_price: 0,
    receipt: false,
    receipt_price: 0,
    discount: 0,
    total_price: 27.51,
    delivery_time: {
      days: 5,
      working_days: true
    },
    posting_deadline: {
      days: 3,
      working_days: true,
      after_approval: true
    },
    flags: [
      'correios-ws',
      'correios-normal'
    ],
    other_additionals: [
      {
        tag: 'additional_price',
        label: 'Adicional padrão',
        price: 5
      }
    ],
    custom_fields: [
      {
        field: 'correios_ws_params',
        value: 'sCepOrigem=35701127&sCepDestino=35701134&nCdEmpresa=&sDsSenha=&nCdServico=04510&sCdMaoPropria=n&sCdAvisoRecebimento=n&nVlPeso=0.5&nVlValorDeclarado=99.75&nVlComprimento=16&nVlAltura=2&nVlLargura=11'
      }
    ]
  }
]

exports.get = async ({ appSdk }, req, res) => {
  const storeId = 1173
  const code = req.query.code
  if (code) {
    transaction.payment_method.code = code
  }

  const paymentMethodCode = transaction && transaction.payment_method.code
  const shippingApp = shipping[0].app

  appSdk.getAuth(storeId)
    .then((auth) => {
      return getAppData({ appSdk, storeId, auth })
        .then(appData => {
          const payment = getCodePayment(paymentMethodCode, appData.payments)
          const delivey = getCodeDelivery(shippingApp, appData.delivery)
          res.send({
            payment,
            appDataPayments: appData.payments,
            paymentMethodCode,
            delivey,
            appDataDelivery: appData.delivery,
            shippingApp
          })
        })
    })
    .catch((err) => {
      console.error(err)
      res.send({ error: '' })
    })
}
