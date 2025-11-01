require('dotenv').config()

// 1. 引入 express
const express = require('express');
const mongoose = require('mongoose');
const itemRoutes = require('./routes/itemRoutes');
const chatRoutes = require('./routes/chatRoutes');
const cors = require('cors');
const multer = require('multer');
const http = require('http'); // 引入 Node.js 内置的 http 模块
const { Server } = require("socket.io"); // 引入 Socket.IO 的 Server 类
const Message = require('./models/message'); // 引入 Message 模型
const { ethers } = require('ethers'); // 引入 ethers
const Item = require('./models/item'); // 引入 Item

// 2. 创建应用对象
const app = express();
app.use(cors());
const server = http.createServer(app); 

// 3. 定义一个端口号
const port = 3001; // 前端React/Vue项目默认经常使用3000

const path = require('path');

// 4. 初始化 Socket.IO，并配置 CORS
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // 指定前端的 URL
    methods: ["GET", "POST"]
  }
});

// [!! 3. 核心安全修复：Socket.IO 认证中间件 !!]
io.use(async (socket, next) => {
  const { signature, message } = socket.handshake.auth;

  if (!signature || !message) {
    return next(new Error('缺少身份验证信息'));
  }

  try {
    // 1. 验证签名，恢复地址
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    // 2. 将验证通过的地址附加到 socket 对象上，以供后续使用
    socket.userAddress = recoveredAddress;
    next(); // 验证通过，放行
  } catch (err) {
    console.log('Socket 认证失败:', err.message);
    return next(new Error('身份验证失败：签名无效'));
  }
});

// 5. 设置 Socket.IO 的连接监听逻辑
io.on('connection', (socket) => {
  // 此时的 socket 对象已经包含了 socket.userAddress
  console.log('一个用户已认证连接:', socket.userAddress);

  // [!! 4. 核心安全修复：'joinRoom' 事件添加授权 !!]
  socket.on('joinRoom', async (itemId) => {
    try {
      const user = socket.userAddress.toLowerCase();
      
      // 1. 检查用户是否有权加入这个房间
      const item = await Item.findById(itemId);
      if (!item) {
        socket.emit('error', { message: '房间未找到' }); // [!! 5. 使用 'error' 事件 !!]
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

  // [!! 7. 核心安全修复：'sendMessage' 事件使用服务器端地址 !!]
  socket.on('sendMessage', async (data) => {
    try {
      // 不再信任客户端发来的 senderAddress
      const senderAddress = socket.userAddress; 
      const { conversationId, receiverAddress, content } = data;

      // (可选，但推荐) 再次验证该用户是否真的属于这个房间
      if (!socket.rooms.has(conversationId)) {
        return socket.emit('messageError', { message: '你不在这个房间，无法发送消息' });
      }

      // a. 将消息保存到数据库
      const newMessage = new Message({
        conversationId,
        senderAddress, // 使用服务器验证过的地址
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
    // 捕获我们在 fileFilter 中自定义的错误
    if (err.message) {
      return res.status(400).json({ message: err.message });
    }
  }

  // 如果不是我们预期的错误，交给 Express 的默认处理器
  next(err);
});

// --- 连接 MongoDB ---
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
// --------------------

// 当有人访问服务器的根路径 (/) 时，执行回调函数
app.get('/', (req, res) => {
  res.send('The server for Lost & Found is running...');
});