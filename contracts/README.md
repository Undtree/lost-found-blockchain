# contracts

Hardhat 智能合约项目

## 步骤一：配置智能合约环境 (Hardhat)

### 编写方需要做，clone 方请勿操作

```
# 1. 进入总目录，创建contracts子目录
cd lost-found-blockchain
mkdir contracts
cd contracts

# 2. 初始化Hardhat项目
npm init -y
npm install --save-dev hardhat@^2.22.0 @nomicfoundation/hardhat-toolbox@^4.0.0
npx hardhat # 注意选择Type Script，其他默认

# 3. 安装OpenZeppelin合约库 (必须)
npm install @openzeppelin/contracts

# 4. 删除示例合约和示例测试
rm contracts/Lock.sol
rm test/Lock.js
```

### clone 方操作

```
# 下载Hardhat项目依赖
cd contracts
npm install
```

上面步骤可能出现的 warn 警告可以忽略，npm fund 和 npm audit fix 也不需要执行

## 步骤二：进行智能合约测试和部署

```
# 在lost-found-blockchain/contracts目录下
# 运行编译
npx hardhat compile
# 运行测试，期间可能提示安装VSCode插件，默认y即可，9项测试可以全部通过
npx hardhat test
# 在本地启动一条测试链，执行后，当前打开的终端会阻塞
npx hardhat node
# 开启一个新的终端，部署合约
npx hardhat run scripts/deploy.ts --network localhost
# 如果打印出下面的结果，说明部署成功
Deploying contracts with the account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
LostItemNFT deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```
注意：部署的合约地址是永远不会改变的，但是一旦关闭了我们开启的 Hardhat 链（数据仅位于内存中），数据就会立即丢失，因此下一次需要重新启动测试链，并重新部署合约。
Trick：根据这个特性，后端代码可以直接写死合约地址 0x5Fb...。
