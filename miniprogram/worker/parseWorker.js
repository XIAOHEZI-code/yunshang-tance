// parseWorker.js - 文件解析Worker线程
// 用于在后台线程中处理CSV文件解析，避免阻塞UI线程

/**
 * 英文表头到中文的映射字典 - 工业/冶金领域常见字段
 */
const FIELD_MAPPING = {
  // 基本信息
  'id': '编号',
  'index': '索引',
  
  // 冶金相关
  'oxygen enrichment': '富氧率',
  'oxygen_enrichment': '富氧率',
  'enrichment': '富氧率',
  
  'injection position': '喷吹位置',
  'injection_position': '喷吹位置',
  'position': '位置',
  
  'injection rate': '喷吹速率',
  'injection_rate': '喷吹速率',
  'rate': '速率',
  
  'hottmattem': '铁水温度',
  'hot metal temp': '铁水温度',
  'temperature': '温度',
  'temp': '温度',
  
  'HIR': '铁水比',
  'BF': '高炉',
  'blast furnace': '高炉',
  
  'productivity': '生产率',
  'yield': '产量',
  
  'carbon emission': '碳排放',
  'carbon_emission': '碳排放',
  'emission': '排放',
  
  // 通用参数
  'time': '时间',
  'date': '日期',
  'value': '值',
  'parameter': '参数',
  'feature': '特征',
  'target': '目标',
  'result': '结果',
  'score': '得分',
  'importance': '重要性',
  'correlation': '相关性',
  'error': '误差',
  'accuracy': '准确率',
  'precision': '精确率',
  'recall': '召回率',
  'f1': 'F1值',
  'loss': '损失值'
};

/**
 * 获取字段的中文名称
 * @param {string} fieldName - 英文字段名
 * @returns {string} - 中文字段名或原始字段名
 */
function getChineseFieldName(fieldName) {
  const normalizedFieldName = fieldName.toLowerCase().trim();
  return FIELD_MAPPING[normalizedFieldName] || fieldName;
}

/**
 * 为解析结果添加中文表头映射
 * @param {Object} parsedData - 原始解析结果
 * @returns {Object} - 带有中文表头映射的解析结果
 */
function addChineseFieldMapping(parsedData) {
  const chineseHeaders = parsedData.headers.map(header => getChineseFieldName(header));
  
  return {
    ...parsedData,
    chineseHeaders,
    fieldMapping: parsedData.headers.reduce((mapping, header, index) => {
      mapping[header] = chineseHeaders[index];
      return mapping;
    }, {})
  };
}

/**
 * 解析CSV文件内容 - 支持基本 CSV 格式
 * @param {string} csvContent - CSV文件内容
 * @returns {Object} - 解析结果，包含表头和数据
 */
function parseCSV(csvContent) {
  try {
    // 检查是否为XLSX文件（ZIP格式）
    if (csvContent.startsWith('PK')) {
      throw new Error('检测到 XLSX 格式文件，请先将文件转换为 CSV 格式后上传');
    }

    // 检查文件内容是否为空
    if (!csvContent || csvContent.trim().length === 0) {
      throw new Error('CSV 文件内容为空');
    }

    // 处理换行符，支持不同操作系统 (Windows: \r\n, Unix: \n, Mac: \r)
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() !== '');

    if (lines.length === 0) {
      throw new Error('CSV 文件内容为空或只包含空白字符');
    }

    // 提取表头（第一行）
    const headers = lines[0].split(',').map((header) => header.trim());

    if (headers.length === 0 || headers.every(h => h === '')) {
      throw new Error('CSV 文件缺少有效的表头');
    }

    // 解析数据行
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // 跳过空行

      // 使用字符串形式的正则表达式来避免语法错误
      const csvSplitRegex = new RegExp(',(?=(?:(?:[^\"]*\"){2})*[^\"]*$)');
      const values = line.split(csvSplitRegex).map((value) => {
        let trimmed = value.trim();
        // 去除包裹的引号
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          trimmed = trimmed.slice(1, -1).replace(/\"\"/g, '"');
        }
        // 尝试转换为数字
        const num = parseFloat(trimmed);
        return isNaN(num) ? trimmed : num;
      });

      // 创建行对象
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] !== undefined ? values[index] : '';
      });
      data.push(row);
    }

    // 验证解析结果
    if (data.length === 0) {
      console.warn('CSV 文件没有数据行，只有表头');
    }

    const result = {
      headers,
      data,
      meta: {
        rowCount: data.length,
        columnCount: headers.length,
        fileType: 'csv'
      }
    };
    
    return addChineseFieldMapping(result);
  } catch (error) {
    console.error('CSV解析错误:', error);
    throw new Error('CSV 文件解析失败: ' + error.message);
  }
}

