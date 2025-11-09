<template>
  <el-container class="common-layout">
    <el-header class="app-header">
      <div class="header-container">
        <div class="logo-area">Lost & Found DApp</div>

        <el-menu class="header-menu" mode="horizontal" :router="true" :default-active="$route.path">
          <el-menu-item index="/">主页</el-menu-item>
          <el-menu-item index="/upload">发布物品</el-menu-item>
          <el-menu-item index="/my-items">我的发布</el-menu-item>
          <el-menu-item index="/my-claims">我的申请</el-menu-item>
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
import { RouterView } from 'vue-router'
import WalletConnect from './components/WalletConnect.vue'
</script>

<style scoped>
.common-layout {
  min-height: 100vh;
  padding-top: 60px;
  box-sizing: border-box;
}

.app-header {
  border-bottom: 1px solid var(--el-border-color);
  background-color: #fff;
  padding: 0;
  height: var(--el-header-height, 60px);
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 1000;
}

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

.logo-area {
  font-size: 1.2em;
  font-weight: bold;
  white-space: nowrap;
  color: var(--el-text-color-primary);
  flex-shrink: 0;
}

.header-menu {
  flex-grow: 1;
  flex-shrink: 1;
  min-width: 0;
}

.header-menu.el-menu--horizontal {
  border-bottom: none;
  display: flex;
  height: 100%;
  justify-content: flex-end;
}

.wallet-area {
  flex-shrink: 0;
  height: 100%;
  display: flex;
  align-items: center;
  margin-left: 15px;
}

.main-content-wrapper {
  flex: 1;
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
}

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
