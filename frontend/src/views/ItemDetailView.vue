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
                      <el-tag :type="itemStatusType" disable-transitions>
                        {{ itemStatusText }}
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
                  <div class="custom-descriptions-row" v-if="item.status !== 'available'">
                    <div class="custom-descriptions-label">
                      {{ item.status === 'claimed' ? '认领者 (Loster)' : '批准的认领者' }}
                    </div>
                    <div class="custom-descriptions-value">
                      <span class="address-text">{{ losterToShow }}</span>
                    </div>
                  </div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <el-card shadow="always" class="action-card-wrapper">
            <div class="action-area">
              <div v-if="!isFinder && isAvailable">
                <div v-if="myCurrentClaimStatus === null || myCurrentClaimStatus === 'rejected'">
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
                    {{ account ? (myCurrentClaimStatus === 'rejected' ? '重新申请认领' : '我来申请认领') : '请先连接钱包' }}
                  </el-button>
                </div>
                <div v-if="myCurrentClaimStatus === 'pending'">
                  <el-alert
                    title="申请已提交"
                    type="success"
                    description="你的认领申请已提交，请等待拾物者审核。"
                    :closable="false"
                  />
                </div>
              </div>

              <div v-if="!isFinder && isPendingHandover">
                <el-alert
                  v-if="myCurrentClaimStatus === 'approved'"
                  title="你的申请已批准！"
                  type="success"
                  description="你的申请已通过！请等待拾物者与你联系（或按约定）进行线下交接。"
                  :closable="false"
                />
                <el-alert
                  v-if="myCurrentClaimStatus === 'rejected' || myCurrentClaimStatus === 'pending' || myCurrentClaimStatus === null"
                  title="物品正在等待交接"
                  type="info"
                  description="拾物者已批准了另一份申请，正在等待线下交接。"
                  :closable="false"
                />
              </div>

              <div v-if="!isFinder && item.status === 'claimed'">
                <el-alert
                  v-if="account && item.losterAddress && account.toLowerCase() === item.losterAddress.toLowerCase()"
                  title="恭喜，你已成功认领！"
                  type="success"
                  description="此物品的 NFT 已转移到你的钱包，认领流程已结束。"
                  :closable="false"
                />
                <el-alert
                  v-else
                  title="物品已被认领"
                  type="info"
                  description="此物品已被其他失主认领，流程已结束。"
                  :closable="false"
                />
              </div>

              <div v-if="isFinder">
                <h3 class="action-area-title" v-if="isAvailable">审核认领申请</h3>
                <h3 class="action-area-title" v-if="isPendingHandover">等待交接</h3>
                <h3 class="action-area-title" v-if="item.status === 'claimed'">交割完成</h3>

                <el-empty
                  v-if="!claims || claims.length === 0"
                  description="暂无申请记录"
                />
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

                    <el-table-column label="操作" width="220" align="center">
                      <template #default="scope">
                        <div v-if="isAvailable && scope.row.status === 'pending'" class="action-button-group">
                          <el-button
                            type="primary"
                            :loading="approveLoadingId === scope.row._id"
                            @click="handleApproveStage1(scope.row)"
                          >
                            批准 (链下)
                          </el-button>
                          <el-button
                            type="danger"
                            :loading="rejectLoadingId === scope.row._id"
                            @click="handleReject(scope.row)"
                          >
                            拒绝
                          </el-button>
                        </div>
                        <div v-if="isPendingHandover && scope.row.status === 'approved'" class="action-button-group">
                          <el-button
                            type="success"
                            :loading="finalizeLoadingId === scope.row._id"
                            @click="handleApproveStage2_Finalize(scope.row)"
                          >
                            确认交割
                          </el-button>
                          <el-button
                            type="warning"
                            plain
                            :loading="cancelLoadingId === scope.row._id"
                            @click="handleCancelHandover()"
                          >
                            取消
                          </el-button>
                        </div>
                        <span
                          v-if="!( (isAvailable && scope.row.status === 'pending') || (isPendingHandover && scope.row.status === 'approved') )"
                        >
                          {{ item.status === 'claimed' ? '流程结束' : '已处理' }}
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

// [!! 核心修改: 细分 Loading !!]
const approveLoadingId = ref(null)
const rejectLoadingId = ref(null)
const finalizeLoadingId = ref(null)
const cancelLoadingId = ref(null)

const applyLoading = ref(false)
const applyDialogVisible = ref(false)
const secretMessage = ref('')
const { account, signer } = useEthers()
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3' // 确保地址正确

