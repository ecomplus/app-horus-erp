const parseDate = (date = new Date(), isComplete) => {
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  let format = `${day < 10 ? `0${day}` : day}`
  format += `/${month < 10 ? `0${month}` : month}/${year}`

  if (isComplete) {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const seconds = date.getSeconds()

    format += ` ${hours < 10 ? `0${hours}` : hours}`
    format += `:${minutes < 10 ? `0${minutes}` : minutes}`
    format += `:${seconds < 10 ? `0${seconds}` : seconds}`
  }
  return format
}

module.exports = parseDate
