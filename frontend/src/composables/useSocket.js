// src/composables/useSocket.js
import { ref, onUnmounted } from 'vue'
import { io } from 'socket.io-client'
import { ElNotification } from 'element-plus'

const SOCKET_URL = 'http://localhost:3001' // 你的 Socket.IO 服务器地址

// socket 实例应该是响应式的
const socket = ref(null)

export function useSocket() {
  // 暴露给外部的状态
  const isConnected = ref(false)
  const newMessage = ref(null) // 用来接收新消息
  const connectionError = ref(null) // 用来接收错误
  const joinedRoomId = ref(null) // 确认已加入的房间

  /**
   * 初始化并连接 Socket.IO
   * @param {string} signature - 用于 Socket.IO 中间件认证的签名
   * @param {string} message - 签名的原始消息
   */
  const initializeSocket = (signature, message) => {
    // 1. 检查是否已有连接，如果有则先断开
    if (socket.value && socket.value.connected) {
      console.log('Socket 已连接，重用现有连接。')
      isConnected.value = true
      return
    }

    // 2. 创建新的 Socket 实例
    // [!! 核心 !!] 将签名作为 auth 握手信息发送
    socket.value = io(SOCKET_URL, {
      auth: {
        signature,
        message,
      },
      transports: ['websocket'], // 优先使用 WebSocket
      autoConnect: true,
    })

    // 3. 移除所有旧的监听器，防止重复
    socket.value.removeAllListeners()

    // 4. 设置监听器
    socket.value.on('connect', () => {
      console.log('Socket.IO 已连接:', socket.value.id)
      isConnected.value = true
      connectionError.value = null
    })

    socket.value.on('disconnect', () => {
      console.log('Socket.IO 已断开连接')
      isConnected.value = false
    })

    // [!! 核心 !!] 监听后端 `io.use()` 中间件返回的错误
    socket.value.on('connect_error', (err) => {
      console.error('Socket.IO 连接认证失败:', err.message)
      ElNotification.error(`聊天认证失败: ${err.message}`)
      connectionError.value = err.message
      disconnectSocket() // 认证失败，主动断开
    })

    // [!! 核心 !!] 监听后端发送的通用错误
    socket.value.on('error', (data) => {
      console.error('Socket.IO 服务器错误:', data.message)
      ElNotification.error(`聊天室错误: ${data.message}`)
    })

    // [!! 核心 !!] 监听后端确认加入房间
    socket.value.on('joinedRoom', (itemId) => {
      console.log(`成功加入房间: ${itemId}`)
      joinedRoomId.value = itemId
    })

    // [!! 核心 !!] 监听新消息
    socket.value.on('newMessage', (message) => {
      newMessage.value = message
    })

    // [!! 核心 !!] 监听消息发送失败
    socket.value.on('messageError', (data) => {
      console.error('消息发送失败:', data.message)
      ElNotification.error(`消息发送失败: ${data.message}`)
    })
  }

  /**
   * 主动断开 Socket.IO 连接
   */
  const disconnectSocket = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      isConnected.value = false
      joinedRoomId.value = null
      console.log('Socket.IO 已主动断开')
    }
  }

  /**
   * 加入一个房间
   * @param {string} itemId - 房间 ID (即物品 ID)
   */
  const joinRoom = (itemId) => {
    if (socket.value && socket.value.connected) {
      socket.value.emit('joinRoom', itemId)
    } else {
      console.error('Socket 未连接，无法加入房间')
    }
  }

  /**
   * 发送一条消息
   * @param {object} data - { conversationId, receiverAddress, content }
   */
  const sendMessage = (data) => {
    if (socket.value && socket.value.connected) {
      socket.value.emit('sendMessage', data)
    } else {
      console.error('Socket 未连接，无法发送消息')
    }
  }

  // 确保在组件卸载时断开连接，防止内存泄漏
  onUnmounted(() => {
    // 注意：如果多个组件使用 useSocket，这里可能会过早断开。
    // 在 ChatDrawer 中单独调用 disconnect 会更安全。
    // 我们将在 ChatDrawer 中处理断开逻辑。
  })

  return {
    socket,
    isConnected,
    newMessage,
    connectionError,
    joinedRoomId,
    initializeSocket,
    disconnectSocket,
    joinRoom,
    sendMessage,
  }
}
