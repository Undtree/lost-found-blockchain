<template>
  <div class="page-title-block">
    <h1 class="main-title">我的申请</h1>
    <p class="subtitle" v-if="account">
      显示与你当前连接的地址 ({{ formattedAccount }}) 相关的申请
    </p>
    <p class="subtitle" v-else>请先连接钱包以查看你的申请</p>
  </div>
  <el-divider />

  <Transition name="page-content-fade" mode="out-in">
    <el-skeleton :rows="5" animated v-if="loading" key="skeleton" />

    <el-empty description="请先连接钱包" v-else-if="!loading && !account" key="no-wallet" />

    <el-empty
      description="你还没有申请过任何物品"
      v-else-if="!loading && account && items.length === 0"
      key="empty-items"
    >
      <el-button type="primary" @click="$router.push('/')"> 去物品大厅看看 </el-button>
    </el-empty>

    <el-row :gutter="20" v-else key="content">
      <el-col
        :xs="24"
        :sm="12"
        :md="8"
        :lg="6"
        v-for="item in items"
        :key="item._id"
        style="margin-bottom: 20px"
      >
        <el-card
          shadow="hover"
          :body-style="{ padding: '0px' }"
          @click="goToDetail(item._id)"
          style="cursor: pointer"
        >
          <img :src="item.imageUrl" class="image" />
          <div style="padding: 14px">
            <h3 class="card-title">{{ item.name }}</h3>
            <div class="description-text">
              {{ item.description }}
            </div>
            <div class="card-footer">
              <div class="status-tags">
                <el-tag :type="getItemStatusDetails(item.status).type" disable-transitions>
                  物品状态: {{ getItemStatusDetails(item.status).text }}
                </el-tag>

                <el-tag
                  v-if="getMyClaimStatusDetails(item)"
                  :type="getMyClaimStatusDetails(item).type"
                  disable-transitions
                  style="margin-top: 8px"
                >
                  {{ getMyClaimStatusDetails(item).text }}
                </el-tag>
              </div>
              <el-button type="primary" plain @click.stop="goToDetail(item._id)">
                查看详情
              </el-button>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </Transition>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import itemService from '@/api/itemService.js'
import { useEthers } from '@/composables/useEthers.js'

const { account } = useEthers()
const items = ref([])
const loading = ref(true)
const router = useRouter()

const formattedAccount = computed(() => {
  if (account.value) {
    return `${account.value.substring(0, 6)}...${account.value.substring(account.value.length - 4)}`
  }
  return ''
})

// 拉取 "我申请的" 物品
const fetchMyClaims = async () => {
  if (!account.value) {
    loading.value = false
    items.value = []
    return
  }

  loading.value = true
  try {
    const response = await itemService.getMyClaims(account.value)
    items.value = response.data.data
  } catch (err) {
    ElMessage.error('加载我的申请失败')
    console.error(err)
  } finally {
    loading.value = false
  }
}

// 初始加载
onMounted(() => {
  fetchMyClaims()
})

// 监听钱包变化
watch(account, (newAccount, oldAccount) => {
  if (newAccount !== oldAccount) {
    fetchMyClaims()
  }
})

const goToDetail = (id) => {
  router.push(`/item/${id}`)
}


// 获取物品认领状态
const getItemStatusDetails = (status) => {
  switch (status) {
    case 'available':
      return { text: '可认领', type: 'success' }
    case 'pending_handover':
      return { text: '等待交接', type: 'warning' }
    case 'claimed':
      return { text: '已认领', type: 'info' }
    default:
      return { text: '未知', type: 'info' }
  }
}

// 辅助函数：获取自己在这个物品上的申请状态
const getMyClaimStatusDetails = (item) => {
  if (!account.value || !item.claims) return null
  const myClaim = item.claims.find(
    (c) => c.applierAddress.toLowerCase() === account.value.toLowerCase(),
  )
  if (!myClaim) return null // 用户可能访问过但未申请

  switch (myClaim.status) {
    case 'pending':
      return { text: '我的申请: 待审核', type: 'warning' }
    case 'approved':
      return { text: '我的申请: 已批准', type: 'success' }
    case 'rejected':
      return { text: '我的申请: 已拒绝', type: 'error' }
    default:
      return null
  }
}
</script>

<style scoped>
.page-title-block {
  margin-top: 20px;
  margin-bottom: 20px;
}
.main-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
}
.subtitle {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin: 0;
  margin-top: 8px;
}
.image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  display: block;
}
.card-title {
  margin: 0 0 10px 0;
  font-size: 1.1em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
}
.description-text {
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 1.5;
  height: 63px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  word-break: break-all;
}
.card-footer {
  margin-top: 15px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.status-tags {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.el-col :deep(.el-card) {
  transition:
    transform 0.25s ease-out,
    box-shadow 0.25s ease-out;
}
.el-col :deep(.el-card:hover) {
  transform: translateY(-10px);
}
@media (max-width: 768px) {
  .page-title-block {
    padding: 0 15px;
  }
}
</style>
