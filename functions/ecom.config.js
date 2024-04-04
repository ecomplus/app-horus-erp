/* eslint-disable comma-dangle, no-multi-spaces, key-spacing, quotes, quote-props */

/**
 * Edit base E-Com Plus Application object here.
 * Ref.: https://developers.e-com.plus/docs/api/#/store/applications/
 */

const app = {
  app_id: 112106,
  title: 'Horus ERP',
  slug: 'horus-erp',
  type: 'external',
  state: 'active',
  authentication: true,

  /**
   * Uncomment modules above to work with E-Com Plus Mods API on Storefront.
   * Ref.: https://developers.e-com.plus/modules-api/
   */
  modules: {
    /**
     * Triggered to calculate shipping options, must return values and deadlines.
     * Start editing `routes/ecom/modules/calculate-shipping.js`
     */
    // calculate_shipping:   { enabled: true },

    /**
     * Triggered to validate and apply discount value, must return discount and conditions.
     * Start editing `routes/ecom/modules/apply-discount.js`
     */
    // apply_discount:       { enabled: true },

    /**
     * Triggered when listing payments, must return available payment methods.
     * Start editing `routes/ecom/modules/list-payments.js`
     */
    // list_payments:        { enabled: true },

    /**
     * Triggered when order is being closed, must create payment transaction and return info.
     * Start editing `routes/ecom/modules/create-transaction.js`
     */
    // create_transaction:   { enabled: true },
  },

  /**
   * Uncomment only the resources/methods your app may need to consume through Store API.
   */
  auth_scope: {
    'stores/me': [
      'GET'            // Read store info
    ],
    procedures: [
      'POST'           // Create procedures to receive webhooks
    ],
    products: [
      'GET',           // Read products with public and private fields
      'POST',          // Create products
      'PATCH',         // Edit products
      // 'PUT',           // Overwrite products
      // 'DELETE',        // Delete products
    ],
    brands: [
      'GET',           // List/read brands with public and private fields
      'POST',          // Create brands
      'PATCH',         // Edit brands
      // 'PUT',           // Overwrite brands
      // 'DELETE',        // Delete brands
    ],
    categories: [
      'GET',           // List/read categories with public and private fields
      'POST',          // Create categories
      'PATCH',         // Edit categories
      // 'PUT',           // Overwrite categories
      // 'DELETE',        // Delete categories
    ],
    customers: [
      'GET',           // List/read customers
      'POST',          // Create customers
      'PATCH',         // Edit customers
      // 'PUT',           // Overwrite customers
      // 'DELETE',        // Delete customers
    ],
    orders: [
      'GET',           // List/read orders with public and private fields
      'POST',          // Create orders
      'PATCH',         // Edit orders
      // 'PUT',           // Overwrite orders
      // 'DELETE',        // Delete orders
    ],
    carts: [
      // 'GET',           // List all carts (no auth needed to read specific cart only)
      // 'POST',          // Create carts
      // 'PATCH',         // Edit carts
      // 'PUT',           // Overwrite carts
      // 'DELETE',        // Delete carts
    ],

    /**
     * Prefer using 'fulfillments' and 'payment_history' subresources to manipulate update order status.
     */
    'orders/fulfillments': [
      'GET',           // List/read order fulfillment and tracking events
      'POST',          // Create fulfillment event with new status
      // 'DELETE',        // Delete fulfillment event
    ],
    'orders/payments_history': [
      'GET',           // List/read order payments history events
      'POST',          // Create payments history entry with new status
      // 'DELETE',        // Delete payments history entry
    ],

    /**
     * Set above 'quantity' and 'price' subresources if you don't need access for full product document.
     * Stock and price management only.
     */
    'products/quantity': [
      // 'GET',           // Read product available quantity
      'PUT',           // Set product stock quantity
    ],
    'products/variations/quantity': [
      // 'GET',           // Read variaton available quantity
      'PUT',           // Set variation stock quantity
    ],
    'products/price': [
      // 'GET',           // Read product current sale price
      'PUT',           // Set product sale price
    ],
    'products/variations/price': [
      // 'GET',           // Read variation current sale price
      'PUT',           // Set variation sale price
    ],

    /**
     * You can also set any other valid resource/subresource combination.
     * Ref.: https://developers.e-com.plus/docs/api/#/store/
     */
  },

  admin_settings: {
    /**
     * JSON schema based fields to be configured by merchant and saved to app `data` / `hidden_data`, such as:
**/
    base_url: {
      schema: {
        type: 'string',
        maxLength: 255,
        format: 'uri',
        title: 'Url base para endpoint de conexão (seu local)',
        description: 'Solicite ao suporte do erp por base url'
      },
      hide: true
    },
    username: {
      schema: {
        type: 'string',
        maxLength: 255,
        title: 'Usuário',
        description: 'Usuário para acesso a API'
      },
      hide: true
    },
    password: {
      schema: {
        type: 'string',
        maxLength: 255,
        title: 'Senha',
        description: 'Senha para acesso a API'
      },
      hide: true
    },
    company_code: {
      schema: {
        type: 'integer',
        "minimum": 1,
        "maximum": 999999,
        "default": 1,
        title: 'Código da Empresa',
        description: 'Código da Empresa cadastrado no ERP. (Padrão: 1)'
      },
      hide: true
    },
    subsidiary_code: {
      schema: {
        type: 'integer',
        minimum: 1,
        maximum: 999999,
        default: 1,
        title: 'Código da Empresa',
        description: 'Código da Filial cadastrado no ERP. (Padrão: 1)'
      },
      hide: true
    },
    sale_code: {
      schema: {
        type: 'integer',
        minimum: 1,
        maximum: 999999,
        default: 1,
        title: 'Código do Método de Venda',
        description: 'Código do Método de Venda usado nos pedidos para classificação no ERP HORUS. (Padrão: 1)'
      },
      hide: true
    },
    products: {
      schema: {
        title: 'Produtos',
        description: 'Configurações para importações de produtos para E-com',
        type: 'object',
        properties: {
          update_quantity: {
            type: 'boolean',
            defaut: false,
            title: 'Atualização de estoque',
            description: 'Atualizar estoque automaticamente na E-com'
          },
          update_product: {
            type: 'boolean',
            default: false,
            title: 'Sobrescrever produto',
            description: 'Atualizar cadastro (não apenas estoque) de produtos importados já existentes na E-com'
          },
          update_price: {
            type: 'boolean',
            default: false,
            title: 'Atualização de preço',
            description: 'Atualizar preço automaticamente na E-com'
          },
        }
      },
      hide: false
    },
    orders: {
      schema: {
        title: 'Pedidos',
        description: 'Configuração para exportar pedidos para o ERP',
        type: 'object',
        properties: {
          new_orders: {
            type: 'boolean',
            default: true,
            title: 'Exportar novos pedidos',
            description: 'Criar novos pedidos automaticamente'
          },
          approved_order_only: {
            type: 'boolean',
            default: false,
            title: 'Apenas pedidos aprovados',
            description: 'Criar pedidos após aprovação'
          },
          responsible: {
            title: 'Responsável cadastro cliente',
            description: 'Informações utilizadas para cadastro de cliente.',
            type: 'object',
            properties: {
              code: {
                schema: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 999999,
                  default: 1,
                  title: 'Código do responsável no ERP. (Padrão: 1)',
                }
              },
              name : {
                schema: {
                  type: 'string',
                  maxLength: 255,
                  default: 'ecomplus',
                  title: 'Nome do responsável no ERP. (Padrão: ecomplus)',
                }
              }
            }
          },
        }
      },
      hide: true
    },
    payments: {
      schema: {
        title: 'Formas de Pagamento',
        description: 'Mapear formas de pagamento cadastradas no ERP. (Padrão: 1, se não informado)',
        type: "array",
        maxItems: 5,
        items: {
          title: "Forma de Pagamento",
          type: "object",
          minProperties: 1,
          properties: {
            name : {
              type: "string",
              enum: [
                "Cartão de Crédito",
                "Boleto",
                "Pix",
                "Cartão Débito",
                "Programa de Pontos",
              ],
              default: "Crédito",
              title: "Forma de Pagamento",
            },
            code: {
              type: 'integer',
              minimum: 1,
              maximum: 999999,
              default: 1,
              title: 'Código da Forma de Pagamento no ERP',
            }
          }
        }
      },
      hide: true
    },
    delivery: {
      schema: {
        title: 'Frete',
        description: 'Mapear Transportadoras cadastradas no ERP. (Padrão: 1, se não informado)',
        type: "array",
        // maxItems: 5,
        items: {
          title: "Transportadoras",
          type: "object",
          minProperties: 1,
          required: [
            'app_id',
            'code'
          ],
          properties: {
            app_id : {
              type: 'string',
              pattern: '^[a-f0-9]{24}$',
              title: 'ID do aplicativo de entrega instalado'
            },
            code: {
              type: 'integer',
              minimum: 1,
              maximum: 999999,
              default: 1,
              title: 'Código da Transportadora no ERP',
            },
            label: {
              type: "string",
              maxLength: 50,
              title: "Rótulo",
              description: "Nome do serviço de entrega, cadastrados como transportadoras diferentes no ERP. [Ex.: PAC, SEDEX] (Opcional)"
            },
          }
        }
      },
      hide: true
    },
    importation: {
      schema: {
        title: 'Importação manual',
        description: 'Fila a importar do erp, serão removidos automaticamente após importação',
        type: 'object',
        properties: {
          products: {
            title: 'Produtos a importar',
            type: 'array',
            items: {
              type: 'string',
              title: 'Código do produto no erp',
              description: 'Código do produto no erp que você deseja importar para a E-com'
            }
          }
        }
      },
      hide: false
    },
    exportation: {
      schema: {
        title: 'Exportação manual',
        description: 'Fila a exportar para o erp',
        type: 'object',
        properties: {
          orders: {
            title: 'Pedidos a exportar',
            type: 'array',
            items: {
              type: 'string',
              pattern: '^[a-f0-9]{24}$',
              title: 'ID do pedido'
            }
          }
        }
      },
      hide: false
    },
    // init_store: {
    //   schema: {
    //     title: 'Setup inicial',
    //     description: 'Primeira importação do ERP',
    //     type: 'object',
    //     properties: {
    //       cod_item_end: {
    //         title: 'Código do último produto cadatrado no ERP',
    //         type: 'number',
    //       }
    //     }
    //   },
    //   hide: false
    // },
  }
}