// --- 预览器状态 (保持不变) ---
const isPreviewVisible = ref(false)
const openPreview = () => { isPreviewVisible.value = true }
const closePreview = () => { isPreviewVisible.value = false }
watch(isPreviewVisible, (newVal) => {
  if (newVal) { document.body.style.overflow = 'hidden' } 
  else { document.body.style.overflow = '' }
})
onUnmounted(() => { document.body.style.overflow = '' })

// --- 计算属性 (核心修改) ---
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

// [!! 新增 !!]
const isPendingHandover = computed(() => {
  return item.value && item.value.status === 'pending_handover'
})

const claims = computed(() => {
  return item.value?.claims || []
})

const myCurrentClaimStatus = computed(() => {
  if (!account.value || !claims.value) {
    return null; 
  }
  const myClaim = claims.value.find(
    (c) => c.applierAddress.toLowerCase() === account.value.toLowerCase()
  );
  return myClaim ? myClaim.status : null; // 'pending', 'rejected', 'approved', or null
})

// [!! 新增 !!]
const itemStatusText = computed(() => {
  if (!item.value) return ''
  switch (item.value.status) {
    case 'available': return '可认领'
    case 'pending_handover': return '等待交接'
    case 'claimed': return '已认领'
    default: return '未知'
  }
})

// [!! 新增 !!]
const itemStatusType = computed(() => {
  if (!item.value) return 'info'
  switch (item.value.status) {
    case 'available': return 'success'
    case 'pending_handover': return 'warning'
    case 'claimed': return 'info'
    default: return 'info'
  }
})

// [!! 新增 !!]
const losterToShow = computed(() => {
  if (!item.value) return ''
  if (item.value.status === 'claimed') {
    return item.value.losterAddress
  }
  if (item.value.status === 'pending_handover') {
    const approvedClaim = claims.value.find(c => c.status === 'approved')
    return approvedClaim ? approvedClaim.applierAddress : '错误：未找到批准者'
  }
  return ''
})

