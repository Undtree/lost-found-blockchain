require('dotenv').config()

const express = require('express');
const mongoose = require('mongoose');
const itemRoutes = require('./routes/itemRoutes');
const chatRoutes = require('./routes/chatRoutes');
const cors = require('cors');
const multer = require('multer');
const http = require('http');
const { Server } = require("socket.io");
const Message = require('./models/message');
const { ethers } = require('ethers');
const Item = require('./models/item');

// 1. 创建应用对象
const app = express();
app.use(cors());
const server = http.createServer(app); 

// 2. 定义一个端口号
const port = 3001;

const path = require('path');

// 3. 初始化 Socket.IO，并配置 CORS
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Socket.IO 认证中间件
io.use(async (socket, next) => {
  const { signature, message } = socket.handshake.auth;

  if (!signature || !message) {
    return next(new Error('缺少身份验证信息'));
  }

  try {
    // 验证签名，恢复地址
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    // 将验证通过的地址附加到 socket 对象上，以供后续使用
    socket.userAddress = recoveredAddress;
    next(); // 验证通过，放行
  } catch (err) {
    console.log('Socket 认证失败:', err.message);
    return next(new Error('身份验证失败：签名无效'));
  }
});

// 4. 设置 Socket.IO 的连接监听逻辑
io.on('connection', (socket) => {
  // 此时 socket 对象已经包含 socket.userAddress
  console.log('一个用户已认证连接:', socket.userAddress);

  // 'joinRoom' 事件需要授权
  socket.on('joinRoom', async (itemId) => {
    try {
      const user = socket.userAddress.toLowerCase();
      
      // 1. 检查用户是否有权加入这个房间
      const item = await Item.findById(itemId);
      if (!item) {
        socket.emit('error', { message: '房间未找到' });
        return;
      }

      const finder = item.finderAddress.toLowerCase();
      // 只有 Finder 和“被批准”的 Loster 才能加入
      const approvedClaim = item.claims.find(c => c.status === 'approved');
      const approvedLoster = approvedClaim ? approvedClaim.applierAddress.toLowerCase() : null;

      if (user === finder || user === approvedLoster) {
        // 2. 授权通过，加入房间
        socket.join(itemId);
        console.log(`Socket ${socket.id} (${user}) 进入聊天: ${itemId}`);
        socket.emit('joinedRoom', itemId); // [!! 6. 反馈前端 !!]
      } else {
        socket.emit('error', { message: '你无权加入此房间' });
      }
    } catch (err) {
      socket.emit('error', { message: '加入房间时服务器出错' });
    }
  });

  // 'sendMessage' 事件使用服务器端地址
  socket.on('sendMessage', async (data) => {
    try {
      // 不信任客户端发来的 senderAddress
      const senderAddress = socket.userAddress; 
      const { conversationId, receiverAddress, content } = data;

      // 再次验证该用户是否真的属于这个房间
      if (!socket.rooms.has(conversationId)) {
        return socket.emit('messageError', { message: '你不在这个房间，无法发送消息' });
      }

      // a. 将消息保存到数据库
      const newMessage = new Message({
        conversationId,
        senderAddress,
        receiverAddress,
        content
      });
      const savedMessage = await newMessage.save();

      // b. 将保存后的消息广播给房间里的所有人
      io.to(conversationId).emit('newMessage', savedMessage);
      
    } catch (error) {
      console.error('处理消息时出错:', error);
      socket.emit('messageError', { message: '消息发送失败' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`用户 ${socket.userAddress} 已断开连接`);
  });
});

// 中间件，解析 JSON 请求体
app.use(express.json());

// 访问 http://localhost:3001/uploads/img.jpg 就可以拿到图片
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// 访问 http://localhost:3001/metadata/1.json 就可以拿到元数据
app.use('/metadata', express.static(path.join(__dirname, 'metadata')));

app.use('/api', itemRoutes);
app.use('/api', chatRoutes);

app.use((err, req, res, next) => {
  // 检查错误是否是 Multer 抛出的
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: '文件太大！图片大小不能超过 5MB。'
      });
    }
  } else if (err) {
    // 捕获在 fileFilter 中自定义的错误
    if (err.message) {
      return res.status(400).json({ message: err.message });
    }
  }

  // 其他错误交给 Express 默认处理
  next(err);
});

// 连接 MongoDB
const dbURI = 'mongodb://localhost:27017/lost-and-found';

mongoose.connect(dbURI)
  .then((result) => {
    console.log('成功连接到 MongoDB 数据库');
    // 只有当数据库连接成功后，才启动服务器
    server.listen(port, () => {
      console.log(`Socket.IO 与服务器正在 http://localhost:${port} 上运行`);
    });
  })
  .catch((err) => {
    console.log('Failed to connect to MongoDB database:', err);
  });

app.get('/', (req, res) => {
  res.send('The server for Lost & Found is running...');
});