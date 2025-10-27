// 1. 引入 express
const express = require('express');
const mongoose = require('mongoose');
const itemRoutes = require('./routes/itemRoutes');

// 2. 创建应用对象
const app = express();

// 3. 定义一个端口号
const port = 3001; // 前端React/Vue项目默认经常使用3000

// 中间件，解析 JSON 请求体
app.use(express.json());

// --- 连接 MongoDB ---
// 把下面的字符串换成你自己的数据库连接字符串
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

app.use('/api', itemRoutes);