// --- 核心方法 ---
const fetchItem = async () => {
  const id = route.params.id
  if (!id) {
    loading.value = false
    return
  }
  loading.value = true
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

// --- (Loster) 提交申请 (保持不变) ---
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

// --- (Finder) 方法 ---

// [!! 新增 !!] 阶段一：链下批准
const handleApproveStage1 = async (claim) => {
  approveLoadingId.value = claim._id;

  if (!signer.value || !account.value) {
    ElNotification.error('请先连接你的钱包！')
    approveLoadingId.value = null
    return
  }
  
  // 1. 签名
  let signature;
  const messageToSign = `我 (Finder: ${account.value}) 确认批准认领申请 (Claim ID: ${claim._id})`
  try {
    const rawSigner = toRaw(signer.value)
    if (!rawSigner) throw new Error('Signer 无效')
    ElNotification.info('请在钱包中签名以确认批准...')
    signature = await rawSigner.signMessage(messageToSign)
  } catch (err) {
    console.error('签名失败:', err)
    ElNotification.error('您取消了签名，或签名失败')
    approveLoadingId.value = null
    return
  }

  // 2. 发送到后端 (新 API)
  try {
    const response = await itemService.approveClaim(
      item.value._id, 
      claim._id, 
      {
        finderAddress: account.value,
        signature: signature,
        signatureMessage: messageToSign
      }
    );
    item.value = response.data.data; // 更新 item (状态变为 pending_handover)
    ElNotification.success('已批准！请等待线下交接');
  } catch (err) {
    ElNotification.error({
      title: '批准失败',
      message: err.response?.data?.message || err.message,
    })
  } finally {
    approveLoadingId.value = null
  }
}

// [!! 新增 !!] 回滚：取消交接
const handleCancelHandover = async () => {
  cancelLoadingId.value = true; // 只有一个取消按钮，用布尔值即可

  if (!signer.value || !account.value) {
    ElNotification.error('请先连接你的钱包！')
    cancelLoadingId.value = false
    return
  }

  // 1. 签名
  let signature;
  const messageToSign = `我 (Finder: ${account.value}) 确认取消交接 (Item ID: ${item.value._id})`
  try {
    const rawSigner = toRaw(signer.value)
    if (!rawSigner) throw new Error('Signer 无效')
    ElNotification.info('请在钱包中签名以确认取消...')
    signature = await rawSigner.signMessage(messageToSign)
  } catch (err) {
    console.error('签名失败:', err)
    ElNotification.error('您取消了签名，或签名失败')
    cancelLoadingId.value = false
    return
  }

  // 2. 发送到后端 (新 API)
  try {
    const response = await itemService.cancelHandover(
      item.value._id, 
      {
        finderAddress: account.value,
        signature: signature,
        signatureMessage: messageToSign
      }
    );
    item.value = response.data.data; // 更新 item (状态变回 available)
    ElNotification.warning('交接已取消，物品已重新开放审核');
  } catch (err) {
    ElNotification.error({
      title: '取消失败',
      message: err.response?.data?.message || err.message,
    })
  } finally {
    cancelLoadingId.value = false
  }
}

// [!! 重命名并修改 !!] 阶段二：链上交割 (原 handleApprove)
const handleApproveStage2_Finalize = async (claim) => {
  const losterAddressToReceive = claim.applierAddress
  const itemToClaim = item.value

  finalizeLoadingId.value = claim._id

  if (!signer.value || !account.value) {
    ElNotification.error('请先连接你的钱包！')
    finalizeLoadingId.value = null
    return
  }
  if (account.value.toLowerCase() !== itemToClaim.finderAddress.toLowerCase()) {
    ElNotification.error('你不是该物品的拾物者，无权操作！')
    finalizeLoadingId.value = null
    return
  }

  try {
    let validLosterAddress = ''
    let tokenIdBigInt

    try {
      validLosterAddress = ethers.getAddress(losterAddressToReceive)
    } catch (validationError) {
      ElNotification.error('申请人地址无效。无法转移。')
      finalizeLoadingId.value = null
      return
    }

    try {
      tokenIdBigInt = BigInt(itemToClaim.tokenId)
    } catch (castError) {
      ElNotification.error(`物品 Token ID (${itemToClaim.tokenId}) 无效。`)
      finalizeLoadingId.value = null
      return
    }

    const rawSigner = toRaw(signer.value)
    if (!rawSigner) {
      ElNotification.error('Signer 无效，请重新连接钱包。')
      finalizeLoadingId.value = null
      return
    }

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ContractABI.abi, rawSigner)
    ElNotification.info('正在发送交易，请在 MetaMask 中确认交割...')

    const tx = await contract.claimItem(validLosterAddress, tokenIdBigInt)
    await tx.wait()

    // [!! 核心 !!] 链上成功后，立即调用后端 API (claim-db) 来同步
    try {
      const response = await itemService.markItemAsClaimed(
        itemToClaim._id, 
        { losterAddress: validLosterAddress }
      )
      // 使用后端返回的最新数据更新前端
      item.value = response.data.data 
    } catch (dbError) {
      console.error('链上成功，但数据库更新失败:', dbError)
      ElNotification.warning('链上交易成功，但后台状态更新失败。请尝试刷新页面。')
      // 即使 DB 失败，也尝试刷新
      await fetchItem() 
    }

    ElNotification.success({
      title: '交割成功！',
      message: '物品已成功转移给失主！',
    })
    
    // (不再需要手动 fetchItem, markItemAsClaimed 已返回最新数据)
    // await fetchItem() 
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
    finalizeLoadingId.value = null
  }
}

// [!! (Finder) 拒绝 (保持不变) !!]
const handleReject = async (claim) => {
  const claimToReject = claim;
  rejectLoadingId.value = claimToReject._id;

  if (!signer.value || !account.value) {
    ElNotification.error('请先连接你的钱包！')
    rejectLoadingId.value = null
    return
  }

  // 1. 签名
  let signature;
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
    const response = await itemService.rejectClaim(
      item.value._id, 
      claimToReject._id, 
      {
        finderAddress: account.value,
        signature: signature,
        signatureMessage: messageToSign
      }
    );
    item.value = response.data.data;
    ElNotification.success('已拒绝该申请');
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
  overflow: hidden; 
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
  border-radius: 8px; 
  overflow: hidden; 
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
  .image-card-wrapper {
    margin-bottom: 10px;
  }
  .detail-image {
    height: 300px;
  }
  .item-title {
    font-size: 1.5em;
  }
}

/* 3. 'action-area' 相关样式 */
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

/* [!! 样式新增 !!] 解决按钮组换行问题 */
.action-button-group {
  white-space: nowrap;
}

/* 4. 预览器相关样式 (保持不变) */
.image-container {
  position: relative;
  cursor: pointer;
  overflow: hidden;
  border-radius: 8px;
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
.el-alert {
  margin-top: 0px;
}
</style>