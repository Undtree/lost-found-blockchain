const express = require('express');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const multer = require('multer'); // 引入 multer
const Item = require('../models/item'); // 引入 Item 模型

// 创建一个路由实例
const router = express.Router();

// 配置：从环境变量读取 RPC、私钥和合约地址
// 如果未设置，提供一个友好的默认提示（在生产环境请务必使用 env）
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// 读取合约 ABI（使用 Hardhat artifacts 生成的 JSON）
const artifactPath = path.resolve(__dirname, '..', '..', 'contracts', 'artifacts', 'contracts', 'LostItemNFT.sol', 'LostItemNFT.json');
let contractAbi = null;
try {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  contractAbi = artifact.abi;
} catch (err) {
  console.warn('无法读取合约 ABI，请确认编译产物存在于:', artifactPath);
}

// ethers provider & signer 工厂
function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

function getSigner(provider) {
  if (!PRIVATE_KEY) return null;
  try {
    return new ethers.Wallet(PRIVATE_KEY, provider);
  } catch (err) {
    return null;
  }
}

function getContract(signerOrProvider) {
  if (!contractAbi || !CONTRACT_ADDRESS) return null;
  return new ethers.Contract(CONTRACT_ADDRESS, contractAbi, signerOrProvider);
}

// 当合约未配置时提供错误信息
function contractNotReady(res) {
  return res.status(500).json({
    message: '合约未配置或 ABI 缺失。请检查 .env 文件 (PRIVATE_KEY, CONTRACT_ADDRESS)'
  });
}

// --- 配置 Multer ---
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const metadataDir = path.join(__dirname, '..', 'metadata');
if (!fs.existsSync(metadataDir)) {
  fs.mkdirSync(metadataDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // 文件存储路径
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage});
// ------

// POST /items - 保存到 DB 并在链上 mint NFT（如果配置了合约）
// --- POST /items/upload 路由 (保持不变) ---
router.post('/items/upload', upload.single('image'), async (req, res) => {
  // 1. 从 req 中获取所有数据
  const { 
    name, description, location, finderAddress, 
    signature, signatureMessage // 1. 获取新字段
  } = req.body;
  
  // 2. 检查基本字段
  if (!req.file) {
    return res.status(400).json({ message: '必须上传物品图片 (字段名: image)' });
  }
  if (!name || !description || !location || !finderAddress) {
    return res.status(400).json({ message: '缺少字段 (name, description, location, finderAddress)' });
  }

  // 3. 安全验证守卫
  if (!signature || !signatureMessage) {
    return res.status(403).json({ message: '缺少身份验证签名 (Signature)' });
  }

  let recoveredAddress;
  try {
    // 后端使用 ethers.verifyMessage 来检查签名
    recoveredAddress = ethers.verifyMessage(signatureMessage, signature);
  } catch (e) {
    return res.status(400).json({ message: '签名格式无效' });
  }
  
  // 4. 验证签名是否匹配
  if (recoveredAddress.toLowerCase() !== finderAddress.toLowerCase()) {
    return res.status(403).json({ 
      message: '签名验证失败：finderAddress 与签名者不匹配。' 
    });
  }
  
  // 5. 验证通过
  
  // 准备图片 URL 和元数据
  const imageUrl = `${BASE_URL}/uploads/${req.file.filename}`;
  const metadata = {
    name: name,
    description: description,
    image: imageUrl,
    attributes: [
      { "trait_type": "Location", "value": location }
    ]
  };

  // 3. 将元数据保存到服务器本地文件
  const metadataFileName = `${Date.now()}.json`;
  const metadataPath = path.join(metadataDir, metadataFileName);
  const metadataUrl = `${BASE_URL}/metadata/${metadataFileName}`;
  try {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  } catch (err) {
    return res.status(500).json({ message: '保存元数据文件失败', error: err });
  }

  // 4. 连接合约并 Mint
  const provider = getProvider();
  const signer = getSigner(provider);
  const contract = signer ? getContract(signer) : null;
  if (!contract) return contractNotReady(res);

  let tokenId = null;
  let txHash = null;

  try {
    // 我们 100% 信任 finderAddress，因为我们已经验证了签名
    const tx = await contract.mintItem(finderAddress, metadataUrl);
    const receipt = await tx.wait();
    txHash = receipt.hash;

    // 5. 从事件中解析出 Token ID
    const iface = new ethers.Interface(contractAbi);
    for (const log of (receipt.logs || [])) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === 'ItemMinted') {
          tokenId = parsed.args.tokenId; 
          break;
        }
      } catch (e) { /* 忽略 */ }
    }

    if (!tokenId) {
      throw new Error("无法从交易回执中解析出 Token ID");
    }
    tokenId = tokenId.toString();

  } catch (err) {
    console.error('链上铸造失败:', err);
    return res.status(500).json({ message: '链上铸造失败', error: String(err) });
  }
  
  // 6. 将所有信息存入 MongoDB
  const newItem = new Item({
    name,
    description,
    location,
    finderAddress,
    imageUrl,
    metadataUrl,
    tokenId,
    status: 'available'
    // claims 默认为 []
  });

  try {
    const savedItem = await newItem.save();
    return res.status(201).json({ 
      message: '物品发布、链上铸造、存入 DB 均成功！', 
      data: savedItem, 
      txHash: txHash 
    });
  } catch (err) {
    // (DB 保存失败的错误处理)
    console.error('链上成功，但存入 DB 失败:', err);
    return res.status(500).json({ 
      message: '链上成功，但存入 DB 失败', 
      error: err, 
      tokenId: tokenId, 
      txHash: txHash 
    });
  }
});

