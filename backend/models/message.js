const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  // 将消息与一个具体的物品（对话）关联起来
  conversationId: { 
    type: String, 
    required: true,
    index: true // 为这个字段添加索引，以加快查询速度
  },
  // 发送者的钱包地址
  senderAddress: { 
    type: String, 
    required: true 
  },
  // 接收者的钱包地址
  receiverAddress: { 
    type: String, 
    required: true 
  },
  // 消息内容
  content: { 
    type: String, 
    required: true 
  },
  // 消息是否已读（用于实现“未读”提示）
  isRead: { 
    type: Boolean, 
    default: false 
  },
}, { timestamps: true }); // 自动添加 createdAt 和 updatedAt 字段

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
