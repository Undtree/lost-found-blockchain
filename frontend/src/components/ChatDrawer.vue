<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    @opened="handleDrawerOpen"
    @closed="handleDrawerClose"
    direction="rtl"
    size="90%"
    :style="{ maxWidth: '500px' }"
    :with-header="true"
    title="安全聊天"
  >
    <div class="chat-wrapper" v-loading="loading">
      <div class="chat-messages" ref="messageListRef">
        <div v-for="msg in messages" :key="msg._id" class="message-row">
          <div
            class="message-bubble"
            :class="{
              sent: msg.senderAddress.toLowerCase() === currentUserAddress.toLowerCase(),
              received: msg.senderAddress.toLowerCase() !== currentUserAddress.toLowerCase(),
            }"
          >
            <p class="message-content">{{ msg.content }}</p>
            <span class="message-time">{{ formatTime(msg.createdAt) }}</span>
          </div>
        </div>
      </div>

      <div class="chat-input-area">
        <el-input
          v-model="newMessageContent"
          placeholder="输入消息..."
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          resize="none"
          @keydown.enter.prevent="handleSendMessage"
        />
        <el-button
          type="primary"
          @click="handleSendMessage"
          :disabled="!newMessageContent || loading"
          style="margin-left: 10px"
        >
          发送
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, watch, nextTick, toRaw } from 'vue'
import { ElNotification } from 'element-plus'
import itemService from '@/api/itemService'
import { useEthers } from '@/composables/useEthers'
import { useSocket } from '@/composables/useSocket'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  itemId: {
    type: String,
    required: true,
  },
  // 当前登录用户的地址
  currentUserAddress: {
    type: String,
    required: true,
  },
})

defineEmits(['update:visible'])

const { signer } = useEthers()
const {
  isConnected,
  newMessage,
  joinedRoomId,
  initializeSocket,
  disconnectSocket,
  joinRoom,
  sendMessage,
} = useSocket()

const loading = ref(false)
const messages = ref([])
const newMessageContent = ref('')
const targetAddress = ref(null) // 聊天的对方地址
const messageListRef = ref(null) // 用于滚动

/**
 * 滚动到消息列表底部
 */
const scrollToBottom = () => {
  nextTick(() => {
    const el = messageListRef.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  })
}

/**
 * 格式化时间
 */
const formatTime = (isoString) => {
  if (!isoString) return ''
  return new Date(isoString).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 抽屉打开时的核心逻辑
 */
const handleDrawerOpen = async () => {
  loading.value = true
  messages.value = []
  targetAddress.value = null

  if (!signer.value || !props.currentUserAddress) {
    ElNotification.error('钱包未连接，无法开始聊天')
    loading.value = false
    return
  }

  // 1. 生成一次性签名，用于所有 API 和 Socket 认证
  const messageToSign = `为钱包 ${props.currentUserAddress} 认证聊天功能`
  let signature
  try {
    const rawSigner = toRaw(signer.value)
    signature = await rawSigner.signMessage(messageToSign)
  } catch (err) {
    // [!! 已修复 !!]
    console.error('聊天签名失败:', err)

    if (err.code === 'ACTION_REJECTED') {
      ElNotification.error('您取消了签名，无法开始聊天')
    } else {
      ElNotification.error('签名失败，无法开始聊天')
    }

    loading.value = false
    return
  }

  const authData = {
    userAddress: props.currentUserAddress,
    signature: signature,
    signatureMessage: messageToSign,
  }

  try {
    // 2. 获取聊天的目标地址
    const targetRes = await itemService.getChatTarget(props.itemId, authData)
    targetAddress.value = targetRes.data.data.targetAddress

    // 3. 获取历史消息
    const messagesRes = await itemService.getChatMessages(props.itemId, authData)
    messages.value = messagesRes.data.data
    scrollToBottom()

    // 4. [!! 核心 !!] 初始化 Socket.IO 连接 (传入签名)
    initializeSocket(signature, messageToSign)

    // 5. 等待连接成功后，加入房间
    // (我们使用 watch 监听 isConnected)
  } catch (err) {
    // [!! 已修复 !!]
    console.error('加载聊天数据失败:', err)
    ElNotification.error(
      `加载聊天失败: ${err.response?.data?.message || err.message}`,
    )
  } finally {
    loading.value = false
  }
}

/**
 * 抽屉关闭时，断开 Socket 连接
 */
const handleDrawerClose = () => {
  disconnectSocket()
  messages.value = []
  newMessageContent.value = ''
  targetAddress.value = null
}

/**
 * 发送消息
 */
const handleSendMessage = () => {
  if (!newMessageContent.value.trim() || !targetAddress.value) return
  if (!isConnected.value) {
    ElNotification.warning('聊天服务未连接，请稍后重试')
    return
  }

  sendMessage({
    conversationId: props.itemId,
    receiverAddress: targetAddress.value,
    content: newMessageContent.value.trim(),
  })

  // (注意：我们不再需要手动将消息推入数组)
  // (Socket.IO 会将我们发送的消息广播回来，由 newMessage 监听器统一处理)
  newMessageContent.value = ''
}

// 监听 Socket 是否连接成功
watch(isConnected, (newVal) => {
  if (newVal === true) {
    // 1. 确保我们是在这个物品的抽屉里
    if (props.visible && props.itemId) {
      // 2. 确保我们没有重复加入
      if (joinedRoomId.value !== props.itemId) {
        joinRoom(props.itemId)
      }
    }
  }
})

// 监听 Socket 传来的新消息
watch(newMessage, (newMsg) => {
  if (newMsg && newMsg.conversationId === props.itemId) {
    messages.value.push(newMsg)
    scrollToBottom()
  }
})
</script>

<style scoped>
.chat-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.chat-input-area {
  display: flex;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color);
}

.message-row {
  display: flex;
  margin-bottom: 12px;
}

.message-bubble {
  max-width: 80%;
  padding: 10px 15px;
  border-radius: 18px;
  position: relative;
}

.message-content {
  margin: 0;
  word-break: break-all;
  white-space: pre-wrap;
  font-size: 14px;
}

.message-time {
  display: block;
  font-size: 10px;
  color: #909399;
  margin-top: 5px;
}

/* 我发送的消息 */
.message-row:has(.sent) {
  justify-content: flex-end;
}
.sent {
  background-color: var(--el-color-primary);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.sent .message-time {
  text-align: right;
  color: #e0e0e0;
}

/* 接收到的消息 */
.received {
  background-color: #ffffff;
  border: 1px solid #e9e9eb;
  color: #303133;
  border-bottom-left-radius: 4px;
}
</style>
