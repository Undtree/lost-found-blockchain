<template>
  <div class="wallet-connect-wrapper">
    <el-tooltip v-if="!account" content="连接 MetaMask" placement="bottom" effect="dark">
      <button class="wallet-logo-button" @click="connectWallet">
        <img :src="metamaskLogo" alt="MetaMask Logo" class="metamask-logo" />
      </button>
    </el-tooltip>

    <el-tooltip v-else :content="`已连接: ${formattedAccount}`" placement="bottom" effect="dark">
      <button class="wallet-logo-button connected">
        <img :src="metamaskLogo" alt="MetaMask Logo" class="metamask-logo" />
        <div class="connected-dot"></div>
      </button>
    </el-tooltip>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useEthers } from '@/composables/useEthers.js'
// 确保你的 Logo 路径正确
import metamaskLogo from '@/assets/images/MetaMask-logo-black.svg'

const { connectWallet, account } = useEthers()

const formattedAccount = computed(() => {
  if (account.value) {
    return `${account.value.substring(0, 6)}...${account.value.substring(account.value.length - 4)}`
  }
  return ''
})
</script>

<style scoped>
.wallet-connect-wrapper {
  display: flex;
  flex-direction: column; /* 允许警告框在下方显示 */
  align-items: center;
  justify-content: center;
  height: 100%;
}

.wallet-logo-button {
  background: none;
  /* 使用主题色作为边框 */
  border: 2px solid var(--el-border-color-light);
  border-radius: 50%; /* 圆形按钮 */
  padding: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s ease;
}
.wallet-logo-button:hover {
  border-color: var(--el-color-primary); /* 悬停时使用主题色 */
}

.metamask-logo {
  width: 28px;
  height: 28px;
}

/* 已连接时的样式 */
.wallet-logo-button.connected {
  border-color: var(--el-color-success); /* 绿色边框 */
}

/* 连接状态的绿点 */
.connected-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  background-color: var(--el-color-success);
  border-radius: 50%;
  border: 1px solid white;
}
</style>
