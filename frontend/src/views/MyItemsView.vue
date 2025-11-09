<template>
  <div class="page-title-block">
    <h1 class="main-title">我发布的物品</h1>
    <p class="subtitle" v-if="account">
      只显示与你当前连接的地址 ({{ formattedAccount }}) 相关的物品
    </p>
    <p class="subtitle" v-else>请先连接钱包以查看你发布的物品</p>
  </div>
  <el-divider />

  <Transition name="page-content-fade" mode="out-in">
    <el-skeleton :rows="5" animated v-if="loading" key="skeleton" />

    <el-empty description="请先连接钱包" v-else-if="!loading && !account" key="no-wallet" />

    <el-empty
      description="你还没有发布过物品"
      v-else-if="!loading && account && items.length === 0"
      key="empty-items"
    >
      <el-button type="primary" @click="$router.push('/upload')"> 我来发布第一个 </el-button>
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
              <el-text :type="item.status === 'available' ? 'success' : 'info'" disable-transitions>
                {{ item.status === 'available' ? '可认领' : '已认领' }}
              </el-text>
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

const fetchMyItems = async () => {
  if (!account.value) {
    loading.value = false
    items.value = []
    return
  }

  loading.value = true
  try {
    const response = await itemService.getMyItems(account.value)
    items.value = response.data.data
  } catch (err) {
    ElMessage.error('加载我的物品失败')
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchMyItems()
})

// 处理用户在页面上 "连接钱包" 或 "断开钱包" 的操作
watch(account, (newAccount, oldAccount) => {
  if (newAccount !== oldAccount) {
    fetchMyItems()
  }
})

const goToDetail = (id) => {
  router.push(`/item/${id}`)
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
  align-items: center;
}
.el-col :deep(.el-card) {
  transition:
    transform 0.25s ease-out,
    box-shadow 0.25s ease-out;
}
.el-col :deep(.el-card:hover) {
  transform: translateY(-10px);
}
.el-text {
  margin-left: 8px;
  font-size: 14px;
  font-weight: 800;
}
@media (max-width: 768px) {
  .page-title-block {
    padding: 0 15px;
  }
}
</style>
