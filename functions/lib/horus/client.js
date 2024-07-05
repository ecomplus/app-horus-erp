'use strict'
const axios = require('axios')

// http://seu_local/Horus/api/TServerB2B/

class Horus {
  constructor (username, password, baseURL) {
    if (!username && !password) {
      throw new Error('Missing username or password')
    }

    this._baseURL = baseURL || 'http://waphorus.dalla.srv.br:8065/Horus/api/TServerB2B'

    this._request = axios.create({
      baseURL: this._baseURL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' +
          Buffer.from(`${username}:${password}`, 'utf8').toString('base64')
      },
      timeout: 10000
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

  put (url, data) {
    return this._request({
      method: 'put',
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
