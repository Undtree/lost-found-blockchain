const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const claimSchema = new Schema({
  applierAddress: { type: String, required: true },
  secretMessage: { type: String, required: true },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'archived'],
    default: 'pending'
  }
}, { timestamps: true }); // 'createdAt' 会告诉我们申请提交的时间

const itemSchema = new Schema({
  // 物品名称
  name: {
    type: String,
    required: true // 表示这个字段是必填的
  },
  // 物品描述
  description: {
    type: String,
    required: true
  },
  // 丢失/拾获地点
  location: {
    type: String,
    required: true
  },
  // 拾获者链上地址
  finderAddress: {
    type: String,
    required: true,
    index: true
  },
  // 遗失者链上地址
  losterAddress: {
    type: String
  },
  // 物品状态: 'lost' 表示丢失, 'found' 表示拾获
  status: {
    type: String,
    enum: ['available', 'pending_handover', 'claimed'],
    default: 'available'
  },
  // 用于存储图片的 URL
  imageUrl: {
    type: String,
    required: false // 设置为非必填，允许发布没有图片的物品
  },
  // 物品在服务器上的元数据路径
  metadataUrl:{
    type: String,
    required: true
  },
  // 物品链上 Token ID
  tokenId: {
    type: String,
    unique: true,
    sparse: true
  },
  tags: {
    type: [String], // 存储标签的数组
    default: []
  },
  // 用于 AI 向量搜索的嵌入字段
  embedding: {
    type: [Number],
    default: []
  },

  claims: [claimSchema]
}, { timestamps: true }); // timestamps 会自动添加 createdAt 和 updatedAt 字段

// 基于这个 Schema 创建一个模型 (Model)
const Item = mongoose.model('Item', itemSchema);

// 导出这个模型，以便在其他文件中使用
module.exports = Item;
