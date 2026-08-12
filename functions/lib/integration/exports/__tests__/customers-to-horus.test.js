const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildCustomerBody } = require('../customers-to-horus')

const baseCustomer = {
  main_email: 'buyer@example.com',
  display_name: 'Comprador Teste',
  registry_type: 'j',
  doc_number: '20451092000133'
}
const baseAppData = {}

test('does not send INS_ESTADUAL even when inscription_number is filled', () => {
  // Regression: Horus' /InsAltCliente rejects the INS_ESTADUAL/INS_MUNICIPAL
  // param outright ("Não foi reconhecido o parâmetro"), even with a valid
  // value, which used to block the customer (and its order) from syncing.
  const customer = {
    ...baseCustomer,
    inscription_type: 'State',
    inscription_number: 'Isento'
  }

  const body = buildCustomerBody(customer, baseAppData, null, 51505)

  assert.equal(body.INS_ESTADUAL, undefined)
  assert.equal(body.INS_MUNICIPAL, undefined)
})

test('does not send INS_MUNICIPAL when inscription_type is Municipal', () => {
  const customer = {
    ...baseCustomer,
    inscription_type: 'Municipal',
    inscription_number: '123456'
  }

  const body = buildCustomerBody(customer, baseAppData, null, 51505)

  assert.equal(body.INS_MUNICIPAL, undefined)
  assert.equal(body.INS_ESTADUAL, undefined)
})

test('still builds a valid CNPJ body without inscription fields', () => {
  const body = buildCustomerBody(baseCustomer, baseAppData, null, 51505)

  assert.equal(body.TPO_PESSOA, 'J')
  assert.equal(body.CNPJ, '20451092000133')
  assert.equal(body.COD_CLI, 'NOVO')
})
