// mcp/index.js - MCP模块索引文件

// 导出MCP客户端
const mcpClient = require('./mcpClient');

// 导出MCP配置管理
const mcpConfig = require('./mcpConfig');

// 导出MCP服务管理器
const mcpManager = require('./mcpManager');

// 导出所有模块
module.exports = {
  mcpClient,
  mcpConfig,
  mcpManager
};

// 同时支持默认导出
module.exports.default = {
  mcpClient,
  mcpConfig,
  mcpManager
};