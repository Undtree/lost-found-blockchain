<template>
  <div class="home-title-block">
    <h1 class="main-title">物品大厅</h1>
    <p class="subtitle">所有等待认领的物品</p>
  </div>

  <el-divider />

  <Transition name="page-content-fade" mode="out-in">
    <el-skeleton :rows="5" animated v-if="loading" key="skeleton" />

    <el-empty
      description="目前还没有人发布物品"
      v-else-if="!loading && items.length === 0"
      key="empty"
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
// [!! 核心简化: 移除所有 'handleClaim' 相关的 imports !!]
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElNotification } from 'element-plus'
import itemService from '@/api/itemService.js'
// (useEthers, ethers, ContractABI, toRaw 等已全部移除)

const items = ref([])
const loading = ref(true)
const router = useRouter()
const goToDetail = (id) => {
  router.push(`/item/${id}`)
}

// fetchItems 函数 (保持不变)
const fetchItems = async () => {
  loading.value = true
  try {
    const response = await itemService.getItems()
    items.value = response.data.data
  } catch (err) {
    ElNotification.error('加载物品失败，请检查后端服务是否开启及CORS配置')
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(fetchItems)

// [!! 核心移除: 整个 handleClaim 函数已不在这里 !!]
</script>

<style scoped>
/* (所有样式保持不变) */
.home-title-block {
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
  color: var(--el-text-color-primary);
  word-break: break-all;
}
.description-text {
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 1.5;
  height: 63px;
  overflow: hidden;
  text-overflow: ellipsis;
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
.card-footer :deep(.el-button-group > .el-button.is-plain:not(:first-child)) {
  border-left-color: var(--el-color-primary-light-5);
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
  .home-title-block {
    padding: 0 15px;
  }
}
</style>
