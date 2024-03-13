const parseDate = (date = new Date(), isComplete) => {
  let format = `${date.getDay()}/${date.getMonth() + 1}/${date.getFullYear()}`
  if (isComplete) {
    format += ` ${date.getHours}:${date.getMinutes()}:${date.getSeconds()}`
  }
  return format
}

module.exports = parseDate
