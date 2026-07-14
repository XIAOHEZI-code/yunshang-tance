// mcpManager.js - MCP服务管理器

const mcpClient = require('./mcpClient');
const mcpConfig = require('./mcpConfig');

/**
 * MCP服务管理器
 * 用于管理MCP服务的连接和调用
 */
class MCPManager {
  constructor() {
    this.client = mcpClient;
    this.config = mcpConfig;
    this.isConnected = false;
  }

  /**
   * 初始化MCP服务
   * @returns {Promise<boolean>} - 初始化是否成功
   */
  async init() {
    try {
      // 检查配置
      if (!this.config.validate()) {
        console.warn('MCP config is not valid, using default config');
      }

      // 更新客户端配置
      this.client.config = {
        serverUrl: this.config.get('server.url'),
        apiKey: this.config.get('server.apiKey'),
        timeout: this.config.get('server.timeout'),
        debug: this.config.get('debug.enabled')
      };

      // 测试连接
      const healthCheck = await this.client.healthCheck();
      this.isConnected = healthCheck.status === 'ok';

      if (this.isConnected) {
        console.log('MCP service initialized successfully');
      } else {
        console.warn('MCP service health check failed');
      }

      return this.isConnected;
    } catch (error) {
      if (error.message === 'MCP_SERVER_NOT_CONFIGURED') {
        console.info('MCP server not configured, using local analysis only');
      } else {
        console.warn('Failed to initialize MCP service:', error.message || error);
      }
      this.isConnected = false;
      return false;
    }
  }

  /**
   * 分析数据
   * @param {Object} data - 要分析的数据
   * @param {string} analysisType - 分析类型
   * @param {Object} options - 分析选项
   * @returns {Promise<Object>} - 分析结果
   */
  async analyze(data, analysisType, options = {}) {
    try {
      if (!this.isConnected) {
        await this.init();
      }

      if (!this.isConnected) {
        throw new Error('MCP service is not connected');
      }

      // 添加默认选项
      const defaultOptions = this.config.get(`models.${analysisType}`) || {};
      const mergedOptions = { ...defaultOptions, ...options };

      return await this.client.analyze(data, analysisType, mergedOptions);
    } catch (error) {
      console.error('MCP analysis error:', error);
      throw error;
    }
  }

  /**
   * 预测数据
   * @param {Object} data - 要预测的数据
   * @param {string} modelType - 模型类型
   * @param {Object} options - 预测选项
   * @returns {Promise<Object>} - 预测结果
   */
  async predict(data, modelType, options = {}) {
    try {
      if (!this.isConnected) {
        await this.init();
      }

      if (!this.isConnected) {
        throw new Error('MCP service is not connected');
      }

      // 添加默认选项
      const defaultOptions = this.config.get(`models.${modelType}`) || {};
      const mergedOptions = { ...defaultOptions, ...options };

      return await this.client.predict(data, modelType, mergedOptions);
    } catch (error) {
      console.error('MCP prediction error:', error);
      throw error;
    }
  }

  /**
   * 计算碳排放量
   * @param {Object} data - 碳排放数据
   * @param {Object} options - 计算选项
   * @returns {Promise<Object>} - 计算结果
   */
  async calculateCarbonEmission(data, options = {}) {
    try {
      if (!this.isConnected) {
        await this.init();
      }

      if (!this.isConnected) {
        throw new Error('MCP service is not connected');
      }

      // 添加默认选项
      const defaultOptions = this.config.get('models.carbonEmission') || {};
      const mergedOptions = { ...defaultOptions, ...options };

      return await this.client.request('/api/carbon/emission', {
        data,
        options: mergedOptions
      });

    } catch (error) {
      console.error('MCP carbon emission calculation error:', error);
      throw error;
    }
  }

  /**
   * 获取支持的模型列表
   * @returns {Promise<Array>} - 模型列表
   */
  async getModels() {
    try {
      if (!this.isConnected) {
        await this.init();
      }

      if (!this.isConnected) {
        throw new Error('MCP service is not connected');
      }

      return await this.client.request('/api/models');
    } catch (error) {
      console.error('Failed to get models:', error);
      throw error;
    }
  }

  /**
   * 更新配置
   * @param {Object} config - 配置对象
   */
  updateConfig(config) {
    Object.keys(config).forEach(key => {
      this.config.set(key, config[key]);
    });

    // 重新初始化
    this.init();
  }

  /**
   * 检查连接状态
   * @returns {boolean} - 连接状态
   */
  getConnectionStatus() {
    return this.isConnected;
  }
}

// 导出单例实例
const mcpManager = new MCPManager();
module.exports = mcpManager;
module.exports.default = mcpManager;