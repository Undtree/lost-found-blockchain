<template>
  <el-container class="common-layout">
    <el-header class="app-header">
      <div class="header-container">
        <div class="logo-area">Lost & Found DApp</div>

        <el-menu class="header-menu" mode="horizontal" :router="true" :default-active="$route.path">
          <el-menu-item index="/">主页</el-menu-item>
          <el-menu-item index="/upload">发布物品</el-menu-item>
          <el-menu-item index="/my-items">我的物品</el-menu-item>
        </el-menu>

        <div class="wallet-area">
          <WalletConnect />
        </div>
      </div>
    </el-header>

    <div class="main-content-wrapper">
      <RouterView />
    </div>

    <el-footer class="app-footer"> © 2025 Lost & Found DApp. </el-footer>
  </el-container>
</template>

<script setup>
// 脚本部分保持不变
import { RouterView } from 'vue-router'
import WalletConnect from './components/WalletConnect.vue'
</script>

<style scoped>
/* [!! 核心修改 1 !!]
   为根布局容器添加 padding-top
   以防止内容被 fixed 的 header 遮挡
*/
.common-layout {
  min-height: 100vh; /* 确保布局至少占满一屏 */
  padding-top: 60px; /* 60px 是 header 的高度 */
  box-sizing: border-box; /* 确保 padding 不会增加总高度 */
}

/* [!! 核心修改 2 !!]
   将 Header 设置为 fixed 定位
*/
.app-header {
  border-bottom: 1px solid var(--el-border-color);
  background-color: #fff;
  padding: 0;
  height: var(--el-header-height, 60px);

  /* --- 新增样式 --- */
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 1000; /* 确保 Header 在最上层 */
}

/* 顶层 Flex 容器 */
.header-container {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  box-sizing: border-box;
}

/* --- 以下样式保持不变 --- */

/* 左侧 Logo */
.logo-area {
  font-size: 1.2em;
  font-weight: bold;
  white-space: nowrap;
  color: var(--el-text-color-primary);
  flex-shrink: 0;
}

/* 中间菜单 */
.header-menu {
  flex-grow: 1;
  flex-shrink: 1;
  min-width: 0;
}

.header-menu.el-menu--horizontal {
  border-bottom: none; /* 移除 el-menu 自己的下划线 */
  display: flex;
  height: 100%;
  justify-content: flex-end;
}

/* 右侧钱包区域 */
.wallet-area {
  flex-shrink: 0;
  height: 100%;
  display: flex;
  align-items: center;
  margin-left: 15px;
}

/* --- 页面布局 (主内容/页脚) --- */
.main-content-wrapper {
  flex: 1; /* 占据剩余空间 */
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
}

.app-footer {
  text-align: center;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color);
  height: auto;
  padding: 20px 0;
  /* flex-shrink: 0; (如果 footer 也被折叠可以加上这个) */
}

/* --- 移动端适配 --- */
@media (max-width: 768px) {
  .header-container {
    padding: 0 15px;
  }
  .logo-area {
    font-size: 1em;
  }
  .wallet-area {
    margin-left: 10px;
  }
  .main-content-wrapper {
    padding: 10px;
  }
}
</style>
