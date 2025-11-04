const express = require('express');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const multer = require('multer'); // 引入 multer
const Item = require('../models/item'); // 引入 Item 模型
const rateLimit = require('express-rate-limit');
const cosineSimilarity = require('cosine-similarity');
const { analyzeImage, getTextEmbedding } = require('../utils/aiApi');

// 创建一个路由实例
const router = express.Router();

// 配置：从环境变量读取 RPC、私钥和合约地址
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// 读取合约 ABI
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

// 定义一个文件过滤器函数
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型！仅允许上传 jpg, jpeg, png, heif, webp 格式的图片。'), false);
  }
};

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

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制文件大小为 5MB
  },
  fileFilter: imageFileFilter
});
// ------

const aiAnalysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟的窗口期
  max: 10, // 每个 IP 在 15 分钟内最多只能请求 10 次
  message: {
    message: '你提交的 Agent 分析请求过多，请 15 分钟后再试。'
  },
  standardHeaders: true, // 返回 RateLimit-* 相关的 HTTP 头
  legacyHeaders: false, // 禁用 X-RateLimit-* 旧版头
});

// [!! 核心修改: POST /items/analyze-image 路由 !!]
// (添加了签名验证守卫)
router.post('/items/analyze-image', aiAnalysisLimiter, upload.single('image'), async (req, res) => {
  // 1. 从 req.body 获取身份验证数据
  // (Multer 会处理 multipart/form-data, 文本字段在 req.body, 文件在 req.file)
  const { userAddress, signature, signatureMessage } = req.body;

  // 2. 验证文件
  if (!req.file) {
    return res.status(400).json({ message: '必须上传物品图片 (字段名: image)' });
  }

  // 3. [!! 新增 !!] 验证身份签名
  if (!userAddress || !signature || !signatureMessage) {
    // 验证失败，删除已上传的临时文件
    try { fs.unlinkSync(req.file.path); } catch (e) { /* 忽略 */ }
    return res.status(403).json({ message: '缺少身份验证签名 (Signature)' });
  }

  // 4. [!! 新增 !!] 验证签名是否匹配
  let recoveredAddress;
  try {
    recoveredAddress = ethers.verifyMessage(signatureMessage, signature);
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch (e) { /* 忽略 */ }
    return res.status(400).json({ message: '签名格式无效' });
  }

  if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
    try { fs.unlinkSync(req.file.path); } catch (e) { /* 忽略 */ }
    return res.status(403).json({ 
      message: '签名验证失败：userAddress 与签名者不匹配。' 
    });
  }
  
  // 5. [!! 验证通过 !!]
  // (只有验证通过了，才执行昂贵的 AI 分析)
  try {
    const { name, tags } = await analyzeImage(req.file.path);
    
    // 分析完成后，删除这个临时文件
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkErr) {
      console.warn(`删除临时分析文件失败: ${req.file.path}`, unlinkErr);
    }
    
    res.status(200).json({
      message: 'Agent 分析成功',
      data: { name, tags }
    });

  } catch (err) {
    // AI 分析失败
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkErr) { /* 忽略 */ }
    
    res.status(500).json({ message: err.message || 'Agent 分析时服务器出错' });
  }
});

