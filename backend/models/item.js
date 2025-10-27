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
  // 物品状态: 'lost' 表示丢失, 'found' 表示拾获
  status: {
    type: String,
    required: true
  }
}, { timestamps: true }); // timestamps 会自动添加 createdAt 和 updatedAt 字段

// 基于这个 Schema 创建一个模型 (Model)
const Item = mongoose.model('Item', itemSchema);

// 导出这个模型，以便在其他文件中使用
module.exports = Item;