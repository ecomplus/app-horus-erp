'use strict'
const axios = require('axios')

class Horus {
  constructor(baseURL, username, password) {
    if (!username && !password) {
      throw new Error('Missing username or password')
    } else if (!baseURL) {
      throw new Error('Missing or invalid Base url')
    }
    this.request = axios.create({
      baseURL,
      auth: {
        username,
        password
      }
    })
  }

  get ({ path }) {
    return this.request({
      method: 'get',
      url: path
    })
  }

  post ({ path, data }) {
    return this.request({
      method: 'post',
      url: path,
      data
    })
  }

  patch ({ path, data }) {
    return this.request({
      method: 'patch',
      url: path,
      data
    })
  }

  delete ({ path }) {
    return this.request({
      method: 'delete',
      url: path
    })
  }
}

module.exports = Horus
