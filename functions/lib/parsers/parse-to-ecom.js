const parsePrice = (str) => {
  if (str) {
    return parseFloat(str.replace(',', '.'))
  }
  return str
}

module.exports = {
  parsePrice
}
