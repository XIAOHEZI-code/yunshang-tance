// mcpConfig.js - MCP配置管理

/**
 * MCP配置管理
 * 用于存储和管理MCP服务器的配置信息
 */
class MCPConfig {
  constructor() {
    this.config = {
      // MCP服务器配置
      server: {
        url: 'https://mcp.example.com',
        apiKey: '',
        timeout: 30000
      },
      
      // 模型配置
      models: {
        analysis: {
          endpoint: '/api/analyze',
          timeout: 60000
        },
        prediction: {
          endpoint: '/api/predict',
          timeout: 60000
        },
        carbonEmission: {
          endpoint: '/api/carbon/emission',
          timeout: 30000
        }
      },
      
      // 功能配置
      features: {
        enableAnalysis: true,
        enablePrediction: true,
        enableCarbonEmission: true,
        enableAutoSave: true
      },
      
      // 调试配置
      debug: {
        enabled: false,
        logLevel: 'info' // 'debug', 'info', 'warn', 'error'
      }
    };
    
    // 从本地存储加载配置
    this.loadConfig();
  }

  /**
   * 从本地存储加载配置
   */
  loadConfig() {
    try {
      if (typeof wx !== 'undefined') {
        // 微信小程序环境
        const savedConfig = wx.getStorageSync('mcpConfig');
        if (savedConfig) {
          this.config = { ...this.config, ...savedConfig };
        }
      } else {
        // 非微信小程序环境（如Node.js测试环境）
        console.log('Running in non-WeChat environment, using in-memory config');
      }
    } catch (error) {
      console.error('Failed to load MCP config:', error);
    }
  }

  /**
   * 保存配置到本地存储
   */
  saveConfig() {
    try {
      if (typeof wx !== 'undefined') {
        // 微信小程序环境
        wx.setStorageSync('mcpConfig', this.config);
      } else {
        // 非微信小程序环境（如Node.js测试环境）
        console.log('Running in non-WeChat environment, config not saved to storage');
      }
    } catch (error) {
      console.error('Failed to save MCP config:', error);
    }
  }

  /**
   * 获取配置
   * @param {string} key - 配置键
   * @returns {*} - 配置值
   */
  get(key) {
    if (!key) {
      return this.config;
    }
    
    return key.split('.').reduce((acc, curr) => {
      return acc && acc[curr] !== undefined ? acc[curr] : undefined;
    }, this.config);
  }

  /**
   * 设置配置
   * @param {string} key - 配置键
   * @param {*} value - 配置值
   */
  set(key, value) {
    const keys = key.split('.');
    let config = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!config[keys[i]]) {
        config[keys[i]] = {};
      }
      config = config[keys[i]];
    }
    
    config[keys[keys.length - 1]] = value;
    this.saveConfig();
  }

  /**
   * 重置配置为默认值
   */
  reset() {
    this.config = {
      server: {
        url: 'https://mcp.example.com',
        apiKey: '',
        timeout: 30000
      },
      models: {
        analysis: {
          endpoint: '/api/analyze',
          timeout: 60000
        },
        prediction: {
          endpoint: '/api/predict',
          timeout: 60000
        },
        carbonEmission: {
          endpoint: '/api/carbon/emission',
          timeout: 30000
        }
      },
      features: {
        enableAnalysis: true,
        enablePrediction: true,
        enableCarbonEmission: true,
        enableAutoSave: true
      },
      debug: {
        enabled: false,
        logLevel: 'info'
      }
    };
    this.saveConfig();
  }

  /**
   * 验证配置
   * @returns {boolean} - 配置是否有效
   */
  validate() {
    return !!(this.config.server && this.config.server.url);
  }
}

// 导出单例实例
const mcpConfig = new MCPConfig();
module.exports = mcpConfig;
module.exports.default = mcpConfig;