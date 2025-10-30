<template>
  <el-row justify="center">
    <el-col :xs="24" :sm="20" :md="18" :lg="16">
      <Transition name="page-content-fade" mode="out-in">
        <el-skeleton :rows="5" animated v-if="loading" key="skeleton" />

        <div v-else-if="!loading && item" key="content">
          <el-row :gutter="10">
            <el-col :xs="24" :sm="24" :md="12">
              <el-card shadow="always" :body-style="{ padding: '0px' }" class="image-card-wrapper">
                <div class="image-container" @click="openPreview">
                  <img :src="item.imageUrl" class="detail-image" alt="物品图片" />
                  <div class="image-hover-mask">
                    <el-icon class="zoom-icon" :size="40"><ZoomIn /></el-icon>
                  </div>
                </div>
              </el-card>
            </el-col>

            <el-col :xs="24" :sm="24" :md="12">
              <el-card shadow="always" class="detail-card-wrapper">
                <h2 class="item-title">{{ item.name }}</h2>
                <p class="item-description">{{ item.description }}</p>
                <el-divider />
                <div class="item-descriptions">
                  <div class="custom-descriptions-row">
                    <div class="custom-descriptions-label">状态</div>
                    <div class="custom-descriptions-value">
                      <el-tag
                        :type="item.status === 'available' ? 'success' : 'info'"
                        disable-transitions
                      >
                        {{ item.status === 'available' ? '可认领' : '已认领' }}
                      </el-tag>
                    </div>
                  </div>
                  <div class="custom-descriptions-row">
                    <div class="custom-descriptions-label">拾获地点</div>
                    <div class="custom-descriptions-value">{{ item.location }}</div>
                  </div>
                  <div class="custom-descriptions-row">
                    <div class="custom-descriptions-label">Token ID</div>
                    <div class="custom-descriptions-value">{{ item.tokenId }}</div>
                  </div>
                  <div class="custom-descriptions-row">
                    <div class="custom-descriptions-label">拾物者 (Finder)</div>
                    <div class="custom-descriptions-value">
                      <span class="address-text">{{ item.finderAddress }}</span>
                    </div>
                  </div>
                  <div class="custom-descriptions-row" v-if="item.status === 'claimed'">
                    <div class="custom-descriptions-label">认领者 (Loster)</div>
                    <div class="custom-descriptions-value">
                      <span class="address-text">{{ item.losterAddress }}</span>
                    </div>
                  </div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <el-card shadow="always" class="action-card-wrapper" v-if="isAvailable">
            <div class="action-area">
              <div
                v-if="
                  !isFinder &&
                  (myCurrentClaimStatus === null || myCurrentClaimStatus === 'rejected')
                "
              >
                <el-alert
                  v-if="myCurrentClaimStatus === 'rejected'"
                  title="申请未通过"
                  type="error"
                  description="你上次提交的申请已被拾物者拒绝。请核对关键信息后重新提交。"
                  :closable="false"
                  style="margin-bottom: 15px"
                />
                <el-alert
                  v-if="myCurrentClaimStatus === null"
                  title="你是失主吗？"
                  type="info"
                  description="请提供关键信息（例如：物品的独特标记、颜色、挂件等）以证明你是失主。"
                  :closable="false"
                  style="margin-bottom: 15px"
                />
                <el-button
                  type="primary"
                  size="large"
                  @click="applyDialogVisible = true"
                  :disabled="!account"
                >
                  {{
                    account
                      ? myCurrentClaimStatus === 'rejected'
                        ? '重新申请认领'
                        : '我来申请认领'
                      : '请先连接钱包'
                  }}
                </el-button>
              </div>
              <div v-if="!isFinder && myCurrentClaimStatus === 'pending'">
                <el-alert
                  title="申请已提交"
                  type="success"
                  description="你的认领申请已提交，请等待拾物者审核并转移 NFT。"
                  :closable="false"
                />
              </div>
              <div v-if="isFinder">
                <h3 class="action-area-title">审核认领申请</h3>
                <el-empty v-if="!claims || claims.length === 0" description="暂无认领申请" />
                <el-card shadow="never" v-if="claims.length > 0" class="claim-list-card">
                  <el-table :data="claims" style="width: 100%">
                    <el-table-column label="申请人 (Loster)">
                      <template #default="scope">
                        <span class="address-text">{{ scope.row.applierAddress }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="secretMessage" label="关键信息" />
                    <el-table-column label="状态" width="100" align="center">
                      <template #default="scope">
                        <el-tag
                          v-if="scope.row.status === 'pending'"
                          type="warning"
                          disable-transitions
                        >
                          待审核
                        </el-tag>
                        <el-tag
                          v-if="scope.row.status === 'approved'"
                          type="success"
                          disable-transitions
                        >
                          已批准
                        </el-tag>
                        <el-tag
                          v-if="scope.row.status === 'rejected'"
                          type="info"
                          disable-transitions
                        >
                          已拒绝
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="200" align="center">
                      <template #default="scope">
                        <div v-if="scope.row.status === 'pending'">
                          <el-button
                            type="primary"
                            :loading="approveLoadingId === scope.row._id"
                            @click="handleApprove(scope.row)"
                          >
                            批准
                          </el-button>
                          <el-button
                            type="danger"
                            :loading="rejectLoadingId === scope.row._id"
                            @click="handleReject(scope.row)"
                          >
                            拒绝
                          </el-button>
                        </div>
                        <span v-else>
                          {{ scope.row.status === 'approved' ? '已批准认领' : '已处理' }}
                        </span>
                      </template>
                    </el-table-column>
                  </el-table>
                </el-card>
              </div>
            </div>
          </el-card>
        </div>

        <el-empty description="未找到物品" v-else key="empty" />
      </Transition>
    </el-col>
  </el-row>

  <el-dialog
    v-model="applyDialogVisible"
    title="提交认领申请"
    width="90%"
    :style="{ maxWidth: '500px' }"
  >
    <p style="margin-top: 0">请输入能证明这是你物品的“关键信息”。拾物者将审核此信息。</p>
    <el-input
      v-model="secretMessage"
      type="textarea"
      :rows="4"
      placeholder="例如：伞柄上有一个小猪佩奇挂件"
    />
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="applyDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitApplication" :loading="applyLoading">
          确认提交 (需钱包签名)
        </el-button>
      </span>
    </template>
  </el-dialog>

  <Transition name="backdrop-fade">
    <div v-if="isPreviewVisible" class="image-preview-backdrop" @click="closePreview"></div>
  </Transition>
  <Transition name="preview-card">
    <div v-if="isPreviewVisible" class="image-preview-wrapper" @click="closePreview">
      <div class="image-preview-card" @click.stop>
        <img v-if="item" :src="item.imageUrl" class="preview-image-content" alt="物品完整图片" />
      </div>
    </div>
  </Transition>
</template>

<script setup>
// [!! <script setup> 部分完全保持不变 !!]
import { ref, onMounted, computed, toRaw, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ethers } from 'ethers'
import { ElNotification } from 'element-plus'
import { ZoomIn } from '@element-plus/icons-vue'
import { useEthers } from '@/composables/useEthers.js'
import itemService from '@/api/itemService.js'
import ContractABI from '@/contracts/LostItemNFT.json'

// --- 状态定义 ---
const route = useRoute()
const router = useRouter()
const item = ref(null)
const loading = ref(true)
// const claimLoading = ref(false)
const approveLoadingId = ref(null)
const rejectLoadingId = ref(null)
const applyLoading = ref(false)
const applyDialogVisible = ref(false)
const secretMessage = ref('')
// [!! 核心修复 !!] 必须调用 useEthers() 函数
const { account, signer } = useEthers()
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'

// --- 预览器状态 ---
const isPreviewVisible = ref(false)
const openPreview = () => {
  isPreviewVisible.value = true
}
const closePreview = () => {
  isPreviewVisible.value = false
}
watch(isPreviewVisible, (newVal) => {
  if (newVal) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})
onUnmounted(() => {
  document.body.style.overflow = ''
})

// --- 计算属性 ---
const isFinder = computed(() => {
  return (
    account.value &&
    item.value &&
    account.value.toLowerCase() === item.value.finderAddress.toLowerCase()
  )
})
const isAvailable = computed(() => {
  return item.value && item.value.status === 'available'
})
const claims = computed(() => {
  return item.value?.claims || []
})
const myCurrentClaimStatus = computed(() => {
  if (!account.value || !item.value || !item.value.claims) {
    return null // Not connected or no claims on item
  }
  const myClaim = item.value.claims.find(
    (c) => c.applierAddress.toLowerCase() === account.value.toLowerCase(),
  )
  return myClaim ? myClaim.status : null // 'pending', 'rejected', 'approved', or null
})

// --- 核心方法 ---
const fetchItem = async () => {
  const id = route.params.id
  if (!id) {
    loading.value = false
    return
  }
  try {
    const response = await itemService.getItemById(id)
    item.value = response.data.data
  } catch (err) {
    console.error('Failed to fetch item', err)
    ElNotification.error('加载物品详情失败')
  } finally {
    loading.value = false
  }
}
onMounted(fetchItem)

const handleSubmitApplication = async () => {
  if (!secretMessage.value) {
    ElNotification.error('请输入关键信息')
    return
  }
  if (!account.value || !signer.value) {
    ElNotification.error('请先连接钱包并授权签名')
    return
  }
  applyLoading.value = true

  let signature
  const messageToSign = `我 (地址: ${account.value}) 确认申请认领物品: ${item.value.name}`

  try {
    const rawSigner = toRaw(signer.value)
    if (!rawSigner) throw new Error('Signer 无效')
    ElNotification.info('请在钱包中签名以确认申请...')
    signature = await rawSigner.signMessage(messageToSign)
  } catch (err) {
    console.error('签名失败:', err)
    ElNotification.error('您取消了签名，或签名失败')
    applyLoading.value = false
    return
  }

  // 发送到后端
  try {
    const claimData = {
      applierAddress: account.value,
      secretMessage: secretMessage.value,
      signature: signature,
      signatureMessage: messageToSign,
    }
    const response = await itemService.submitClaim(item.value._id, claimData)
    item.value = response.data.data
    ElNotification.success({
      title: '申请成功',
      message: '已提交申请，请等待拾物者审核',
    })
    applyDialogVisible.value = false
    secretMessage.value = ''
  } catch (err) {
    ElNotification.error({
      title: '申请失败',
      message: err.response?.data?.message || err.message,
    })
  } finally {
    applyLoading.value = false
  }
}

const handleApprove = async (claim) => {
  const losterAddressToReceive = claim.applierAddress
  const itemToClaim = item.value
  const claimToApprove = claim

  // claimLoading.value = true
  approveLoadingId.value = claimToApprove._id

  if (!signer.value || !account.value) {
    ElNotification.error('请先连接你的钱包！')
    // claimLoading.value = false
    approveLoadingId.value = null
    return
  }
  if (account.value.toLowerCase() !== itemToClaim.finderAddress.toLowerCase()) {
    ElNotification.error('你不是该物品的拾物者，无权操作！')
    // claimLoading.value = false
    approveLoadingId.value = null
    return
  }

  try {
    let validLosterAddress = ''
    let tokenIdBigInt

    try {
      validLosterAddress = ethers.getAddress(losterAddressToReceive)
    } catch (validationError) {
      ElNotification.error('申请人地址无效。无法转移。')
      // claimLoading.value = false
      approveLoadingId.value = null
      return
    }

    try {
      tokenIdBigInt = BigInt(itemToClaim.tokenId)
    } catch (castError) {
      ElNotification.error(`物品 Token ID (${itemToClaim.tokenId}) 无效。`)
      // claimLoading.value = false
      approveLoadingId.value = null
      return
    }

    const rawSigner = toRaw(signer.value)
    if (!rawSigner) {
      ElNotification.error('Signer 无效，请重新连接钱包。')
      // claimLoading.value = false
      approveLoadingId.value = null
      return
    }

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ContractABI.abi, rawSigner)
    ElNotification.info('正在发送交易，请在 MetaMask 中确认...')

    const tx = await contract.claimItem(validLosterAddress, tokenIdBigInt)
    await tx.wait()

    try {
      await itemService.markItemAsClaimed(itemToClaim._id, { losterAddress: validLosterAddress })
    } catch (dbError) {
      console.error('链上成功，但数据库更新失败:', dbError)
      ElNotification.warning('链上交易成功，但后台状态更新失败。')
    }

    ElNotification.success({
      title: '批准成功！',
      message: '物品已成功转移给失主！',
    })

    await fetchItem()
  } catch (err) {
    console.error(err)
    let friendlyMessage = err.reason || err.message || '交易失败'
    if (err.code === 'ACTION_REJECTED') {
      friendlyMessage = '您拒绝了交易请求。'
    } else if (err.data) {
      friendlyMessage = '交易失败，合约已拒绝（Reverted）'
    }
    ElNotification.error({
      title: '交易失败',
      message: friendlyMessage,
    })
  } finally {
    // claimLoading.value = false
    approveLoadingId.value = null
  }
}

