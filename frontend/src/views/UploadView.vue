<template>
  <Transition name="page-content-fade" mode="out-in" appear>
    <el-row justify="center" key="upload-content">
      <el-col :xs="24" :sm="20" :md="18" :lg="16">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-width="100px"
          label-position="top"
        >
          <el-row :gutter="10">
            <el-col :xs="24" :sm="24" :md="12">
              <el-card shadow="always">
                <template #header>
                  <div class="card-header">
                    <h3>填写物品信息</h3>
                  </div>
                </template>

                <el-form-item label="物品名称" prop="name">
                  <el-input v-model="form.name" placeholder="例如：一把黑色的天堂伞"></el-input>
                </el-form-item>
                <el-form-item label="物品描述" prop="description">
                  <el-input
                    v-model="form.description"
                    type="textarea"
                    :rows="3"
                    placeholder="例如：在东教一楼楼梯口捡到的，大概8成新"
                  ></el-input>
                </el-form-item>
                <el-form-item label="地点" prop="location">
                  <el-input
                    v-model="form.location"
                    placeholder="例如：东校区-教学楼-东一"
                  ></el-input>
                </el-form-item>
              </el-card>
            </el-col>

            <el-col :xs="24" :sm="24" :md="12" class="image-upload-card-wrapper">
              <el-card shadow="always">
                <template #header>
                  <div class="card-header">
                    <h3>上传物品图片</h3>
                  </div>
                </template>

                <el-form-item prop="image" class="image-form-item">
                  <el-upload
                    ref="uploadRef"
                    action="#"
                    :auto-upload="false"
                    :limit="1"
                    :on-exceed="handleExceed"
                    :on-change="handleFileChange"
                    :on-remove="handleRemove"
                    :show-file-list="false"
                    class="custom-uploader-wrapper"
                  >
                    <template #default>
                      <div class="custom-uploader-content">
                        <Transition name="preview-fade-scale">
                          <div v-if="imageUrlPreview" class="image-preview-container">
                            <img :src="imageUrlPreview" class="preview-image" alt="Image preview" />
                            <div class="image-actions-overlay">
                              <el-icon class="delete-icon" :size="40" @click.stop="triggerRemove">
                                <CircleClose />
                              </el-icon>
                            </div>
                          </div>
                        </Transition>

                        <div v-if="!imageUrlPreview" class="upload-prompt">
                          <el-icon><Plus /></el-icon>
                          <div class="uploader-text">点击上传图片</div>
                          <div class="upload-tip-inline">（仅限1张，将替换现有）</div>
                        </div>
                      </div>
                    </template>

                    <template #tip>
                      <div class="upload-tip">
                        <el-text type="info">请上传一张清晰的外观照片</el-text>
                      </div>
                    </template>
                  </el-upload>
                </el-form-item>
              </el-card>
            </el-col>
          </el-row>

          <div class="form-footer">
            <el-button type="primary" @click="handleSubmit" :loading="loading" size="large">
              立即发布 (Mint)
            </el-button>
          </div>
        </el-form>
      </el-col>
    </el-row>
  </Transition>
</template>

<script setup>
import { ref, reactive, toRaw, onUnmounted } from 'vue'
import { Plus, CircleClose } from '@element-plus/icons-vue' // 使用 CircleClose 图标
import { ElNotification } from 'element-plus'
import { useRouter } from 'vue-router'
import { useEthers } from '@/composables/useEthers.js'
import itemService from '@/api/itemService.js'

// --- 状态定义 ---
const { account, signer } = useEthers()
const router = useRouter()
const formRef = ref(null)
const uploadRef = ref(null)
const loading = ref(false)
const imageUrlPreview = ref(null) // 用于本地预览的 URL

const form = reactive({
  name: '',
  description: '',
  location: '',
  image: null,
})

// --- 表单校验 ---
const validateImage = (rule, value, callback) => {
  if (!form.image) {
    callback(new Error('请上传图片'))
  } else {
    callback()
  }
}
const rules = reactive({
  name: [{ required: true, message: '请输入物品名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入物品描述', trigger: 'blur' }],
  location: [{ required: true, message: '请输入地点', trigger: 'blur' }],
  image: [{ required: true, validator: validateImage, trigger: 'change' }],
})

// --- el-upload 钩子函数 ---
const handleFileChange = (uploadFile) => {
  // 如果已有预览，先释放旧的 URL
  if (imageUrlPreview.value) {
    URL.revokeObjectURL(imageUrlPreview.value)
  }

  form.image = uploadFile.raw
  // 创建新的本地预览 URL
  imageUrlPreview.value = URL.createObjectURL(uploadFile.raw)

  // 校验通过，不会抛出错误
  if (formRef.value) {
    formRef.value.validateField('image')
  }
}

/**
 * on-remove 钩子回调。
 * 这个函数现在主要由 triggerRemove 手动调用。
 */
const handleRemove = () => {
  // 释放 URL 内存
  if (imageUrlPreview.value) {
    URL.revokeObjectURL(imageUrlPreview.value)
  }
  form.image = null
  imageUrlPreview.value = null // 清空预览 URL

  // 触发校验失败，并捕获预期的错误
  if (formRef.value) {
    formRef.value.validateField('image').catch(() => {
      // 这是一个预期的错误，UI会正常显示，我们不需要在控制台做什么。
    })
  }
}

/**
 * 自定义删除按钮的点击事件
 */
