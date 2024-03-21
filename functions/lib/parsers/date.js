const parseDate = (date = new Date(), isComplete) => {
  let format = `${date.getDay()}/${date.getMonth() + 1}/${date.getFullYear()}`
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
