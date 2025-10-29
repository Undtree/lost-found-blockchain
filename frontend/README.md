# frontend

Vue.js 前端项目

## 步骤一：配置Vue环境

### 编写方需要做，clone 方请勿操作

```
# 进入总目录，创建frontend子目录
cd lost-found-blockchain
mkdir frontend
cd frontend

# 初始化Vue项目
npm create vue@latest . # package name输入frontend，features选择Router，ESLint，Prettier，experimental features全部不选，start with a blank Vue project选择No
npm install

# 安装额外的依赖
npm install element-plus
npm install ethers
npm install axios

# 启动Vue项目
npm run dev