const triggerRemove = () => {
  // 1. 手动调用我们自己的状态清理函数 (会触发UI更新和校验)
  handleRemove()
  // 2. 告诉 el-upload 组件也清理它的内部列表
  if (uploadRef.value) {
    uploadRef.value.clearFiles()
  }
}

/**
 * 文件超出限制钩子 (limit=1)
 */
const handleExceed = (files) => {
  // 优化：当超出限制时，直接替换
  if (uploadRef.value) {
    uploadRef.value.clearFiles() // 清除旧文件
    uploadRef.value.handleStart(files[0]) // 手动添加新文件（会触发 on-change）
  }
  ElNotification.warning('只能上传一张图片，已自动替换为新图片')
}

// 组件卸载时，释放可能存在的 URL
onUnmounted(() => {
  if (imageUrlPreview.value) {
    URL.revokeObjectURL(imageUrlPreview.value)
  }
})

// --- 提交 ---
const handleSubmit = async () => {
  if (!formRef.value) return

  // 1. 表单校验
  await formRef.value.validate(async (valid) => {
    if (valid) {
      // 2. 钱包检查
      if (!account.value || !signer.value) {
        ElNotification.error('请先连接钱包，需要签名授权')
        return
      }
      loading.value = true

      // 3. 钱包签名
      let signature
      const messageToSign = `我确认发布物品: ${form.name}`
      try {
        const rawSigner = toRaw(signer.value)
        if (!rawSigner) throw new Error('Signer 无效')

        ElNotification.info('请在钱包中签名以确认发布...')
        signature = await rawSigner.signMessage(messageToSign)
      } catch (err) {
        console.error('签名失败:', err)
        ElNotification.error('您取消了签名，或签名失败')
        loading.value = false
        return
      }

      // 4. 准备 FormData
      const formData = new FormData()
      formData.append('name', form.name)
      formData.append('description', form.description)
      formData.append('location', form.location)
      formData.append('image', form.image)
      formData.append('finderAddress', account.value)
      formData.append('signature', signature)
      formData.append('signatureMessage', messageToSign)

      // 5. API 请求
      try {
        const response = await itemService.uploadItem(formData)
        ElNotification.success({
          title: '发布成功！',
          message: `物品已上链并存入数据库, Tx: ${response.data.txHash}`,
        })
        router.push('/')
      } catch (err) {
        ElNotification.error({
          title: '发布失败',
          message: err.response?.data?.message || err.message,
        })
      } finally {
        loading.value = false
      }
    } else {
      ElNotification.error('请检查表单是否填写完整')
      return false
    }
  })
}
</script>

<style scoped>
/* --- 删除动画 --- */
.preview-fade-scale-leave-active {
  /* 离开时的动画 */
  transition:
    opacity 0.3s ease-out,
    transform 0.3s ease-out;
}
.preview-fade-scale-leave-to {
  /* 离开的最终状态 */
  opacity: 0;
  transform: scale(0.8); /* 缩小一点 */
}

/* --- 基础样式 --- */
.card-header h3 {
  margin: 0;
  font-size: 1.2em;
  color: var(--el-text-color-primary);
}

.upload-tip {
  width: 100%;
  margin-top: 8px;
  line-height: 1.5;
}

/* --- 自定义上传器样式 --- */
.custom-uploader-wrapper {
  width: 100%;
}

.custom-uploader-wrapper :deep(.el-upload) {
  /* 让 el-upload 的根元素撑满容器 */
  display: block;
  width: 100%;
  height: 100%;
}

.custom-uploader-content {
  width: 100%;
  height: 300px; /* 固定高度，防止跳动 */
  border: 2px dashed var(--el-border-color);
  border-radius: 8px;
  background-color: var(--el-fill-color-lightest);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden; /* 裁剪预览图片 */
  position: relative; /* 确保预览和提示框能正确堆叠 */
  transition: border-color 0.3s ease;
  cursor: pointer;
}

.custom-uploader-wrapper :deep(.el-upload:hover .custom-uploader-content) {
  /* 模拟 Element Plus 的悬停高亮 */
  border-color: var(--el-color-primary);
}

/* 状态2: 上传提示 */
.upload-prompt {
  text-align: center;
  color: var(--el-text-color-secondary);
  /* 确保提示框在预览图下方，但 Transition 会处理 v-if/v-else */
  position: absolute;
}
.upload-prompt .el-icon {
  font-size: 40px;
  color: var(--el-text-color-placeholder);
  margin-bottom: 8px;
}
.uploader-text {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}
.upload-tip-inline {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-top: 4px;
}

/* 状态1: 预览容器 */
.image-preview-container {
  width: 100%;
  height: 100%;
  position: absolute; /* 确保在 Transition 中正确定位 */
  top: 0;
  left: 0;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
  transform-origin: center;
}

/* 预览图遮罩层 (悬停动效) */
.image-actions-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.image-preview-container:hover .image-actions-overlay {
  opacity: 1;
}

.image-preview-container:hover .preview-image {
  transform: scale(1.05);
}

/* 删除图标 (悬停动效) */
.delete-icon {
  color: rgba(255, 255, 255, 0.8);
  transition: transform 0.3s ease;
  cursor: pointer;
}

.image-preview-container:hover .delete-icon {
  transform: scale(1.2);
}

/* --- 底部和响应式 --- */
.form-footer {
  display: flex;
  justify-content: right;
  align-items: center;
  margin-top: 20px;
}

@media (max-width: 992px) {
  .image-upload-card-wrapper {
    margin-top: 10px;
  }
  .form-footer {
    justify-content: center;
    margin-bottom: 10px;
  }
}
</style>
