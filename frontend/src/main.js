// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// --- Element Plus ---
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// --- ---------------- ---

import './assets/theme.css'
import './assets/main.css'

const app = createApp(App)

app.use(router)
app.use(ElementPlus) // <-- 注册 Element Plus

app.mount('#app')