// [!! 核心新增: handleReject !!]
const handleReject = async (claim) => {
  const claimToReject = claim
  rejectLoadingId.value = claimToReject._id

  if (!signer.value || !account.value) {
    ElNotification.error('请先连接你的钱包！')
    rejectLoadingId.value = null
    return
  }

  // 1. 签名
  let signature
  const messageToSign = `我 (Finder: ${account.value}) 确认拒绝认领申请 (Claim ID: ${claimToReject._id})`

  try {
    const rawSigner = toRaw(signer.value)
    if (!rawSigner) throw new Error('Signer 无效')
    ElNotification.info('请在钱包中签名以确认拒绝...')
    signature = await rawSigner.signMessage(messageToSign)
  } catch (err) {
    console.error('签名失败:', err)
    ElNotification.error('您取消了签名，或签名失败')
    rejectLoadingId.value = null
    return
  }

  // 2. 发送到后端
  try {
    const response = await itemService.rejectClaim(item.value._id, claimToReject._id, {
      finderAddress: account.value,
      signature: signature,
      signatureMessage: messageToSign,
    })
    // 使用后端返回的最新 item 数据更新本地
    item.value = response.data.data
    ElNotification.success('已拒绝该申请')
  } catch (err) {
    ElNotification.error({
      title: '拒绝失败',
      message: err.response?.data?.message || err.message,
    })
  } finally {
    rejectLoadingId.value = null
  }
}
</script>

