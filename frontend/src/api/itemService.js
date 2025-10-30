// src/api/itemService.js
import axios from 'axios'

// 你的后端 API 地址
const API_URL = 'http://localhost:3001/api'

const apiClient = axios.create({
  baseURL: API_URL,
})

export default {
  /**
   * 获取所有物品
   */
  getItems() {
    return apiClient.get('/items')
  },

  /**
   * 获取单个物品详情
   * @param {string} id - 数据库的 _id
   */
  getItemById(id) {
    return apiClient.get(`/items/${id}`)
  },

  /**
   * 上传并发布新物品
   * @param {FormData} formData - 包含图片和表单数据的 FormData
   */
  uploadItem(formData) {
    return apiClient.post('/items/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  /**
   * 在链上认领成功后，通知后端更新数据库状态
   * @param {string} id - 数据库的 _id
   * @param {object} data - 包含 { losterAddress: '0x...' }
   */
  markItemAsClaimed(id, data) {
    return apiClient.post(`/items/${id}/claim-db`, data)
  },

  /**
   * 获取当前连接的钱包所发布的物品
   * @param {string} address - 拾物者的钱包地址
   */
  getMyItems(address) {
    return apiClient.get(`/items/my-items/${address}`)
  },

  /**
   * 提交认领申请 (失主 Loster 调用)
   * @param {string} id - 物品的 _id
   * @param {object} claimData - 包含 { applierAddress, secretMessage, signature, signatureMessage }
   */
  submitClaim(id, claimData) {
    return apiClient.post(`/items/${id}/submit-claim`, claimData)
  },

  /**
   * 拒绝一个认领申请 (Finder 调用)
   * @param {string} itemId - 物品的 _id
   * @param {string} claimId - 申请的 _id
   * @param {object} data - 包含 { finderAddress, signature, signatureMessage }
   */
  rejectClaim(itemId, claimId, data) {
    return apiClient.post(`/items/${itemId}/claims/${claimId}/reject`, data)
  },
}
