const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  // 将消息与一个具体的对话关联
  conversationId: { 
    type: String, 
    required: true,
    index: true // 添加索引，加快查询速度
  },
  // 发送者地址
  senderAddress: { 
    type: String, 
    required: true 
  },
  // 接收者地址
  receiverAddress: { 
    type: String, 
    required: true 
  },
  // 消息内容
  content: { 
    type: String, 
    required: true 
  },
  // TODO: 消息是否已读
  isRead: { 
    type: Boolean, 
    default: false 
  },
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
