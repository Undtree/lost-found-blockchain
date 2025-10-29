// src/composables/useEthers.js
import { ref, readonly } from 'vue'
import { ethers } from 'ethers'
import { ElNotification } from 'element-plus'

// --- 1. 定义 Hardhat 的 Chain ID (保持不变) ---
const HARDHAT_CHAIN_ID = '31337'

// --- 2. 全局状态 (保持不变) ---
const provider = ref(null)
const signer = ref(null)
const account = ref(null)

// --- 3. 内部断开连接逻辑 (保持不变) ---
function internalDisconnectWallet() {
  provider.value = null
  signer.value = null
  account.value = null
}

// --- 4. 检查网络的辅助函数 (保持不变) ---
async function checkNetwork(browserProvider) {
  try {
    const network = await browserProvider.getNetwork()
    if (network.chainId.toString() !== HARDHAT_CHAIN_ID) {
      ElNotification.error(
        '网络错误！请在 MetaMask 中切换到 Hardhat Localhost (Chain ID: 31337) 网络。',
      )
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${Number(HARDHAT_CHAIN_ID).toString(16)}` }],
        })
      } catch (switchError) {
        console.error('自动切换网络失败:', switchError)
      }
      return false
    }
    return true
  } catch (err) {
    console.error('检查网络失败:', err)
    return false
  }
}

// --- 5. [!! 核心修复 !!] 内部事件监听逻辑 ---
// [!! 修复 A !!] 函数现在接收“原始的” provider 对象
function setupEventListeners(rawBrowserProvider) {
  if (!window.ethereum) return

  window.ethereum.removeAllListeners('accountsChanged')
  window.ethereum.removeAllListeners('chainChanged')

  // [!! 修复 B !!] 监听账户切换 (不再使用 .value)
  window.ethereum.on('accountsChanged', async (newAccounts) => {
    if (newAccounts.length === 0) {
      ElNotification.info('您已断开钱包连接')
      internalDisconnectWallet()
    } else {
      account.value = newAccounts[0]

      // [!! 修复 C !!]
      // 直接使用传入的“原始” provider，而不是 Vue Proxy
      if (rawBrowserProvider) {
        try {
          // 在“原始”对象上调用 .getSigner() 是安全的
          signer.value = await rawBrowserProvider.getSigner(newAccounts[0])
          ElNotification.success('钱包账户已动态切换')
        } catch (err) {
          console.error('动态获取 Signer 失败:', err)
          ElNotification.error('获取新账户Signer失败，请刷新页面')
          internalDisconnectWallet()
        }
      } else {
        // 这种情况不应该发生，但作为保险
        ElNotification.error('Provider丢失(listeners)，请刷新页面')
        internalDisconnectWallet()
      }
    }
  })

  // 监听网络切换 (保持不变)
  window.ethereum.on('chainChanged', (_chainId) => {
    ElNotification.info('检测到网络切换，正在刷新页面...')
    window.location.reload()
  })
}

// --- 6. 导出的 `useEthers` 函数 (已修改) ---
export function useEthers() {
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        ElNotification.error('请安装 MetaMask 钱包！')
        return
      }
      // 1. 创建“原始” provider
      const browserProvider = new ethers.BrowserProvider(window.ethereum)

      const isNetworkCorrect = await checkNetwork(browserProvider)
      if (!isNetworkCorrect) {
        internalDisconnectWallet()
        return
      }

      const aSigner = await browserProvider.getSigner()
      const anAccount = await aSigner.getAddress()

      // 2. 将“原始” provider 存入 ref (Vue 会将其转为 Proxy)
      provider.value = browserProvider
      signer.value = aSigner
      account.value = anAccount

      // [!! 修复 D !!] 将“原始” provider 传给监听器
      setupEventListeners(browserProvider)
    } catch (e) {
      // ... (catch 块保持不变) ...
    }
  }

  const disconnectWallet = () => {
    /* ... (保持不变) ... */
  }

  return { connectWallet, disconnectWallet, provider, signer, account }
}

// --- 7. [!! 核心修复 !!] 自动连接逻辑 (已重构) ---
const autoConnectOnPageLoad = async () => {
  if (!window.ethereum) {
    console.log('MetaMask not installed.')
    return
  }

  try {
    // 1. 在所有操作之前，创建“原始” provider
    const browserProvider = new ethers.BrowserProvider(window.ethereum)

    // [!! 修复 E !!] 立即将“原始” provider 传给监听器
    // 这样即使用户未连接，切换网络/账户也能被正确处理
    setupEventListeners(browserProvider)

    // 2. 检查网络
    const isNetworkCorrect = await checkNetwork(browserProvider)
    if (!isNetworkCorrect) {
      console.log('自动连接失败：网络不正确。')
      return
    }

    // 3. 静默检查账户
    const accounts = await browserProvider.send('eth_accounts', [])

    if (accounts.length > 0) {
      const anAccount = accounts[0]
      const aSigner = await browserProvider.getSigner(anAccount)

      // 4. 将“原始” provider 存入 ref (Vue 会将其转为 Proxy)
      provider.value = browserProvider
      signer.value = aSigner
      account.value = anAccount

      console.log('Wallet auto-connected:', anAccount)
    } else {
      console.log('No accounts found (user not pre-connected).')
    }
  } catch (err) {
    console.error('Failed to auto-connect wallet:', err)
  }
}

// 立即执行自动连接检查
autoConnectOnPageLoad()