// [!! 核心修改: POST /items/upload 路由 !!]
router.post('/items/upload', upload.single('image'), async (req, res) => {
  // 1. 从 req 中获取所有数据
  const { 
    name, description, location, finderAddress, 
    signature, signatureMessage,
    tags // [!! a. 接收新字段 (Tags) !!]
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
  
  // [!! b. 解析 Tags !!]
  let parsedTags = [];
  if (tags) {
    try {
      // 假设前端发送的是 JSON 字符串数组 '["tag1", "tag2"]'
      parsedTags = JSON.parse(tags); 
      if (!Array.isArray(parsedTags)) parsedTags = [];
    } catch (e) {
      // 备选方案：或者是逗号分隔的字符串 "tag1,tag2"
      parsedTags = tags.split(',').map(t => t.trim()).filter(t => t);
    }
  }

  // 准备图片 URL 和元数据
  const imageUrl = `${BASE_URL}/uploads/${req.file.filename}`;
  const metadata = {
    name: name,
    description: description,
    image: imageUrl,
    attributes: [
      { "trait_type": "Location", "value": location },
      // [!! c. 将 tags 添加到元数据 !!]
      ...parsedTags.map(tag => ({ "trait_type": "Tag", "value": tag }))
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
    status: 'available',
    tags: parsedTags, // [!! d. 保存 Tags 到 DB !!]
    // embedding 默认为 []
    // claims 默认为 []
  });

  try {
    const savedItem = await newItem.save();
    res.status(201).json({ 
      message: '物品发布、链上铸造、存入 DB 均成功！', 
      data: savedItem, 
      txHash: txHash 
    });

    generateAndSaveEmbedding(savedItem);
  } catch (err) {
    console.error('POST /items/upload 路由出错:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: '发布物品时服务器内部出错', error: err.message });
    }
  }
});

/**
 * 异步生成嵌入向量并将其更新到数据库中。
 * @param {object} savedItem - 刚存入数据库的 Mongoose Item 对象
 */
async function generateAndSaveEmbedding(savedItem) {
  try {
    console.log(`[后台任务] 开始为 Item ID: ${savedItem._id} 生成向量...`);
    
    // 1. 准备文本
    const textToEmbed = savedItem.name + " " + savedItem.tags.join(" ");
    
    // 2. (耗时操作) 调用 AI
    const embedding = await getTextEmbedding(textToEmbed);

    // 3. (数据库 I/O) 更新数据库
    await Item.findByIdAndUpdate(savedItem._id, {
      $set: { embedding: embedding }
    });

    console.log(`[后台任务] 成功为 Item ID: ${savedItem._id} 保存向量。`);

  } catch (embedErr) {
    // 因为这个任务是后台运行的，用户不会看到这个错误
    // 所以我们必须在服务器日志中记录它！
    console.error(`[后台任务] 为 Item ID: ${savedItem._id} 生成向量失败:`, embedErr.message);
  }
}

// GET /api/items/search 路由
router.get('/items/search', async (req, res) => {
  const { q } = req.query; 

  if (!q || typeof q !== 'string' || q.trim() === '') {
    return res.status(200).json({ message: '查询为空', data: [] });
  }

  try {
    // 1. 将用户的搜索词向量化
    const searchEmbedding = await getTextEmbedding(q);

    // 2. 从数据库中找出所有可用的、且已生成向量的物品
    const items = await Item.find({ 
      status: 'available', 
      embedding: { $exists: true, $ne: [] } 
    }).select('_id name description location imageUrl status tokenId tags createdAt embedding');

    // 3. 在 Node.js 内存中计算余弦相似度
    const scoredItems = items.map(item => {
      if (!item.embedding || item.embedding.length === 0) {
        return { item, score: 0 };
      }
      
      const score = cosineSimilarity(searchEmbedding, item.embedding);
      
      const itemObject = item.toObject(); 
      itemObject.score = score;
      
      return itemObject;
    });

    // 4. [!! 核心修改 !!] 按分数从高到低排序 (在过滤前执行)
    scoredItems.sort((a, b) => b.score - a.score);

    // 5. [!! 核心修改 !!] 定义分级阈值 (从高到低)
    const THRESHOLDS = [0.30, 0.25, 0.20]; // [高匹配, 中匹配, 低匹配]
    
    let finalResults = [];
    let activeThreshold = null; // 记录当前生效的阈值

    // 6. [!! 核心修改 !!] 遍历阈值，查找第一个能返回结果的级别
    for (const threshold of THRESHOLDS) {
      // 过滤出大于等于当前阈值的结果
      const results = scoredItems.filter(item => item.score >= threshold);
      
      // 如果这一级别有结果
      if (results.length > 0) {
        finalResults = results;       // 采用这一档的结果
        activeThreshold = threshold;  // 记录我们使用的是哪个阈值
        break;                      // [重要] 停止查找，不再降级
      }
    }
    
    // 7. [!! 核心修改 !!] 返回结果和所用的阈值
    // 如果连最低的 0.25 都没匹配到，finalResults 会是 [], activeThreshold 会是 null
    res.status(200).json({ 
      message: '搜索成功', 
      data: finalResults,
      threshold: activeThreshold // (例如: 0.7, 0.5, 0.25 或 null)
    });

  } catch (err) {
    console.error('搜索时出错:', err);
    res.status(500).json({ message: err.message || '搜索时服务器出错' });
  }
});

// GET /items - 列出 DB 中的物品
router.get('/items', async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.status(200).json({ message: '成功获取物品列表', data: items });
  } catch (err) {
    res.status(500).json({ message: '获取物品列表失败', error: err });
  }
});