// GET /items - 列出 DB 中的物品（不查询链）
router.get('/items', async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.status(200).json({ message: '成功获取物品列表', data: items });
  } catch (err) {
    res.status(500).json({ message: '获取物品列表失败', error: err });
  }
});

// GET /items/:id - 获取单个物品（DB + 链上 tokenURI 和 owner）
router.get('/items/:id', async (req, res) => {
  try {
    const id = req.params.id; 
    const item = await Item.findById(id);
    if (!item) return res.status(404).json({ message: '未找到该物品' });
    return res.status(200).json({ message: '成功获取物品', data: item });
  } catch (err) {
    res.status(500).json({ message: '查询失败', error: err });
  }
});

// GET /my-items/:address - 查看自己已经发布的物品
router.get('/items/my-items/:address', async (req, res) => {
  const { address } = req.params;

  // 验证传入的是否为合法的地址格式
  if (!ethers.isAddress(address)) {
    return res.status(400).json({ message: '不合法的地址格式' });
  }

  try {
    const items = await Item.find({ 
      // 使用正则表达式和 'i' 标志来进行不区分大小写的地址匹配
      finderAddress: new RegExp(`^${address}$`, 'i') 
    }).sort({ createdAt: -1 }); // 按时间倒序

    res.status(200).json({ message: '成功获取物品信息', data: items });
  } catch (err) {
    res.status(500).json({ message: '数据库查询失败', error: err });
  }
});

// POST /items/:id/claim-db 路由
router.post('/items/:id/claim-db', async (req, res) => {
  const { losterAddress } = req.body;
  const { id } = req.params; 

  if (!losterAddress) {
    return res.status(400).json({ message: '需要遗失者的钱包地址' });
  }

  // 1. 从数据库获取物品信息 
  let item;
  try {
    item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: '未查询到该物品信息' });
    }
    if (item.status === 'claimed') {
      return res.status(200).json({ message: '该物品已被标记为认领', data: item });
    }
    if (item.status === 'available') {
      return res.status(400).json({ message: '操作无效：必须先执行链下批准 (approve)，使物品状态变为 "pending_handover"' });
    }
  } catch (dbErr) {
    return res.status(500).json({ message: '数据库查询失败', error: dbErr });
  }

  // 2. [安全验证] 去区块链核实所有权 
  const provider = getProvider();
  const contract = getContract(provider);
  if (!contract) return contractNotReady(res);

  let onChainOwner;
  try {
    onChainOwner = await contract.ownerOf(item.tokenId);
  } catch (chainErr) {
    return res.status(500).json({ message: '查询链主信息失败', error: chainErr });
  }

  // 3. 对比并更新 
  if (onChainOwner.toLowerCase() === item.finderAddress.toLowerCase()) {
    return res.status(403).json({ message: '验证失败：链上所有者仍然是发现者。' });
  }
  if (onChainOwner.toLowerCase() !== losterAddress.toLowerCase()) {
    return res.status(403).json({ 
      message: 'V验证失败：链上所有者地址与提供的失主地址不匹配。',
      onChainOwner: onChainOwner
    });
  }

  // 4. 验证通过！更新数据库 
  try {
    item.status = 'claimed';
    item.losterAddress = onChainOwner;

    // 更新 Claims 状态
    item.claims.forEach(claim => {
      if (claim.applierAddress.toLowerCase() === onChainOwner.toLowerCase()) {
        claim.status = 'approved';
      } else if (claim.status === 'pending') {
        // 物品已被认领，自动拒绝其他所有待处理的申请
        claim.status = 'rejected';
      }
    });

    const updatedItem = await item.save();
    
    res.status(200).json({ message: '物品状态校验成功，更新为\'claimed\'', data: updatedItem });

  } catch (err) {
    res.status(500).json({ message: '更新物品状态失败', error: err });
  }
});

