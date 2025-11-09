// src/api/itemService.js
import axios from 'axios'

// 后端 API 地址
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

  updateItem(id, itemData) {
    return apiClient.put(`/items/${id}`, itemData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
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
   * 上传图片进行 AI 分析
   * @param {FormData} formData - 仅包含 'image' 字段
   */
  analyzeImage(formData) {
    return apiClient.post('/items/analyze-image', formData, {
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
   * 获取当前连接的钱包所申请的物品
   * @param {string} address - 申请者的钱包地址
   */
  getMyClaims(address) {
    return apiClient.get(`/items/my-claims/${address}`)
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

  /**
   * 批准一个认领申请 (Finder 调用, 链下)
   * @param {string} itemId
   * @param {string} claimId
   * @param {object} data - 包含 { finderAddress, signature, signatureMessage }
   */
  approveClaim(itemId, claimId, data) {
    return apiClient.post(`/items/${itemId}/claims/${claimId}/approve`, data)
  },

  /**
   * 取消交接 (Finder 调用, 链下)
   * @param {string} itemId
   * @param {object} data - 包含 { finderAddress, signature, signatureMessage }
   */
  cancelHandover(itemId, data) {
    return apiClient.post(`/items/${itemId}/cancel-handover`, data)
  },

  /**
   * 获取聊天的目标地址 (Finder 或 Loster)
   * @param {string} id - 物品的 _id
   * @param {object} authData - 包含 { userAddress, signature, signatureMessage }
   */
  getChatTarget(id, authData) {
    return apiClient.post(`/items/${id}/chat-target`, authData)
  },

  /**
   * 获取特定物品的历史消息
   * @param {string} id - 物品的 _id
   * @param {object} authData - 包含 { userAddress, signature, signatureMessage }
   */
  getChatMessages(id, authData) {
    return apiClient.post(`/items/${id}/messages`, authData)
  },

  /**
   * 使用向量搜索物品
   * @param {string} query - 用户的搜索词
   */
  searchItems(query) {
    return apiClient.get('/items/search', {
      params: {
        q: query
      }
    })
  },
}
