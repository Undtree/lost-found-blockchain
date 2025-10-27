const express = require('express');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const Item = require('../models/item'); // 引入 Item 模型

// 创建一个路由实例
const router = express.Router();

// 配置：从环境变量读取 RPC、私钥和合约地址
// 如果未设置，提供一个友好的默认提示（在生产环境请务必使用 env）
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '';

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
  if (!contractAbi) return null;
  if (!CONTRACT_ADDRESS) return null;
  return new ethers.Contract(CONTRACT_ADDRESS, contractAbi, signerOrProvider);
}

// Helper: respond with helpful error when contract not configured
function contractNotReady(res) {
  return res.status(500).json({
    message: '合约未配置或 ABI 缺失。请设置 RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS 并确保合约已编译。'
  });
}

// POST /items - 保存到 DB 并在链上 mint NFT（如果配置了合约）
router.post('/items', async (req, res) => {
  const itemData = req.body;

  // 先保存到本地数据库
  const item = new Item(itemData);
  try {
    const saved = await item.save();

    // 如果合约可用，尝试在链上 mint
    const provider = getProvider();
    const signer = getSigner(provider);
    const contract = signer ? getContract(signer) : getContract(provider);

    if (!contract) {
      return res.status(201).json({ message: '物品发布成功（仅 DB），合约未配置，未在链上铸造', data: saved });
    }

    // 使用 item 的一些字段生成 metadata URI。这里假设前端/用户提供了 tokenURI 字段；否则将使用一个占位符
    const tokenURI = itemData.tokenURI || `ipfs://placeholder/${saved._id}`;

    // 需要 signer 才能发送交易
    if (!signer) {
      return res.status(201).json({ message: '物品保存成功，但未提供 PRIVATE_KEY，无法在链上发起交易', data: saved });
    }

    try {
      const tx = await contract.mintItem(signer.address, tokenURI);
      const receipt = await tx.wait();

      // 查找 ItemMinted 事件以获取 tokenId（event 名称在合约中为 ItemMinted）
      const iface = new ethers.Interface(contractAbi);
      let tokenId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === 'ItemMinted') {
            tokenId = parsed.args._tokenId || parsed.args.tokenId || parsed.args[0];
            break;
          }
        } catch (e) {
          // 忽略解析错误
        }
      }

      // 如果找到了 tokenId，把它写回数据库记录
      if (tokenId) {
        try {
          // tokenId 可能是 BigNumber/BigInt，转成字符串保存
          saved.tokenId = tokenId.toString ? tokenId.toString() : String(tokenId);
          await saved.save();
        } catch (e) {
          console.warn('保存 tokenId 到 DB 失败', e);
        }
      }

      return res.status(201).json({ message: '物品发布并在链上铸造成功', data: saved, txHash: receipt.transactionHash, tokenId });
    } catch (err) {
      console.error('链上铸造失败:', err);
      return res.status(201).json({ message: '物品保存在 DB，但链上铸造失败', data: saved, error: String(err) });
    }

  } catch (err) {
    return res.status(400).json({ message: '发布失败，请检查输入的数据', error: err });
  }
});

// GET /items - 列出 DB 中的物品（不查询链）
router.get('/items', async (req, res) => {
  try {
    const items = await Item.find();
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

    // 如果合约未准备好，返回 DB 信息
    const provider = getProvider();
    const contract = getContract(provider);
    if (!contract) {
      return res.status(200).json({ message: '仅返回 DB 信息（合约未配置）', data: item });
    }

    // 假设 tokenId 存在于 item.tokenId 字段（若不存在，仅返回 DB）；否则查询链上信息
    if (!item.tokenId) {
      return res.status(200).json({ message: '未在 DB 中找到 tokenId，返回 DB 信息', data: item });
    }

    try {
      const tokenId = item.tokenId.toString();
      const owner = await contract.ownerOf(tokenId);
      const tokenURI = await contract.tokenURI(tokenId);
      return res.status(200).json({ message: '成功获取物品（含链上信息）', data: { item, onchain: { owner, tokenURI } } });
    } catch (err) {
      return res.status(200).json({ message: '读取链上信息失败，已返回 DB 信息', data: item, error: String(err) });
    }

  } catch (err) {
    res.status(500).json({ message: '查询失败', error: err });
  }
});

// POST /items/:id/claim - 调用合约的 claimItem(loster, tokenId)
router.post('/items/:id/claim', async (req, res) => {
  const { loster } = req.body; // 认领者地址（链上地址）
  const id = req.params.id;

  if (!loster) return res.status(400).json({ message: '需要提供 loster 地址' });

  try {
    const item = await Item.findById(id);
    if (!item) return res.status(404).json({ message: '未找到该物品' });

    if (!item.tokenId) return res.status(400).json({ message: '该物品没有关联的 tokenId' });

    const provider = getProvider();
    const signer = getSigner(provider);
    const contract = signer ? getContract(signer) : null;
    if (!contract) return contractNotReady(res);

    try {
      const tx = await contract.claimItem(loster, item.tokenId);
      const receipt = await tx.wait();
      return res.status(200).json({ message: '认领交易已提交', txHash: receipt.transactionHash });
    } catch (err) {
      return res.status(500).json({ message: '认领失败', error: String(err) });
    }

  } catch (err) {
    res.status(500).json({ message: '处理请求失败', error: err });
  }
});

// POST /items/:id/update-metadata - 调用合约 updateTokenURI
router.post('/items/:id/update-metadata', async (req, res) => {
  const { newTokenURI } = req.body;
  const id = req.params.id;

  if (!newTokenURI) return res.status(400).json({ message: '需要提供 newTokenURI 字段' });

  try {
    const item = await Item.findById(id);
    if (!item) return res.status(404).json({ message: '未找到该物品' });
    if (!item.tokenId) return res.status(400).json({ message: '该物品没有关联的 tokenId' });

    const provider = getProvider();
    const signer = getSigner(provider);
    const contract = signer ? getContract(signer) : null;
    if (!contract) return contractNotReady(res);

    try {
      const tx = await contract.updateTokenURI(item.tokenId, newTokenURI);
      const receipt = await tx.wait();
      return res.status(200).json({ message: '更新 metadata 交易已提交', txHash: receipt.transactionHash });
    } catch (err) {
      return res.status(500).json({ message: '更新 metadata 失败', error: String(err) });
    }

  } catch (err) {
    res.status(500).json({ message: '处理请求失败', error: err });
  }
});

// 导出路由实例
module.exports = router;