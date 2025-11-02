// utils/aiApi.js
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// 1. 从 .env 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});

// 辅助函数：根据文件路径获取 MIME 类型
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  // 默认或添加更多
  return 'image/jpeg';
}

/**
 * 使用 OpenAI-compatible API 分析本地图片
 * @param {string} imagePath - 图片在服务器上的临时路径
 * @returns {Promise<{name: string, tags: string[]}>}  <-- [!! 注意: 返回值是 name !!]
 */
async function analyzeImage(imagePath) {
  try {
    // 1. 将图片文件读取为 Base64 编码
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = getMimeType(imagePath);
    
    // 2. 构造 OpenAI Vision API (GPT-4o / GPT-4V) 请求
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // 你使用的模型
      response_format: { type: "json_object" }, 
      messages: [
        {
          // [!! 这里的提示是正确的, 要求 'name' !!]
          role: "system",
          content: `你是一个失物招领 DApp 的AI助手。你的任务是分析图片并返回一个 JSON 对象:
1.  'name': 对物品外观的**通用性描述**（约 10-20 字），**必须使用中文**。
    **重要规则：** 只描述物品的**精确类别**和**主要颜色/图案**（例如：“一个黑色的皮质钱包”，“一把带花纹的伞”，“一张黄色的海报”）。
    **绝对不要**提及图片上的任何**品牌名称、特定角色名称（如 '初音未来'）或可读的具体文字**。
    这样做的目的是为了保留“秘密细节”，让真正的失主有机会通过提供这些秘密来证明身份。
2.  'tags': 2-3个相关的**中文**搜索关键词数组。
    **标签规则：** 标签应该是**物品的类别**（如："钱包"，"雨伞"）或**有意义的组合**（如："动漫周边"，"黄色海报"，"皮质钱包"）。
    **绝对不要**只使用单独的颜色或形容词（错误示范：["黄色", "大的"]）。
    **正确示范：** ["饮用水", "动漫周边", "黄色海报"]。`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请分析这个失物的图片，并按要求返回 JSON。"
            },
            {
              type: "image_url",
              image_url: {
                "url": `data:${mimeType};base64,${imageBase64}`
              },
            },
          ],
        },
      ],
      max_tokens: 300, // 限制 token 数量以节省成本
    });

    // 3. 解析 AI 返回的 JSON 字符串
    const jsonResponse = response.choices[0].message.content;
    const parsedData = JSON.parse(jsonResponse);

    // [!! 核心修复: 检查 'name' !!]
    if (!parsedData.name || !Array.isArray(parsedData.tags)) {
        throw new Error("Agent 返回了无效的 JSON 格式 (缺少 name 或 tags)");
    }

    // [!! 核心修复: 返回 'name' !!]
    return {
      name: parsedData.name,
      tags: parsedData.tags
    };

  } catch (err) {
    console.error('OpenAI API (中转站) 出错:', err);
    // 抛出错误，以便前端的 catch 块可以捕获它
    throw new Error('Agent 分析图片失败'); 
  }
}

module.exports = { analyzeImage };
