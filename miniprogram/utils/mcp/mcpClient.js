// mcpClient.js - MCP客户端实现

/**
 * MCP客户端类
 * 用于与MCP服务器通信，实现AI模型与外部系统的交互
 */
class MCPClient {
  constructor(config = {}) {
    this.config = {
      serverUrl: config.serverUrl || 'https://mcp.example.com',
      apiKey: config.apiKey || '',
      timeout: config.timeout || 30000,
      debug: config.debug || false
    };
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`
    };
  }

  /**
   * 发送请求到MCP服务器
   * @param {string} endpoint - API端点
   * @param {Object} data - 请求数据
   * @returns {Promise<Object>} - 响应数据
   */
  async request(endpoint, data = {}) {
    try {
      const url = `${this.config.serverUrl}${endpoint}`;
      if (this.config.debug) {
        console.log('MCP Request:', url, data);
      }

      // Skip network calls if server URL is a placeholder
      const PLACEHOLDER_URLS = ['https://mcp.example.com', 'http://mcp.example.com', '', null, undefined];
      if (PLACEHOLDER_URLS.includes(this.config.serverUrl)) {
        if (this.config.debug) {
          console.log('MCP: Server URL is placeholder, skipping network request');
        }
        throw new Error('MCP_SERVER_NOT_CONFIGURED');
      }

      if (typeof wx !== 'undefined') {
        // 微信小程序环境
        try {
          const response = await wx.request({
            url,
            method: 'POST',
            headers: this.headers,
            data,
            timeout: this.config.timeout
          });

          if (this.config.debug) {
            console.log('MCP Response:', response);
          }

          if (response.statusCode === 200) {
            return response.data;
          } else {
            const errorMsg = (response.data && response.data.message) || 'Unknown error';
            throw new Error(`MCP request failed with status ${response.statusCode}: ${errorMsg}`);
          }
        } catch (networkError) {
          // Preserve MCP_SERVER_NOT_CONFIGURED flag for upstream handlers
          if (networkError.message === 'MCP_SERVER_NOT_CONFIGURED') {
            throw networkError;
          }
          throw new Error(`MCP network error: ${networkError.message || networkError}`);
        }
      } else {
        // 非微信小程序环境（如Node.js测试环境）
        console.log('Running in non-WeChat environment, simulating MCP response');
        // 模拟MCP响应
        return {
          status: 'ok',
          data: {
            message: 'MCP request simulated in non-WeChat environment'
          }
        };
      }
    } catch (error) {
      if (error.message === 'MCP_SERVER_NOT_CONFIGURED') {
        if (this.config.debug) {
          console.log('MCP: Server not configured, skipping');
        }
      } else {
        console.error('MCP request error:', error.message || error);
      }
      throw error;
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
    return this.request('/api/analyze', {
      data,
      analysisType,
      options
    });
  }

  /**
   * 预测数据
   * @param {Object} data - 要预测的数据
   * @param {string} modelType - 模型类型
   * @param {Object} options - 预测选项
   * @returns {Promise<Object>} - 预测结果
   */
  async predict(data, modelType, options = {}) {
    return this.request('/api/predict', {
      data,
      modelType,
      options
    });
  }

  /**
   * 获取模型信息
   * @param {string} modelType - 模型类型
   * @returns {Promise<Object>} - 模型信息
   */
  async getModelInfo(modelType) {
    return this.request('/api/model/info', {
      modelType
    });
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} - 健康检查结果
   */
  async healthCheck() {
    return this.request('/api/health');
  }
}

// 导出单例实例
const mcpClient = new MCPClient();
module.exports = mcpClient;
module.exports.default = mcpClient;