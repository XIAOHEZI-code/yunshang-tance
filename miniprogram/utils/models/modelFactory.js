/**
 * 模型工厂
 * 负责创建和管理各种预测模型
 * 已修复：ES6 import → CommonJS require，兼容微信小程序
 */
const BaseModel = require('./baseModel.js');

class ModelFactory {
  constructor() {
    this.modelRegistry = new Map();
    this._registerDefaultModels();
  }

  /**
   * 注册默认模型（同步 require，兼容微信小程序）
   */
  _registerDefaultModels() {
    try {
      const LinearRegression = require('./linearRegression.js');
      this.registerModel('linearRegression', LinearRegression.default || LinearRegression);
    } catch (e) { console.warn('LinearRegression load failed:', e.message); }

    try {
      const DecisionTree = require('./decisionTree.js');
      this.registerModel('decisionTree', DecisionTree.default || DecisionTree);
    } catch (e) { console.warn('DecisionTree load failed:', e.message); }

    try {
      const RandomForest = require('./randomForest.js');
      this.registerModel('randomForest', RandomForest.default || RandomForest);
    } catch (e) { console.warn('RandomForest load failed:', e.message); }

    try {
      const GradientBoosting = require('./gradientBoosting.js');
      this.registerModel('gradientBoosting', GradientBoosting.default || GradientBoosting);
    } catch (e) { console.warn('GradientBoosting load failed:', e.message); }

    try {
      const SupportVectorRegression = require('./supportVectorRegression.js');
      this.registerModel('svr', SupportVectorRegression.default || SupportVectorRegression);
    } catch (e) { console.warn('SVR load failed:', e.message); }
  }

  /**
   * 注册模型
   * @param {string} modelName - 模型名称
   * @param {Function} ModelClass - 模型类
   */
  registerModel(modelName, ModelClass) {
    const BaseModelClass = BaseModel.default || BaseModel;
    if (ModelClass.prototype instanceof BaseModelClass) {
      this.modelRegistry.set(modelName, ModelClass);
    } else {
      console.warn(`Model ${modelName} does not extend BaseModel, registering anyway`);
      this.modelRegistry.set(modelName, ModelClass);
    }
  }

  /**
   * 创建模型实例
   * @param {string} modelName - 模型名称
   * @param {Object} params - 模型参数
   * @returns {BaseModel} - 模型实例
   */
  createModel(modelName, params = {}) {
    const ModelClass = this.modelRegistry.get(modelName);
    if (!ModelClass) {
      throw new Error(`Model ${modelName} not registered`);
    }
    return new ModelClass(params);
  }

  /**
   * 获取可用的模型列表
   * @returns {Array} - 可用模型列表
   */
  getAvailableModels() {
    return Array.from(this.modelRegistry.keys());
  }

  /**
   * 检查模型是否可用
   * @param {string} modelName - 模型名称
   * @returns {boolean} - 是否可用
   */
  isModelAvailable(modelName) {
    return this.modelRegistry.has(modelName);
  }
}

// 导出单例实例（CommonJS 兼容微信小程序）
const modelFactory = new ModelFactory();
module.exports = modelFactory;
module.exports.default = modelFactory;
module.exports.ModelFactory = ModelFactory;