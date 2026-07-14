/**
 * 基础模型类
 * 所有预测模型的基类，定义通用接口和方法
 */
class BaseModel {
  constructor(params = {}) {
    this.params = params;
    this.name = this.constructor.name;
    this.isTrained = false;
  }

  /**
   * 训练模型
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   */
  fit(X, y) {
    // 子类实现
    throw new Error('fit method must be implemented by subclass');
  }

  /**
   * 预测
   * @param {Array} X - 特征矩阵
   * @returns {Array} - 预测结果
   */
  predict(X) {
    // 子类实现
    throw new Error('predict method must be implemented by subclass');
  }

  /**
   * 部分拟合（用于增量学习）
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   */
  partialFit(X, y) {
    // 默认实现：重新训练
    this.fit(X, y);
  }

  /**
   * 获取模型状态（用于序列化）
   * @returns {Object} - 模型状态
   */
  getState() {
    return {
      params: this.params,
      isTrained: this.isTrained
    };
  }

  /**
   * 设置模型状态（用于反序列化）
   * @param {Object} state - 模型状态
   */
  setState(state) {
    this.params = state.params;
    this.isTrained = state.isTrained;
  }

  /**
   * 计算特征重要性
   * @returns {Array} - 特征重要性
   */
  getFeatureImportance() {
    // 默认实现：返回均匀重要性
    return [];
  }

  /**
   * 计算特征贡献（用于解释预测）
   * @param {Array} instance - 单个样本
   * @returns {Array} - 特征贡献
   */
  calculateFeatureContributions(instance) {
    // 默认实现：返回空数组
    return [];
  }

  /**
   * 计算预测置信度
   * @param {Array} instance - 单个样本
   * @returns {number} - 置信度
   */
  calculateConfidence(instance) {
    // 默认实现：返回 0.5
    return 0.5;
  }

  /**
   * 克隆模型
   * @returns {BaseModel} - 克隆的模型
   */
  clone() {
    const cloned = new this.constructor(this.params);
    if (this.isTrained) {
      cloned.setState(this.getState());
    }
    return cloned;
  }
}

module.exports = BaseModel;
module.exports.default = BaseModel;