const url = require('url')
const { firestore } = require('firebase-admin')
const { logger } = require('firebase-functions')
const requestHorus = require('../../horus/request')
const Horus = require('../../horus/client')
const {
  getClientByCustomer,
  getClientAddressByZipCode
} = require('./utils')
const {
  parsePrice,
  parseDate,
  parseFinancialStatus,
  getCodePayment,
  getCodeDelivery,
  parseZipCode
} = require('../../parsers/parse-to-horus')
const createAddress = require('./address-to-horus')
const getOrderById = require('../../store-api/get-resource-by-id')
const { sendMessageTopic } = require('../../pub-sub/utils')
const { topicExportToHorus } = require('../../utils-variables')

const skipCreate = 'SKIP_CREATE'

module.exports = async ({ appSdk, storeId, auth }, orderId, opts = {}) => {
  const { appData } = opts
  const logHead = `#${storeId} ${orderId}`
  const { username, password, baseURL, sale_code: saleCode } = appData
  const horus = new Horus(username, password, baseURL)
  const companyCode = appData.company_code || 1
  const subsidiaryCode = appData.subsidiary_code || 1
  let customCd = null
  let subtotal = 0

  logger.info(`> Order ${orderId}`)

  return getOrderById({ appSdk, storeId, auth }, 'orders', orderId)
    .then(async (order) => {
      if (!order) {
        logger.info(`${logHead} skipped, order not found`)
        throw new Error(skipCreate)
      }
      if (appData?.orders?.approved_order_only) {
        if (order.status !== 'cancelled') {
          if (order.financial_status?.current !== 'paid') {
            logger.info(`${logHead} skipped, setting approved_order_only activate and financial_status unpaid`)
            throw new Error(skipCreate)
          }
        } else {
          logger.info(`${logHead} skipped, order cancelled`)
          throw new Error(skipCreate)
        }
      }
      const customer = order.buyers && order.buyers?.length && order.buyers[0]
      if (!customer) {
        logger.info(`${logHead} skipped, customer not found`)
        return null
      }
      const { amount, number } = order
      customCd = order.domain === 'lojaclassica.com.br' && customer.group

      if (amount && !amount.total) {
        logger.info(`${logHead} skipped, order without total`)
        throw new Error(skipCreate)
      }

      const transaction = order.transactions && order.transactions.length && order.transactions[0]
      const paymentMethodCode = transaction && transaction.payment_method.code
      const shippingLine = order.shipping_lines && order.shipping_lines.length && order.shipping_lines[0]
      const shippingApp = shippingLine?.app
      const customerAddress = shippingLine?.to?.zip
        ? shippingLine.to
        : transaction?.billing_address

      if (!order.financial_status) {
        logger.info(`${logHead} skipped with no financial status`)
        return null
      }
      const queryHorus = `/Busca_PedidosVenda?COD_PEDIDO_ORIGEM=${orderId}&OFFSET=0&LIMIT=1` +
        `&COD_EMPRESA=${companyCode}&COD_FILIAL=${subsidiaryCode}`

      const [
        orderHorus,
        customerHorus
      ] = await Promise.all([
        requestHorus(horus, queryHorus)
          .then((data) => {
            return data && data.length ? data[0] : null
          })
          .catch((err) => {
            if (err.response) {
              logger.warn(JSON.stringify(err.response?.data))
            } else {
              logger.error(err)
            }
            return null
          }),
        getClientByCustomer(storeId, horus, customer)
      ])

      logger.info(`>> Number: ${number} Order ERP: ${JSON.stringify(orderHorus)}`)

      if (!customerHorus) {
        const opts = {
          isCreate: true,
          address: customerAddress
        }
        const bodyDoc = {
          storeId,
          resource: 'customers',
          resourceId: customer._id,
          opts,
          created_at: new Date().toISOString()
        }
        await firestore()
          .doc(`sync/${storeId}/customers/${customer._id}`)
          .set(bodyDoc, { merge: true })
          .then(() => {
            bodyDoc.opts.appData = appData
            return sendMessageTopic(topicExportToHorus, bodyDoc)
          })
          .catch(logger.error)
        return null
      }

      const customerCodeHorus = customerHorus.COD_CLI

      const zipCode = parseZipCode(customerAddress.zip)
      let addressCustomerHorus = await getClientAddressByZipCode(horus, customerCodeHorus, zipCode)
      if (!addressCustomerHorus) {
        addressCustomerHorus = await createAddress(
          horus,
          customerCodeHorus,
          customerAddress,
          customer
        )
      }

      if (!orderHorus) {
        logger.info('> amount: ', JSON.stringify(amount))
        const obs = ['']
        if (customer.corporate_name) {
          obs.push(customer.corporate_name)
        }
        if (order.extra_discount?.discount_coupon) {
          obs.push(`CUPOM: ${order.extra_discount.discount_coupon}`)
        }

        const body = {
          COD_PEDIDO_ORIGEM: orderId,
          COD_EMPRESA: companyCode,
          COD_FILIAL: subsidiaryCode,
          TIPO_PEDIDO_V_T_D: 'V', // Informar o tipo do pedido, neste caso usar a letra V para VENDA,
          COD_CLI: customerCodeHorus, // Código do Cliente - Parâmetro obrigatório!
          OBS_PEDIDO: `Pedido #${number} id: ${orderId}${obs.join(' | ')}`, // Observações do pedido, texto usado para conteúdo variável e livre - Parâmetro opcional!
          COD_TRANSP: getCodeDelivery(shippingApp, appData.delivery), // Código da Transportadora responsável pela entrega do pedido - Parâmetro obrigatório!
          COD_METODO: saleCode, // Código do Método de Venda usado neste pedido para classificação no ERP HORUS - Parâmetro obrigatório.
          COD_TPO_END: addressCustomerHorus.COD_TPO_END, // Código do Tipo de endereço do cliente, usado para entrega da mercadoria - Parâmetro obrigatório!
          FRETE_EMIT_DEST: 1, // Informar o código 1 quando o Frete for por conta do Emitente e o código 2 quando o frete for por conta do Destinatário - Parâmetro Obrigatório
          COD_FORMA: getCodePayment(paymentMethodCode, appData.payments, transaction), // Informar o código da forma de pagamento - Parâmetro Obrigatório
          QTD_PARCELAS: 0, // Informar a quantidade de parcelas do pedido de venda (informar ZERO, quando for pagamento a vista ou baixa automática) - Parâmetro Obrigatório
          VLR_FRETE: parsePrice(amount.freight || 0), // Informar valor do Frete quando existir - Parâmetro opcional!
          VLR_OUTRAS_DESP: parsePrice((amount.tax || 0) + (amount.extra || 0)), // Informar o valor de Outras despesas, essa informação sairá na Nota Fiscal - Parâmetro opcional!
          // DADOS_ADICIONAIS_NF Informar os dados adicionais que deverão sair impresso na Nota Fiscal - Parâmetro opcional!
          DAT_PEDIDO_ORIGEM: parseDate(new Date(order.created_at)), // Poderá ser preenchido nesta coluna a data original que o cliente registrou o pedido no e-commerce ou demais plataformas. Usar o formato DD/MM/AAAA hh:mm:ss. Servirá como estatística de tempo total de atendimento do pedido para facilitar o controle e as pesquisas - Parâmetro opcional, porém, recomendado seu uso.
          // DATA_EST_ENTREGA // Data estimada para entrega - Informar nesta coluna quando o pedido possuir alguma data pré-estipulada para entrega da mercadoria, usar o formato DD/MM/AAAA - Parâmetro opcional!
          // VALOR_CUPOM_DESCONTO: parsePrice(amount.discount || 0), // Informar nesta coluna o valor do cupom de desconto do pedido, esse valor será usado para atribuir um desconto adicional e rateado em nota fiscal. Parâmetro opcional!
          NOM_RESP: appData.orders?.responsible?.name || 'ecomplus'
        }

        logger.info('>> body ', JSON.stringify(body))

        if (order.status === 'cancelled') {
          logger.info(`${logHead} skipped, order cancelled`)
          throw new Error(skipCreate)
        }

        const params = new url.URLSearchParams(body)
        const endpoint = `/InsPedidoVenda?${params.toString()}`
        logger.info('>> Insert Order', endpoint)
        return requestHorus(horus, endpoint, 'POST')
          .then(response => {
            if (response && response.length) {
              logger.info('>> COD_PED_VENDA', response[0].COD_PED_VENDA)
              return {
                order,
                saleCodeHorus: response[0].COD_PED_VENDA,
                customerCodeHorus: customerHorus.COD_CLI,
                isNewOrder: true
              }
            }
          })
      }

      // logger.info('>> Horus order: ', JSON.stringify(orderHorus))
      const statusSkip = ['CAN', 'FAT', 'IMP']
      const isStatusSkip = orderHorus.STATUS_PEDIDO_VENDA && statusSkip.includes(orderHorus.STATUS_PEDIDO_VENDA)

      logger.info('>> Horus status: ', orderHorus.STATUS_PEDIDO_VENDA, ' skip: ', isStatusSkip)

      if (orderHorus.STATUS_PEDIDO_VENDA && isStatusSkip) {
        let msgStatus = ''
        switch (orderHorus.STATUS_PEDIDO_VENDA) {
          case 'CAN':
            msgStatus = 'cancelled'
            break
          case 'FAT':
            msgStatus = 'invoiced'
            break
          case 'IMP':
            msgStatus = 'printed'
            break
          default:
            break
        }
        logger.info(`${logHead} skipped, order ${msgStatus} in ERP`)
        throw new Error(skipCreate)
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
        isNewOrder
      } = data
      const body = {
        COD_EMPRESA: companyCode,
        COD_FILIAL: subsidiaryCode,
        COD_CLI: customerCodeHorus,
        COD_PED_VENDA: saleCodeHorus
      }
      const promisesAddItemOrderHorus = []
      const errorAddItem = []
      if (order.items && order.items.length) {
        const queryHorus = `/Busca_ItensPedidosVenda?COD_PED_VENDA=${saleCodeHorus}` +
          `&COD_EMPRESA=${companyCode}&COD_FILIAL=${subsidiaryCode}&OFFSET=0&LIMIT=${order.items.length}`
        const itemsHorus = await requestHorus(horus, queryHorus)
          .catch((err) => {
            if (isNewOrder) return null
            throw err
          })
        let isAllImportedItems = true
        const amountDiscount = order.amount?.discount || 0
        const amountSubtotal = order.amount?.subtotal
        order.items?.forEach((item) => {
          if (item.sku.startsWith('COD_ITEM')) {
            const codItem = item.sku.replace('COD_ITEM', '')
            body.COD_ITEM = codItem
            const vlrBruto = item.final_price || item.price
            body.QTD_PEDIDA = item.quantity

            const itemHorus = itemsHorus?.find(itemFind => `${itemFind.COD_ITEM}` === codItem)
            let isImportItem = !itemHorus

            if (itemHorus && itemHorus.QT_PEDIDA < item.quantity) {
              body.QTD_PEDIDA = item.quantity - itemHorus.QTD_PEDIDA
              isImportItem = true
            }

            // isAllImportedItems = item?.quantity > 0
            // logger.info(`QTD_PEDIDA: ${body?.QTD_PEDIDA} itemHorus ${itemHorus?.QTD_PEDIDA} itemOrder: ${item?.quantity}`)

            if (isImportItem) {
              const totalItemValue = vlrBruto * item.quantity
              const itemDiscount = amountSubtotal > 0 ? totalItemValue * amountDiscount / amountSubtotal : 0
              const discountPerUnit = itemDiscount / item.quantity
              isAllImportedItems = false
              const vlrItem = parsePrice(vlrBruto - discountPerUnit)
              subtotal += (vlrItem * (item.quantity || 1))
              body.VLR_LIQUIDO = vlrItem
              logger.info(`>> vlrBruto: ${vlrBruto} discount: ${itemDiscount} total: ${vlrItem}`)

              const params = new url.URLSearchParams(body)
              const endpoint = `/InsItensPedidoVenda?${params.toString()}`
              promisesAddItemOrderHorus.push(
                requestHorus(horus, endpoint)
                  .then(() => {
                    logger.info(`>> Add Item in order: ${endpoint}`)
                  })
                  .catch(() => {
                    errorAddItem.push(endpoint)
                  })
              )
            }
          } else {
            logger.warn(`> orderId #${orderId} -> sku: ${item.sku} product not imported from ERP`)
          }
        })

        if (promisesAddItemOrderHorus.length) {
          await Promise.all(promisesAddItemOrderHorus)
        }

        if (errorAddItem.length) {
          return null
        }

        if (!promisesAddItemOrderHorus.length && !errorAddItem.length && !isAllImportedItems) {
          logger.info(`${logHead} skipped, products not imported from ERP`)
          throw new Error(skipCreate)
        }

        return {
          order,
          saleCodeHorus,
          customerCodeHorus,
          isNewOrder
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
        customerCodeHorus,
        isNewOrder
      } = data

      const { amount } = order
      const transaction = order.transactions && order.transactions.length && order.transactions[0]
      const paymentMethodCode = transaction && transaction.payment_method.code
      const paymentAmount = subtotal > 0
        ? subtotal + (amount.freight || 0)
        : amount.total

      const body = {
        COD_EMPRESA: companyCode,
        COD_FILIAL: subsidiaryCode,
        COD_CLI: customerCodeHorus,
        COD_PED_VENDA: saleCodeHorus,
        COD_FORMA: getCodePayment(paymentMethodCode, appData.payments, transaction),
        VLR_PARCELA: parsePrice(paymentAmount),
        QTD_PARCELAS: 0,
        DATA_VENCIMENTO: parseDate(new Date(order.created_at))
      }

      const params = new url.URLSearchParams(body)
      const endpoint = `/InsVencPedidoVenda?${params.toString()}`
      logger.info(`>> Installments: ${isNewOrder ? endpoint : 'skip'}`)

      if (isNewOrder) {
        await requestHorus(horus, endpoint, 'POST')
          .catch(logger.error)
      }

      return {
        order,
        saleCodeHorus,
        customerCodeHorus,
        isNewOrder
      }
    })
    .then(async data => {
      if (!data) {
        return null
      }
      const {
        order,
        saleCodeHorus,
        customerCodeHorus
      } = data

      const body = {
        COD_EMPRESA: companyCode,
        COD_FILIAL: subsidiaryCode,
        COD_CLI: customerCodeHorus,
        COD_PED_VENDA: saleCodeHorus
      }

      body.STA_PEDIDO = order.status === 'cancelled'
        ? 'CAN'
        : customCd && order.financial_status?.current === 'paid'
          ? 'LFT'
          : parseFinancialStatus(order.financial_status?.current)

      const params = new url.URLSearchParams(body)
      const endpoint = `/AltStatus_Pedido?${params.toString()}`
      logger.info('>> Update Status Order', endpoint)

      return requestHorus(horus, endpoint, 'POST')
        .then(response => {
          if (response && response.length) {
            if (body.STA_PEDIDO === 'LFT' && customCd) {
              const expQuery = '/Pular_expedicao' +
                `?COD_EMPRESA=${companyCode}` +
                `&COD_FILIAL=${subsidiaryCode}` +
                `&COD_CLI=${customerCodeHorus}` +
                `&COD_PED_VENDA=${saleCodeHorus}` +
                `&COD_LOCAL=${customCd}`
              requestHorus(horus, expQuery)
                .catch((err) => {
                  logger.warn(`Failed custom CD expedition ${expQuery}`, { orderId })
                  logger.error(err)
                })
            }
            return orderId
          }
          return null
        })
    })
    .catch((err) => {
      if (err.message === skipCreate) {
        return orderId
      }

      if (err.response) {
        logger.warn(JSON.stringify(err.response?.data))
      } else {
        logger.error(err)
      }
      throw err
    })
}
