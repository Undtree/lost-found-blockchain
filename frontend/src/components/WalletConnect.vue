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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.wallet-logo-button {
  background: none;
  border: 2px solid var(--el-border-color-light);
  border-radius: 50%;
  padding: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s ease;
}
.wallet-logo-button:hover {
  border-color: var(--el-color-primary);
}

.metamask-logo {
  width: 28px;
  height: 28px;
}

/* 已连接时的样式 */
.wallet-logo-button.connected {
  border-color: var(--el-color-success);
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
