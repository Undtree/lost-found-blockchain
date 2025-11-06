<template>
  <div class="home-title-block">
    <h1 class="main-title">物品大厅</h1>
    <p class="subtitle">{{ subtitleText }}</p>
  </div>

  <el-row justify="center" class="search-bar-row">
    <el-col :xs="24" :sm="20" :md="18" :lg="16">
      <el-input
        v-model="searchQuery"
        placeholder="试试用 Agent 搜索“我丢的蓝色耳机”..."
        size="large"
        clearable
        @clear="handleClearSearch"
        @keydown.enter="handleSearch"
      >
        <template #suffix>
          <el-button :icon="Search" @click="handleSearch" :loading="loading" link />
        </template>
      </el-input>
    </el-col>
  </el-row>

  <el-divider />

  <Transition name="page-content-fade" mode="out-in">
    <el-skeleton :rows="5" animated v-if="loading" key="skeleton" />

    <el-empty
      description="目前还没有人发布物品"
      v-else-if="!loading && items.length === 0 && !isSearchActive"
      key="empty-default"
    >
      <el-button type="primary" @click="$router.push('/upload')"> 我来发布第一个 </el-button>
    </el-empty>

    <el-empty
      :description="`未找到与 '${searchQuery}' 相关的物品`"
      v-else-if="!loading && items.length === 0 && isSearchActive"
      key="empty-search"
    >
      <el-button type="primary" plain @click="handleClearSearch"> 清空搜索 </el-button>
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
          <div class="score-badge" v-if="item.score">
            Agent 相似度: {{ (item.score * 100).toFixed(0) }}%
          </div>

          <img :src="item.imageUrl" class="image" />
          <div style="padding: 14px">
            <h3 class="card-title">{{ item.name }}</h3>

            <div class="tags-container" v-if="item.tags && item.tags.length > 0">
              <el-tag
                v-for="tag in item.tags.slice(0, 3)"
                :key="tag"
                type="info"
                effect="plain"
                disable-transitions
                size="small"
              >
                {{ tag }}
              </el-tag>
            </div>

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
// (Script 保持不变)
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElNotification } from 'element-plus'
import itemService from '@/api/itemService.js'
import { Search } from '@element-plus/icons-vue'

const items = ref([])
const loading = ref(true)
const router = useRouter()
const searchQuery = ref('')
const isSearchActive = ref(false)
const activeSearchThreshold = ref(null)

const goToDetail = (id) => {
  router.push(`/item/${id}`)
}

const subtitleText = computed(() => {
  if (!isSearchActive.value) {
    return '所有等待认领的物品';
  }
  if (loading.value) {
    return 'Agent 正在搜索...';
  }
  if (items.value.length > 0 && activeSearchThreshold.value) {
    let level = '相关';
    if (activeSearchThreshold.value >= 0.7) {
      level = '高度匹配';
    } else if (activeSearchThreshold.value < 0.5) {
      level = '可能相关';
    }
    return `已找到 ${items.value.length} 个${level}的结果 (阈值 ≥ ${activeSearchThreshold.value})`;
  }
  return 'Agent 搜索结果';
});

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

const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    handleClearSearch()
    return
  }
  loading.value = true
  isSearchActive.value = true
  activeSearchThreshold.value = null
  try {
    const response = await itemService.searchItems(searchQuery.value);
    items.value = response.data.data;
    activeSearchThreshold.value = response.data.threshold;
  } catch (err) {
    ElNotification.error('Agent 搜索失败: ' + (err.response?.data?.message || err.message));
    items.value = [];
  } finally {
    loading.value = false
  }
}

const handleClearSearch = () => {
  searchQuery.value = ''
  isSearchActive.value = false
  activeSearchThreshold.value = null
  fetchItems()
}

onMounted(fetchItems)
</script>

<style scoped>
/* (大部分样式保持不变) */
.search-bar-row {
  margin-bottom: 20px;
}

/* [!! CORE MODIFICATION !!] Removed the :deep styles for .el-input-group__append */
/* These are no longer needed as we are using the 'suffix' slot */
/*
.search-bar-row :deep(.el-input-group__append) { ... }
.search-bar-row :deep(.el-input-group__append .el-icon) { ... }
.search-bar-row :deep(.el-input-group__append button:hover) { ... }
*/

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
  min-height: 1.2em;
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
.score-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: var(--el-color-primary-light-3);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  z-index: 10;
}
.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 10px;
  height: 24px;
  overflow: hidden;
}

.description-text {
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 1.5;
  height: 42px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
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
  position: relative;
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