<style scoped>
/* [!! 样式新增 !!] 图片卡片包裹器 */
.image-card-wrapper {
  overflow: hidden; /* 确保卡片的圆角能裁切内部图片 */
}

/* [!! 样式修改 !!] 移除 action-divider, 改用 action-card-wrapper */
.action-card-wrapper {
  margin-top: 10px;
}

/* 1. 详情卡片内样式 */
.detail-image {
  width: 100%;
  height: 400px;
  object-fit: cover;
  /* [!! 样式修改 !!] 
    卡片本身有圆角了，但图片也保留圆角，
    确保在 hover 放大时依然是圆角
  */
  border-radius: 8px;
  background-color: var(--el-fill-color-light);
  transition: transform 0.3s ease;
  display: block;
  transform-origin: center;
}

.item-title {
  font-size: 1.8em;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-top: 0;
  margin-bottom: 15px;
  word-break: break-all;
}
.item-description {
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
  word-break: break-all;
}

.item-descriptions {
  margin-top: 20px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px; /* 成功应用圆角 */
  overflow: hidden; /* 裁剪内部行 */
}

.custom-descriptions-row {
  display: flex;
  font-size: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.custom-descriptions-row:last-child {
  border-bottom: none;
}

.custom-descriptions-label {
  width: 120px;
  padding: 12px 10px;
  background-color: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
  font-weight: 600;
  border-right: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.custom-descriptions-value {
  padding: 12px 10px;
  color: var(--el-text-color-regular);
  flex-grow: 1;
  background-color: #fff;
  min-width: 0;
  display: flex;
  align-items: center;
}

.address-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
  word-break: break-all;
}

/* 2. 响应式布局 */
@media (max-width: 992px) {
  /* [!! 样式新增 !!] 在手机端(堆叠时)，让图片卡片和详情卡片之间有间距 */
  .image-card-wrapper {
    margin-bottom: 10px;
  }

  .detail-image {
    height: 300px;
    /* [!! 样式移除 !!] 
      margin-bottom: 25px; 
      现在由 .image-card-wrapper 的 margin-bottom 控制
    */
  }
  .item-title {
    font-size: 1.5em;
  }
}

/* 3. 'action-area' 相关样式 */
/* [!! 样式移除 !!] 
.action-divider {
  margin: 30px 0 25px 0;
} 
*/
.action-area-title {
  font-size: 1.1em;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-top: 0;
  margin-bottom: 20px;
}
.claim-list-card {
  border: 1px solid var(--el-border-color-lighter);
}
.claim-list-card .address-text {
  font-size: 12px;
}

/* 4. 预览器相关样式 (保持不变) */
.image-container {
  position: relative;
  cursor: pointer;
  overflow: hidden;
  border-radius: 8px; /* 保留圆角 */
}
.image-hover-mask {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.zoom-icon {
  color: rgba(255, 255, 255, 0.8);
  transition: transform 0.3s ease;
}
.image-container:hover .image-hover-mask {
  opacity: 1;
}
.image-container:hover .zoom-icon {
  transform: scale(1.2);
}
.image-container:hover .detail-image {
  transform: scale(1.05);
}

/* (预览弹窗样式... 保持不变) */
.image-preview-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 2000;
}
.image-preview-wrapper {
  position: fixed;
  inset: 0;
  z-index: 2001;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.image-preview-card {
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  padding: 4px;
  box-sizing: border-box;
  cursor: default;
}
.preview-image-content {
  display: block;
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 10px;
}

/* (预览弹窗动画... 保持不变) */
.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
  transition: opacity 0.4s ease;
}
.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
  opacity: 0;
}
.preview-card-enter-active,
.preview-card-leave-active {
  transition:
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.4s ease-out;
}
.preview-card-enter-from,
.preview-card-leave-to {
  opacity: 0;
  transform: scale(0.85);
}
</style>