/**
 * 检测文件类型（根据文件内容）
 * @param {string} binaryData - 二进制文件数据
 * @returns {string} - 文件类型：'csv'或'xlsx'
 */
function detectFileType(binaryData) {
  // 1. 检测XLSX文件（ZIP格式，以PK开头）
  if (binaryData.startsWith('PK')) {
    return 'xlsx';
  }

  // 2. 检测CSV文件的特征
  if (typeof binaryData === 'string') {
    // CSV是纯文本格式，不包含特殊二进制字符
    // 检查是否包含基本的CSV结构特征
    const hasCommas = binaryData.includes(',');

    // 3. 验证CSV的基本结构
    if (hasCommas) {
      // 检查至少有一行数据（表头+数据行或只有表头）
      const lines = binaryData
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '');
      if (lines.length >= 1) {
        // 检查每行的字段数是否一致（简单验证）
        const firstLineFields = lines[0].split(',').length;
        const consistentStructure = lines.every((line) => {
          const fields = line.split(',').length;
          // 允许最后一行字段数不一致（可能是不完整的行）
          return fields === firstLineFields || line === lines[lines.length - 1];
        });

        if (consistentStructure) {
          return 'csv';
        }
      }
    }
  }

  // 4. 默认返回csv，让parseCSV函数进一步验证
  return 'csv';
}

/**
 * Worker线程消息处理
 */
const messageHandler = function(res) {
  const { action, taskId, data } = res;

  const safePostMessage = (msg) => {
    if (typeof worker !== 'undefined' && worker.postMessage) {
      worker.postMessage(msg);
    } else if (typeof self !== 'undefined' && self.postMessage) {
      self.postMessage(msg);
    } else if (typeof wx !== 'undefined' && wx.postMessage) {
      wx.postMessage(msg);
    }
  };

  try {
    switch (action) {
      case 'parseCSV': {
        const parsedResult = parseCSV(data.csvContent);
        safePostMessage({
          action: 'parseCSVResult',
          taskId,
          success: true,
          data: parsedResult
        });
        break;
      }

      case 'detectFileType': {
        const fileType = detectFileType(data.binaryData);
        safePostMessage({
          action: 'detectFileTypeResult',
          taskId,
          success: true,
          data: { fileType }
        });
        break;
      }

      default:
        safePostMessage({
          action: 'error',
          taskId,
          success: false,
          error: 'Unknown action: ' + action
        });
    }
  } catch (error) {
    console.error('Worker error:', error);
    safePostMessage({
      action: 'error',
      taskId,
      success: false,
      error: error.message
    });
  }
};

// Register message handler — try WeChat API first, fallback to self.onmessage
if (typeof worker !== 'undefined' && typeof worker.onMessage === 'function') {
  worker.onMessage(messageHandler);
} else if (typeof wx !== 'undefined' && typeof wx.onMessage === 'function') {
  wx.onMessage(messageHandler);
} else if (typeof self !== 'undefined') {
  self.onmessage = messageHandler;
} else {
  // Last resort: try global scope
  try {
    onmessage = messageHandler;
  } catch (e) {
    // Worker environment doesn't support message handling — this is OK
  }
}

console.log('ParseWorker initialized');
