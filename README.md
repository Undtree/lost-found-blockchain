# lost-found-blockchain

## 项目结构

```
/lost-found-blockchain
  ├── /contracts        (Hardhat 智能合约项目)
  ├── /backend          (Node.js/Express 服务器项目)
  └── /frontend         (Vue.js 前端项目)
```

## 启动项目

启动 Docker Engine 后进入项目目录，执行 setup.sh

```
chmod +x setup.sh
./setup.sh
```

或者 setup.bat

```
.\setup.bat
```

进入 contracts 目录，启动本地节点

```
npx hardhat node
```

开启一个新终端，进入 contracts 目录，部署合约

```
npx hardhat run scripts/deploy.ts --network localhost
```

进入 backend 目录，启动后端

```
node index.js
```

进入 frontend 目录，启动前端

```
npm run dev
```
