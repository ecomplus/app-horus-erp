const url = require('url')
const requestHorus = require('../../horus/request')
const Horus = require('../../horus/client')
const { getClientByCustomer } = require('./utils')
const {
  parsePrice,
  parseDate,
  parseFinancialStatus,
  getCodePayment
} = require('../../parsers/parse-to-horus')
const getOrderById = require('../../store-api/get-resource-by-id')

// const getOneInErp = (horus, endpoint) => requestHorus(horus, endpoint)
//   .then((data) => {
//     return data && data.length ? data[0] : null
//   })
//   .catch((err) => {
//     if (err.response) {
//       console.warn(JSON.stringify(err.response))
//     } else {
//       console.error(err)
//     }
//     return null
//   })

// const transport = transportsHorus.find(i => i.NOM_TRANSP.includes(shipping_method_label.toUpperCase()))
// payment_method cartão // boleto // pix
// const payment = payments.find(i => i.NOM_FORMA.includes())

module.exports = async ({ appSdk, storeId, auth }, orderId, opts = {}) => {
  const {
    appData
    // isCreate
  } = opts
  const { username, password, baseURL, sale_code: saleCode } = appData
  const horus = new Horus(username, password, baseURL)
  const companyCode = appData.company_code || 1
  const subsidiaryCode = appData.subsidiary_code || 1

  return getOrderById({ appSdk, storeId, auth }, 'orders', orderId)
    .then(async (order) => {
      // const order = response.data
      const customer = order.buyers
      const {
        amount,
        number
      } = order

      const logHead = `#${storeId} ${orderId}`
      if (!order.financial_status) {
        console.log(`${logHead} skipped with no financial status`)
        return null
      }
      const queryHorus = `/Busca_Cliente?COD_PEDIDO_ORIGEM=${orderId}&OFFSET=0&LIMIT=1`

      const [orderHorus, customerHorus] = await Promise.all([
        requestHorus(horus, queryHorus)
          .then((data) => {
            return data && data.length ? data[0] : null
          })
          .catch((err) => {
            if (err.response) {
              console.warn(JSON.stringify(err.response))
            } else {
              console.error(err)
            }
            return null
          }),
        getClientByCustomer(storeId, horus, customer)
      ])

      if (!customerHorus) {
        // TODO:
        // send to queue to create client in erp
        // add order in queue to export for erp
      }

      const transaction = order.transactions.length && order.transactions[0]

      const body = {
        COD_PEDIDO_ORIGEM: orderId,
        COD_EMPRESA: companyCode,
        COD_FILIAL: subsidiaryCode,
        TIPO_PEDIDO_V_T_D: 'V', // Informar o tipo do pedido, neste caso usar a letra V para VENDA,
        COD_CLI: customerHorus.COD_CLI, // Código do Cliente - Parâmetro obrigatório!
        OBS_PEDIDO: `Pedido #${number}`, // Observações do pedido, texto usado para conteúdo variável e livre - Parâmetro opcional!
        // COD_TRANSP // Código da Transportadora responsável pela entrega do pedido - Parâmetro obrigatório!
        COD_METODO: saleCode, // Código do Método de Venda usado neste pedido para classificação no ERP HORUS - Parâmetro obrigatório.
        // COD_TPO_END // Código do Tipo de endereço do cliente, usado para entrega da mercadoria - Parâmetro obrigatório!
        FRETE_EMIT_DEST: amount.freight ? 2 : 1, // Informar o código 1 quando o Frete for por conta do Emitente e o código 2 quando o frete for por conta do Destinatário - Parâmetro Obrigatório
        COD_FORMA: getCodePayment(transaction, appData.payments), // Informar o código da forma de pagamento - Parâmetro Obrigatório
        QTD_PARCELAS: 'ZERO', // Informar a quantidade de parcelas do pedido de venda (informar ZERO, quando for pagamento a vista ou baixa automática) - Parâmetro Obrigatório
        VLR_FRETE: parsePrice(amount.freight || 0), // Informar valor do Frete quando existir - Parâmetro opcional!
        VLR_OUTRAS_DESP: parsePrice((amount.tax || 0) + (amount.extra || 0)), // Informar o valor de Outras despesas, essa informação sairá na Nota Fiscal - Parâmetro opcional!
        // DADOS_ADICIONAIS_NF Informar os dados adicionais que deverão sair impresso na Nota Fiscal - Parâmetro opcional!
        DAT_PEDIDO_ORIGEM: parseDate(new Date(order.created_at)), // Poderá ser preenchido nesta coluna a data original que o cliente registrou o pedido no e-commerce ou demais plataformas. Usar o formato DD/MM/AAAA hh:mm:ss. Servirá como estatística de tempo total de atendimento do pedido para facilitar o controle e as pesquisas - Parâmetro opcional, porém, recomendado seu uso.
        // DATA_EST_ENTREGA // Data estimada para entrega - Informar nesta coluna quando o pedido possuir alguma data pré-estipulada para entrega da mercadoria, usar o formato DD/MM/AAAA - Parâmetro opcional!
        VALOR_CUPOM_DESCONTO: parsePrice(amount.discount || 0), // Informar nesta coluna o valor do cupom de desconto do pedido, esse valor será usado para atribuir um desconto adicional e rateado em nota fiscal. Parâmetro opcional!
        NOM_RESP: appData.orders?.responsible?.name || 'ecomplus'
      }

      if (!orderHorus) {
        const params = new url.URLSearchParams(body)
        const endpoint = `/InsPedidoVenda?${params.toString()}`
        console.log('>> Insert Order', endpoint)
        /*
        return requestHorus(horus, endpoint, 'POST')
          .then(response => {
            if (response && response.length) {
              return {
                order,
                saleCodeHorus: response[0].COD_PED_VENDA,
                customerCodeHorus: customerHorus.COD_CLI
                isNew: true
              }
            }
          })
        */
      }
      return {
        order,
        saleCodeHorus: orderHorus.COD_PED_VENDA,
        customerCodeHorus: customerHorus.COD_CLI
      }
    })
    .then(async data => {
      if (!data) {
        return null
      }
      const {
        order,
        saleCodeHorus,
        customerCodeHorus,
        isNew
      } = data
      const body = {
        COD_EMPRESA: companyCode,
        COD_FILIAL: subsidiaryCode,
        COD_CLI: customerCodeHorus,
        COD_PED_VENDA: saleCodeHorus
      }
      const promisesAddItemOrderHorus = []
      const errorAddItem = []
      if (isNew && order.items && order.items.length) {
        const queryHorus = `/Busca_ItensPedidosVenda?COD_PED_VENDA=${saleCodeHorus}` +
          `&COD_EMPRESA=${companyCode}&COD_FILIAL=${subsidiaryCode}&OFFSET=0&LIMIT=${order.items.length}`
        const itemsHorus = await requestHorus(horus, queryHorus)
          .catch(() => null)

        order.items?.forEach((item) => {
          const codItem = item.sku.replace('COD_ITEM', '')
          body.COD_ITEM = codItem
          body.VLR_LIQUIDO = parsePrice(item.final_price || item.price)
          body.QTD_PEDIDA = item.quantity

          const itemHorus = itemsHorus?.find(itemFind => itemFind.COD_ITEM === codItem)
          let isImport = !itemHorus

          if (itemHorus && itemHorus.QTD_PEDIDA < item.quantity) {
            body.QTD_PEDIDA = item.quantity - itemHorus.QTD_PEDIDA
            isImport = true
          }
          if (isImport) {
            const params = new url.URLSearchParams(body)
            const endpoint = `/InsItensPedidoVenda?${params.toString()}`
            promisesAddItemOrderHorus.push(
              requestHorus(horus, endpoint)
                .then(() => {
                  console.log('>> Add Item in order', endpoint)
                })
                .catch(() => {
                  errorAddItem.push(endpoint)
                })
            )
          }
        })

        if (promisesAddItemOrderHorus.length) {
          await Promise.all(promisesAddItemOrderHorus)
        }

        if (errorAddItem.length) {
          // não proseguir
          return null
        }

        return {
          order,
          saleCodeHorus,
          customerCodeHorus,
          isNew
        }
      }
      return null
    })
    .then(async data => {
      if (!data) {
        return null
      }
      const {
        order,
        saleCodeHorus,
        customerCodeHorus
        // isNew
      } = data

      const body = {
        COD_EMPRESA: companyCode,
        COD_FILIAL: subsidiaryCode,
        COD_CLI: customerCodeHorus,
        COD_PED_VENDA: saleCodeHorus
      }

      body.STA_PEDIDO = order.status === 'cancelled'
        ? 'CAN'
        : parseFinancialStatus(order.financial_status)

      const params = new url.URLSearchParams(body)
      const endpoint = `/AltStatus_Pedido?${params.toString()}`
      console.log('>> Update Status Order', endpoint)

      /*
        return requestHorus(horus, endpoint, 'POST')
          .then(response => {
            if (response && response.length) {
              return orderId
            }
          })
        */
    })
    .catch((err) => {
      if (err.response) {
        console.warn(JSON.stringify(err.response))
      } else {
        console.error(err)
      }
      throw err
    })
}
