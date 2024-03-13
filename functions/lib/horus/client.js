'use strict'
const axios = require('axios')

// http://seu_local/Horus/api/TServerB2B/

class Horus {
  constructor (username, password, baseURL) {
    if (!username && !password) {
      throw new Error('Missing username or password')
    }

    if (!baseURL) {
      this._baseURL = 'http://datacenter.fmz.com.br:8060/Horus/api/TServerB2B'
    } else {
      this._baseURL = `${baseURL}/Horus/api/TServerB2B`
    }

    this._request = axios.create({
      baseURL: this._baseURL,
      auth: {
        username,
        password
      }
    })
  }

  get (url) {
    return this._request({
      method: 'get',
      url
    })
  }

  post (url, data) {
    return this._request({
      method: 'post',
      url,
      data
    })
  }

  patch (url, data) {
    return this._request({
      method: 'patch',
      url,
      data
    })
  }

  delete (url) {
    return this._request({
      method: 'delete',
      url
    })
  }
}

module.exports = Horus