// POST /items/:id/submit-claim 路由
router.post('/items/:id/submit-claim', async (req, res) => {
  const { id } = req.params;
  const { applierAddress, secretMessage, signature, signatureMessage } = req.body;

  // 1. 验证所有字段
  if (!applierAddress || !secretMessage || !signature || !signatureMessage) {
    return res.status(400).json({ message: '缺少字段 (applierAddress, secretMessage, signature, signatureMessage)' });
  }

  // 2. 验证签名 (确保申请人是他们声称的那个人)
  let recoveredAddress;
  try {
    recoveredAddress = ethers.verifyMessage(signatureMessage, signature);
  } catch (e) {
    return res.status(400).json({ message: '签名格式无效' });
  }

  if (recoveredAddress.toLowerCase() !== applierAddress.toLowerCase()) {
    return res.status(403).json({ 
      message: '签名验证失败：applierAddress 与签名者不匹配。' 
    });
  }

  // 3. 查找物品
  try {
    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: '未找到物品' });
    }
    if (item.status === 'claimed') {
      return res.status(400).json({ message: '该物品已被认领' });
    }
    if (item.status === 'pending_handover') {
      return res.status(400).json({ message: '该物品正在等待交接，暂不接受新申请' });
    }

    // 4. 防止重复提交
    const existingClaimIndex = item.claims.findIndex(
      c => c.applierAddress.toLowerCase() === applierAddress.toLowerCase()
    );

    if (existingClaimIndex > -1) {
      // 已经存在申请
      const existingClaim = item.claims[existingClaimIndex];

      if (existingClaim.status === 'pending') {
        return res.status(409).json({ message: '你已提交过申请，请等待拾物者审核' });
      }

      if (existingClaim.status === 'approved') {
        return res.status(400).json({ message: '你的申请已被批准' });
      }

      if (existingClaim.status === 'rejected') {
        // 重新申请
        // 更新旧的、被拒绝的申请，重置为 pending
        existingClaim.secretMessage = secretMessage;
        existingClaim.status = 'pending';
        await item.save();
        return res.status(200).json({ message: '重新申请提交成功', data: item });
      }

    } else {
      // 首次申请
      // 5. 将新申请推入数组
      const newClaim = {
        applierAddress: applierAddress,
        secretMessage: secretMessage,
        status: 'pending' // 默认为 'pending'
      };
      item.claims.push(newClaim);
      await item.save();
      // 返回更新后的物品
      res.status(201).json({ message: '认领申请提交成功', data: item });
    }

  } catch (err) {
    res.status(500).json({ message: '提交申请失败', error: err });
  }
});

// POST /items/:id/claims/:claimId/reject - 拒绝他人申请
router.post('/items/:id/claims/:claimId/reject', async (req, res) => {
  const { id: itemId, claimId } = req.params;
  const { finderAddress, signature, signatureMessage } = req.body;

  // 1. 验证签名 (确保操作者是他们声称的那个人)
  if (!finderAddress || !signature || !signatureMessage) {
    return res.status(400).json({ message: '缺少 Finder 签名认证' });
  }

  let recoveredAddress;
  try {
    recoveredAddress = ethers.verifyMessage(signatureMessage, signature);
  } catch (e) {
    return res.status(400).json({ message: '签名格式无效' });
  }

  if (recoveredAddress.toLowerCase() !== finderAddress.toLowerCase()) {
    return res.status(403).json({ message: '签名验证失败' });
  }

  // 2. 查找物品
  try {
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: '未找到物品' });
    }

    // 3. [安全] 验证签名者是否为物品的 Finder
    if (item.finderAddress.toLowerCase() !== finderAddress.toLowerCase()) {
      return res.status(403).json({ message: '你不是该物品的拾物者，无权操作' });
    }

    // 4. 查找特定的 Claim
    const claim = item.claims.id(claimId); // Mongoose sub-document finder
    if (!claim) {
      return res.status(404).json({ message: '未找到该条申请' });
    }

    // 5. 检查状态
    if (claim.status !== 'pending') {
      return res.status(400).json({ message: `该申请已处于 "${claim.status}" 状态，无法拒绝` });
    }

    // 6. 执行拒绝
    claim.status = 'rejected';
    await item.save(); // 保存父文档

    res.status(200).json({ message: '申请已拒绝', data: item });

  } catch (err) {
    res.status(500).json({ message: '拒绝申请失败', error: err });
  }
});

