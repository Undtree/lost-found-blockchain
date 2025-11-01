const express = require('express');
const { ethers } = require('ethers');
const Item = require('../models/item');
const Message = require('../models/message'); // 引入 Message 模型

const router = express.Router();

// [!! 修改 !!] GET /items/:id/messages -> POST /items/:id/messages
router.post('/items/:id/messages', async (req, res) => {
  const { id: itemId } = req.params;
  const { userAddress, signature, signatureMessage } = req.body; // [!! 修改 !!] 从 body 获取

  // --- 安全验证 (这部分逻辑不变，已经很完美) ---
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
    
    const finder = item.finderAddress.toLowerCase();
    const appliers = item.claims.map(c => c.applierAddress.toLowerCase());

    if (userAddress.toLowerCase() !== finder && !appliers.includes(userAddress.toLowerCase())) {
        return res.status(403).json({ message: '你无权查看此对话' });
    }

    const messages = await Message.find({ conversationId: itemId }).sort({ createdAt: 'asc' });
    res.status(200).json({ message: '成功获取历史消息', data: messages });

  } catch (err) {
    res.status(500).json({ message: '服务器内部错误', error: err });
  }
});

module.exports = router;