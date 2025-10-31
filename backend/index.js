require('dotenv').config()

// 1. 引入 express
const express = require('express');
const mongoose = require('mongoose');
const itemRoutes = require('./routes/itemRoutes');
const cors = require('cors');
const multer = require('multer');

// 2. 创建应用对象
const app = express();
app.use(cors());

// 3. 定义一个端口号
const port = 3001; // 前端React/Vue项目默认经常使用3000

const path = require('path');

// 中间件，解析 JSON 请求体
app.use(express.json());

// 访问 http://localhost:3001/uploads/img.jpg 就可以拿到图片
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// 访问 http://localhost:3001/metadata/1.json 就可以拿到元数据
app.use('/metadata', express.static(path.join(__dirname, 'metadata')));

app.use('/api', itemRoutes);

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
    app.listen(port, () => {
      console.log(`服务器正在 http://localhost:${port} 上运行`);
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