// POST /items/:id/claims/:claimId/approve - 批准他人申请
router.post('/items/:id/claims/:claimId/approve', async (req, res) => {
  const { id: itemId, claimId } = req.params;
  const { finderAddress, signature, signatureMessage } = req.body;

  // 1. 验证签名 (确保是 Finder)
  if (!finderAddress || !signature || !signatureMessage) {
    return res.status(400).json({ message: '缺少 Finder 签名认证' });
  }
  let recoveredAddress;
  try {
    recoveredAddress = ethers.verifyMessage(signatureMessage, signature);
  } catch (e) {
    return res.status(400).json({ message: '签名格式无效' });
  }
  if (recoveredAddress.toLowerCase() !== finderAddress.toLowerCase()) {
    return res.status(403).json({ message: '签名验证失败' });
  }

  // 2. 查找物品
  try {
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: '未找到物品' });

    // 3. 验证签名者是否为 Finder
    if (item.finderAddress.toLowerCase() !== finderAddress.toLowerCase()) {
      return res.status(403).json({ message: '你不是该物品的拾物者' });
    }
    
    // 4. 检查物品状态
    if (item.status !== 'available') {
        return res.status(400).json({ message: '物品不处于 "available" 状态' });
    }

    const claimToApprove = item.claims.id(claimId);
    if (!claimToApprove || claimToApprove.status !== 'pending') {
      return res.status(400).json({ message: '该申请不是 "pending" 状态' });
    }

    // 5. [核心] 执行批准
    item.status = 'pending_handover'; // 锁定物品
    
    item.claims.forEach(claim => {
      if (claim._id.equals(claimToApprove._id)) {
        claim.status = 'approved';
      } else if (claim.status === 'pending') {
        // 自动拒绝其他所有待处理的
        claim.status = 'rejected'; 
      }
    });

    await item.save();
    res.status(200).json({ message: '链下批准成功，等待交接', data: item });

  } catch (err) {
    res.status(500).json({ message: '批准失败', error: err });
  }
});

/// POST /items/:id/cancel-handover - 取消物品交接
router.post('/items/:id/cancel-handover', async (req, res) => {
  const { id: itemId } = req.params;
  const { finderAddress, signature, signatureMessage } = req.body;

  // 1. 验证签名 (确保是 Finder)
  if (!finderAddress || !signature || !signatureMessage) {
    return res.status(400).json({ message: '缺少 Finder 签名认证' });
  }
  let recoveredAddress;
  try {
    recoveredAddress = ethers.verifyMessage(signatureMessage, signature);
  } catch (e) {
    return res.status(400).json({ message: '签名格式无效' });
  }
  if (recoveredAddress.toLowerCase() !== finderAddress.toLowerCase()) {
    return res.status(403).json({ message: '签名验证失败' });
  }

  // 2. 查找物品
  try {
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: '未找到物品' });

    // 3. 验证签名者是否为 Finder
    if (item.finderAddress.toLowerCase() !== finderAddress.toLowerCase()) {
      return res.status(403).json({ message: '你不是该物品的拾物者' });
    }
    
    // 4. 检查物品状态
    if (item.status !== 'pending_handover') {
        return res.status(400).json({ message: '物品不处于 "pending_handover" 状态，无法取消' });
    }

    // 5. 【核心】执行回滚
    item.status = 'available'; // 状态回滚
    
    // 逻辑：我们将所有“已批准”和“被自动拒绝”的申请全部重置为“待定”
    // 这样 Finder 就可以重新审核所有人
    item.claims.forEach(claim => {
      if (claim.status === 'approved' || claim.status === 'rejected') {
        claim.status = 'pending';
      }
    });

    await item.save();
    res.status(200).json({ message: '交接已取消，物品已重新开放审核', data: item });

  } catch (err) {
    res.status(500).json({ message: '取消失败', error: err });
  }
});

// 导出路由实例
module.exports = router;
