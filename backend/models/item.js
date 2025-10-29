const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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
    enum: ['available', 'claimed'],
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
  }
}, { timestamps: true }); // timestamps 会自动添加 createdAt 和 updatedAt 字段

// 基于这个 Schema 创建一个模型 (Model)
const Item = mongoose.model('Item', itemSchema);

// 导出这个模型，以便在其他文件中使用
module.exports = Item;