// parseWorkerManager.js - 文件解析Worker线程管理器（继承 BaseWorkerManager）
// 专注于 CSV/文件类型解析任务的路由，生命周期管理由基类负责

const BaseWorkerManager = require('./baseWorkerManager.js');

/**
 * 文件解析Worker管理器
 * 通过 Worker 线程解析 CSV/检测文件类型，自动降级到主线程实现
 */
class ParseWorkerManager extends BaseWorkerManager {
  constructor() {
    super({
      workerScript: 'worker/parseWorker.js',
      taskTimeout: 3000
    });
  }

  /**
   * 通过 Worker 线程（或主线程降级）解析 CSV 文件
   * @param {string} csvContent - CSV 文件内容字符串
   * @returns {Promise<Object>} - { headers, data, meta }
   */
  parseCSV(csvContent) {
    return this._dispatchTask(
      { action: 'parseCSV', data: { csvContent } },
      () => this.parseCSVInMainThread(csvContent)
    );
  }

  /**
   * 通过 Worker 线程（或主线程降级）检测文件类型
   * @param {string} binaryData - 文件内容（字符串形式）
   * @returns {Promise<Object>} - { fileType }
   */
  detectFileType(binaryData) {
    return this._dispatchTask(
      { action: 'detectFileType', data: { binaryData } },
      () => this.detectFileTypeInMainThread(binaryData)
    );
  }

  // ─── 主线程降级实现 ────────────────────────────────────────────────

  /**
   * 主线程解析CSV文件（降级方案）
   * @param {string} csvContent
   * @returns {Object} - { headers, data, meta }
   */
  parseCSVInMainThread(csvContent) {
    try {
      // 检查是否为XLSX文件（ZIP格式）
      if (csvContent.startsWith('PK')) {
        throw new Error('检测到 XLSX 格式文件，请先将文件转换为 CSV 格式后上传');
      }

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
        if (!line) continue;

        const csvSplitRegex = new RegExp(',(?=(?:(?:[^"]*"){2})*[^"]*$)');
        const values = line.split(csvSplitRegex).map((value) => {
          let trimmed = value.trim();
          if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            trimmed = trimmed.slice(1, -1).replace(/""/g, '"');
          }
          const num = parseFloat(trimmed);
          return isNaN(num) ? trimmed : num;
        });

        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] !== undefined ? values[index] : '';
        });
        data.push(row);
      }

      if (data.length === 0) {
        console.warn('CSV 文件没有数据行，只有表头');
      }

      return {
        headers,
        data,
        meta: {
          rowCount: data.length,
          columnCount: headers.length,
          fileType: 'csv'
        }
      };
    } catch (error) {
      console.error('CSV解析错误:', error);
      throw new Error('CSV 文件解析失败: ' + error.message);
    }
  }

  /**
   * 主线程检测文件类型（降级方案）
   * @param {string} binaryData
   * @returns {{ fileType: string }}
   */
  detectFileTypeInMainThread(binaryData) {
    // 1. 检测XLSX文件（ZIP格式，以PK开头）
    if (binaryData.startsWith('PK')) {
      return { fileType: 'xlsx' };
    }

    // 2. 检测CSV文件的特征
    if (typeof binaryData === 'string') {
      const hasCommas = binaryData.includes(',');
      if (hasCommas) {
        const lines = binaryData
          .split(/\r?\n/)
          .filter((line) => line.trim() !== '');
        if (lines.length >= 1) {
          const firstLineFields = lines[0].split(',').length;
          const consistentStructure = lines.every((line) => {
            const fields = line.split(',').length;
            return fields === firstLineFields || line === lines[lines.length - 1];
          });
          if (consistentStructure) {
            return { fileType: 'csv' };
          }
        }
      }
    }

    // 3. 默认返回csv，让parseCSV函数进一步验证
    return { fileType: 'csv' };
  }
}

// 导出单例实例
const parseWorkerManager = new ParseWorkerManager();
module.exports = parseWorkerManager;
module.exports.default = parseWorkerManager;
