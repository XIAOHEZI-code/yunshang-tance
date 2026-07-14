/**
 * cloudService.js - 云函数调用封装服务
 * 用于统一管理和调用微信云开发相关函数，包含重试、超时、错误处理等逻辑
 */

// 标志云环境是否已初始化
let isCloudInitialized = false;

/**
 * 初始化云开发环境
 */
function initCloud() {
  if (isCloudInitialized) return true;
  
  if (!wx.cloud) {
    console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    return false;
  }
  
  try {
    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV, // 使用当前云环境
      traceUser: true, // 记录用户访问
    });
    isCloudInitialized = true;
    console.log('云开发环境初始化成功');
    return true;
  } catch (error) {
    console.error('云开发环境初始化失败:', error);
    return false;
  }
}

/**
 * 基础云函数调用封装
 * @param {string} name - 云函数名称
 * @param {Object} data - 传递给云函数的参数 (需要包含 action)
 * @param {Object} config - 配置项 (如超时配置，默认 15000ms)
 * @returns {Promise<any>}
 */
async function callCloudFunction(name, data, config = {}) {
  // 确保云环境已初始化
  if (!initCloud()) {
    return Promise.reject(new Error('云开发环境未初始化'));
  }

  const { timeout = 15000, retryCount = 0 } = config;
  let currentTry = 0;

  const doCall = async () => {
    try {
      // wx.cloud.callFunction 并不是原生支持 timeout，通过 Promise.race 实现
      const callPromise = wx.cloud.callFunction({
        name,
        data,
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`云函数 ${name} 调用超时 (${timeout}ms)`)), timeout);
      });

      const res = await Promise.race([callPromise, timeoutPromise]);
      
      // 检查云函数内部抛出的逻辑错误
      if (res.result && res.result.success === false) {
        throw new Error(res.result.error || '云函数执行返回错误');
      }

      return res.result;
    } catch (error) {
      if (currentTry < retryCount) {
        currentTry++;
        console.warn(`云函数 ${name} 调用失败，正在进行第 ${currentTry} 次重试...`, error);
        return doCall();
      }
      console.error(`云函数 ${name} 调用最终失败:`, error);
      throw error;
    }
  };

  return doCall();
}

/**
 * ==========================================
 *  数据备份与恢复服务 (调用 backup 云函数)
 * ==========================================
 */
const backupService = {
  /**
   * 备份数据
   * @param {Array} data - 需要备份的数据列表
   * @param {Object} options - 配置项 (如 name, description)
   */
  backupData: (data, options = {}) => {
    return callCloudFunction('backup', {
      action: 'backupData',
      data,
      options
    });
  },

  /**
   * 恢复数据
   * @param {string} backupId - 备份记录 ID
   * @param {Object} options - 恢复选项
   */
  restoreData: (backupId, options = {}) => {
    return callCloudFunction('backup', {
      action: 'restoreData',
      data: { backupId },
      options
    });
  },

  /**
   * 获取备份列表
   * @param {Object} query - 查询条件
   */
  listBackups: (query = {}, options = {}) => {
    return callCloudFunction('backup', {
      action: 'listBackups',
      data: query,
      options
    });
  },

  /**
   * 删除备份
   * @param {string} backupId - 备份记录 ID
   */
  deleteBackup: (backupId) => {
    return callCloudFunction('backup', {
      action: 'deleteBackup',
      data: { backupId }
    });
  }
};

/**
 * ==========================================
 *  数据处理与分析服务 (调用 dataProcess 云函数)
 * ==========================================
 */
const dataProcessService = {
  /**
   * 处理 CSV 数据 (服务器端解析)
   * @param {string} csvData - 原始 CSV 文本
   */
  processCSV: (csvData, options = {}) => {
    // CSV 数据可能较大，设置更长的超时时间
    return callCloudFunction('dataProcess', {
      action: 'processCSV',
      data: csvData,
      options
    }, { timeout: 30000 });
  },

  /**
   * 分析数据基础维度
   */
  analyzeData: (data, options = { type: 'basic' }) => {
    return callCloudFunction('dataProcess', {
      action: 'analyzeData',
      data,
      options
    });
  },

  /**
   * 计算指定列的统计特征
   */
  calculateStats: (data, targetColumn) => {
    return callCloudFunction('dataProcess', {
      action: 'calculateStats',
      data,
      options: { column: targetColumn }
    });
  },

  /**
   * 检测异常值
   */
  detectOutliers: (data, targetColumn) => {
    return callCloudFunction('dataProcess', {
      action: 'detectOutliers',
      data,
      options: { column: targetColumn }
    });
  },

  /**
   * 云端特征重要性计算 (卸载本地算力)
   */
  featureImportance: (data, targetColumn, featureColumns) => {
    return callCloudFunction('dataProcess', {
      action: 'featureImportance',
      data,
      options: { target: targetColumn, features: featureColumns }
    });
  },
  
  /**
   * 云端生成工艺优化建议
   */
  optimization: (data, targetColumn, featureColumns) => {
    return callCloudFunction('dataProcess', {
      action: 'optimization',
      data,
      options: { target: targetColumn, features: featureColumns }
    }, { timeout: 20000 });
  }
};

module.exports = {
  initCloud,
  callCloudFunction,
  backupService,
  dataProcessService
};