// GET /items/:id - 获取单个物品
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
  if (!ethers.isAddress(address)) {
    return res.status(400).json({ message: '不合法的地址格式' });
  }
  try {
    const items = await Item.find({ 
      finderAddress: new RegExp(`^${address}$`, 'i') 
    }).sort({ createdAt: -1 });
    res.status(200).json({ message: '成功获取物品信息', data: items });
  } catch (err) {
    res.status(500).json({ message: '数据库查询失败', error: err });
  }
});

// GET /my-claims/:address - 查看自己的申请
router.get('/items/my-claims/:address', async (req, res) => {
  const { address } = req.params;
  if (!ethers.isAddress(address)) {
    return res.status(400).json({ message: 'Invalid Ethereum address format' });
  }
  try {
    const items = await Item.find({ 
      'claims.applierAddress': new RegExp(`^${address}$`, 'i') 
    }).sort({ createdAt: -1 });
    res.status(200).json({ message: 'Successfully fetched user claims', data: items });
  } catch (err) {
    res.status(500).json({ message: 'DB query failed', error: err });
  }
});

// POST /items/:id/claim-db 路由
router.post('/items/:id/claim-db', async (req, res) => {
  const { losterAddress } = req.body;
  const { id } = req.params; 

  if (!losterAddress) {
    return res.status(400).json({ message: '需要遗失者的钱包地址' });
  }

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

  const provider = getProvider();
  const contract = getContract(provider);
  if (!contract) return contractNotReady(res);

  let onChainOwner;
  try {
    onChainOwner = await contract.ownerOf(item.tokenId);
  } catch (chainErr) {
    return res.status(500).json({ message: '查询链主信息失败', error: chainErr });
  }

  if (onChainOwner.toLowerCase() === item.finderAddress.toLowerCase()) {
    return res.status(403).json({ message: '验证失败：链上所有者仍然是发现者。' });
  }
  if (onChainOwner.toLowerCase() !== losterAddress.toLowerCase()) {
    return res.status(403).json({ 
      message: '验证失败：链上所有者地址与提供的失主地址不匹配。',
      onChainOwner: onChainOwner
    });
  }

  try {
    item.status = 'claimed';
    item.losterAddress = onChainOwner;
    item.claims.forEach(claim => {
      if (claim.applierAddress.toLowerCase() === onChainOwner.toLowerCase()) {
        claim.status = 'approved';
      } else if (claim.status === 'pending') {
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

  if (!applierAddress || !secretMessage || !signature || !signatureMessage) {
    return res.status(400).json({ message: '缺少字段 (applierAddress, secretMessage, signature, signatureMessage)' });
C-A}

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

    const existingClaimIndex = item.claims.findIndex(
      c => c.applierAddress.toLowerCase() === applierAddress.toLowerCase()
    );

    if (existingClaimIndex > -1) {
      const existingClaim = item.claims[existingClaimIndex];
      if (existingClaim.status === 'pending') {
        return res.status(409).json({ message: '你已提交过申请，请等待拾物者审核' });
      }
      if (existingClaim.status === 'approved') {
        return res.status(400).json({ message: '你的申请已被批准' });
      }
      if (existingClaim.status === 'rejected') {
        existingClaim.secretMessage = secretMessage;
        existingClaim.status = 'pending';
        await item.save();
        return res.status(200).json({ message: '重新申请提交成功', data: item });
      }
    } else {
      const newClaim = {
        applierAddress: applierAddress,
        secretMessage: secretMessage,
        status: 'pending'
      };
      item.claims.push(newClaim);
      await item.save();
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

  try {
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: '未找到物品' });
    }
    if (item.finderAddress.toLowerCase() !== finderAddress.toLowerCase()) {
      return res.status(403).json({ message: '你不是该物品的拾物者，无权操作' });
    }
    const claim = item.claims.id(claimId);
    if (!claim) {
      return res.status(404).json({ message: '未找到该条申请' });
    }
    if (claim.status !== 'pending') {
      return res.status(400).json({ message: `该申请已处于 "${claim.status}" 状态，无法拒绝` });
    }
    claim.status = 'rejected';
    await item.save();
    res.status(200).json({ message: '申请已拒绝', data: item });
  } catch (err) {
    res.status(500).json({ message: '拒绝申请失败', error: err });
  }
});

// POST /items/:id/claims/:claimId/approve - 批准他人申请
router.post('/items/:id/claims/:claimId/approve', async (req, res) => {
  const { id: itemId, claimId } = req.params;
  const { finderAddress, signature, signatureMessage } = req.body;

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

  try {
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: '未找到物品' });
    if (item.finderAddress.toLowerCase() !== finderAddress.toLowerCase()) {
      return res.status(403).json({ message: '你不是该物品的拾物者' });
    }
    if (item.status !== 'available') {
        return res.status(400).json({ message: '物品不处于 "available" 状态' });
    }
    const claimToApprove = item.claims.id(claimId);
    if (!claimToApprove || claimToApprove.status !== 'pending') {
      return res.status(400).json({ message: '该申请不是 "pending" 状态' });
    }

    item.status = 'pending_handover';
    item.claims.forEach(claim => {
      if (claim._id.equals(claimToApprove._id)) {
        claim.status = 'approved';
      } else if (claim.status === 'pending') {
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

  try {
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: '未找到物品' });
    if (item.finderAddress.toLowerCase() !== finderAddress.toLowerCase()) {
      return res.status(403).json({ message: '你不是该物品的拾物者' });
    }
    if (item.status !== 'pending_handover') {
        return res.status(400).json({ message: '物品不处于 "pending_handover" 状态，无法取消' });
    }

    item.status = 'available';
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

// POST /items/:id/chat-target 路由
router.post('/items/:id/chat-target', async (req, res) => {
  const { id: itemId } = req.params;
  const { userAddress, signature, signatureMessage } = req.body;

  if (!userAddress || !signature || !signatureMessage) {
    return res.status(403).json({ message: '缺少身份验证签名' });
  }
  let recoveredAddress;
  try {
    recoveredAddress = ethers.verifyMessage(signatureMessage, signature);
  } catch (e) {
    return res.status(400).json({ message: '签名格式无效' });
  }
  if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
    return res.status(403).json({ message: '签名验证失败' });
  }

  try {
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: '未找到物品' });
    }

    const user = userAddress.toLowerCase();
    const finder = item.finderAddress.toLowerCase();
    let targetAddress = null;

    if (user === finder) {
      if (item.status === 'pending_handover') {
        const approvedClaim = item.claims.find(c => c.status === 'approved');
        if (approvedClaim) {
          targetAddress = approvedClaim.applierAddress;
        } else {
          return res.status(404).json({ message: '错误：物品在 pending_handover 状态，但未找到批准的申请人' });
        }
      } else {
        return res.status(400).json({ message: '物品不处于等待交接状态，无法发起聊天' });
      }
    } else {
      const myClaim = item.claims.find(c => c.applierAddress.toLowerCase() === user);
      if (myClaim && myClaim.status === 'approved') {
        targetAddress = item.finderAddress;
      } else {
        return res.status(403).json({ message: '你不是此物品批准的认领者，无法发起聊天' });
      }
    }
    
    res.status(200).json({ 
      message: '成功获取聊天目标', 
      data: { targetAddress: targetAddress }
    });
  } catch (err) {
    res.status(500).json({ message: '服务器内部错误', error: err });
  }
});

// 导出路由实例
module.exports = router;
