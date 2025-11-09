const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const claimSchema = new Schema({
  // 申请者地址
  applierAddress: { type: String, required: true },
  // 申请者提交的详细信息
  secretMessage: { type: String, required: true },
  
  // 每一份申请有四种状态, 分别表示未受理, 同意, 拒绝, 归档, 归档状态没有使用
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'archived'],
    default: 'pending'
  }
}, { timestamps: true });

const itemSchema = new Schema({
  // 物品名称
  name: {
    type: String,
    required: true
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
  // 拾获者地址
  finderAddress: {
    type: String,
    required: true,
    index: true
  },
  // 遗失者地址
  losterAddress: {
    type: String
  },
  // 物品状态: 'lost' 表示丢失, 'pending_handover'表示交接状态, 'found' 表示拾获
  status: {
    type: String,
    enum: ['available', 'pending_handover', 'claimed'],
    default: 'available'  // 发布物品时, 一定是丢失状态
  },
  // 用于存储图片的 URL
  imageUrl: {
    type: String,
    required: false
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
  // 物品标签
  tags: {
    type: [String],
    default: []
  },
  // 用于向量搜索
  embedding: {
    type: [Number],
    default: []
  },

  claims: [claimSchema]
}, { timestamps: true });

// 用 Schema 创建一个模型
const Item = mongoose.model('Item', itemSchema);

// 导出模型，以便在其他文件中使用
module.exports = Item;