/**
 * List of Procedures to be created on each store after app installation.
 * Ref.: https://developers.e-com.plus/docs/api/#/store/procedures/
 */

const procedures = []

/**
 * Uncomment and edit code above to configure `triggers` and receive respective `webhooks`:
**/
const { baseUri } = require('./__env')

procedures.push({
  title: app.title,

  triggers: [
    // Receive notifications when new order is created:
    {
      resource: 'orders',
      field: 'financial_status',
    },
    {
      resource: 'orders',
      field: 'fulfillment_status',
    },

    // Receive notifications when products/variations prices changes:
    {
      resource: 'products',
      field: 'price',
    },
    {
      resource: 'products',
      subresource: 'variations',
      field: 'price',
    },

    // Receive notifications when new product is created:
    {
      resource: 'products',
      action: 'create',
    },

    // Receive notifications when customer is deleted:
    {
      resource: 'customers',
      action: 'create',
    },

    // Feel free to create custom combinations with any Store API resource, subresource, action and field.
  ],

  webhooks: [
    {
      api: {
        external_api: {
          uri: `${baseUri}/ecom/webhook`
        }
      },
      method: 'POST'
    }
  ]
})
/*
 * You may also edit `routes/ecom/webhook.js` to treat notifications properly.
 */

exports.app = app

exports.procedures = procedures
