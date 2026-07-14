/**
 * 模型评估工具
 * 提供模型评估和比较功能
 */
class ModelEvaluator {
  constructor() {
    this.metrics = {
      mse: (yTrue, yPred) => this._calculateMSE(yTrue, yPred),
      rmse: (yTrue, yPred) => this._calculateRMSE(yTrue, yPred),
      r2: (yTrue, yPred) => this._calculateR2(yTrue, yPred),
      mae: (yTrue, yPred) => this._calculateMAE(yTrue, yPred),
      mape: (yTrue, yPred) => this._calculateMAPE(yTrue, yPred)
    };
  }

  /**
   * 评估模型
   * @param {BaseModel} model - 要评估的模型
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   * @param {Array} metrics - 要计算的指标列表
   * @returns {Object} - 评估结果
   */
  evaluate(model, X, y, metrics = ['mse', 'rmse', 'r2']) {
    if (!model || !model.isTrained) {
      throw new Error('Model not trained');
    }

    if (!X || !y || X.length === 0 || y.length === 0) {
      throw new Error('Invalid evaluation data');
    }

    const predictions = model.predict(X);
    const results = {};

    for (const metric of metrics) {
      if (this.metrics[metric]) {
        results[metric] = this.metrics[metric](y, predictions);
      } else {
        throw new Error(`Unknown metric: ${metric}`);
      }
    }

    return results;
  }

  /**
   * 交叉验证
   * @param {BaseModel} model - 要评估的模型
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   * @param {number} cv - 交叉验证折数
   * @param {Array} metrics - 要计算的指标列表
   * @returns {Object} - 交叉验证结果
   */
  crossValidate(model, X, y, cv = 5, metrics = ['mse', 'rmse', 'r2']) {
    if (!X || !y || X.length === 0 || y.length === 0) {
      throw new Error('Invalid cross-validation data');
    }

    const numSamples = X.length;
    if (numSamples < cv) {
      throw new Error('Number of samples must be greater than or equal to cv');
    }

    // 生成索引并打乱
    const indices = Array.from({ length: numSamples }, (_, i) => i);
    this._shuffleArray(indices);

    // 计算每折的大小
    const foldSize = Math.floor(numSamples / cv);
    const results = {};

    // 初始化结果存储
    for (const metric of metrics) {
      results[metric] = [];
    }

    // 执行交叉验证
    for (let i = 0; i < cv; i++) {
      // 划分训练集和验证集
      const valStart = i * foldSize;
      const valEnd = (i === cv - 1) ? numSamples : (i + 1) * foldSize;

      const valIndices = indices.slice(valStart, valEnd);
      const trainIndices = indices.filter(idx => !valIndices.includes(idx));

      const XTrain = trainIndices.map(idx => X[idx]);
      const yTrain = trainIndices.map(idx => y[idx]);
      const XVal = valIndices.map(idx => X[idx]);
      const yVal = valIndices.map(idx => y[idx]);

      // 训练模型
      const modelClone = model.clone();
      modelClone.fit(XTrain, yTrain);

      // 评估模型
      const foldResults = this.evaluate(modelClone, XVal, yVal, metrics);

      // 存储结果
      for (const metric of metrics) {
        results[metric].push(foldResults[metric]);
      }
    }

    // 计算平均结果
    const averagedResults = {};
    for (const metric of metrics) {
      const values = results[metric];
      averagedResults[metric] = values.reduce((sum, val) => sum + val, 0) / values.length;
      averagedResults[`${metric}_std`] = this._calculateStandardDeviation(values);
    }

    return {
      ...averagedResults,
      folds: results
    };
  }

  /**
   * 比较多个模型
   * @param {Array} models - 模型列表
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   * @param {number} cv - 交叉验证折数
   * @param {Array} metrics - 要计算的指标列表
   * @returns {Array} - 模型比较结果
   */
  compareModels(models, X, y, cv = 5, metrics = ['mse', 'rmse', 'r2']) {
    const comparisonResults = [];

    for (const model of models) {
      try {
        const cvResults = this.crossValidate(model, X, y, cv, metrics);
        comparisonResults.push({
          modelName: model.constructor.name,
          params: model.params,
          results: cvResults
        });
      } catch (error) {
        console.error(`Error evaluating model ${model.constructor.name}:`, error);
        comparisonResults.push({
          modelName: model.constructor.name,
          params: model.params,
          error: error.message
        });
      }
    }

    return comparisonResults;
  }

  /**
   * 计算均方误差
   * @param {Array} yTrue - 真实值
   * @param {Array} yPred - 预测值
   * @returns {number} - 均方误差
   */
  _calculateMSE(yTrue, yPred) {
    if (yTrue.length !== yPred.length) {
      throw new Error('Length of yTrue and yPred must be the same');
    }

    const n = yTrue.length;
    return yTrue.reduce((sum, val, i) => sum + Math.pow(val - yPred[i], 2), 0) / n;
  }

  /**
   * 计算均方根误差
   * @param {Array} yTrue - 真实值
   * @param {Array} yPred - 预测值
   * @returns {number} - 均方根误差
   */
  _calculateRMSE(yTrue, yPred) {
    return Math.sqrt(this._calculateMSE(yTrue, yPred));
  }

  /**
   * 计算R²评分
   * @param {Array} yTrue - 真实值
   * @param {Array} yPred - 预测值
   * @returns {number} - R²评分
   */
  _calculateR2(yTrue, yPred) {
    if (yTrue.length !== yPred.length) {
      throw new Error('Length of yTrue and yPred must be the same');
    }

    const n = yTrue.length;
    const meanY = yTrue.reduce((sum, val) => sum + val, 0) / n;

    const ssRes = yTrue.reduce((sum, val, i) => sum + Math.pow(val - yPred[i], 2), 0);
    const ssTot = yTrue.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);

    if (ssTot === 0) {
      return 1.0;
    }

    return 1 - (ssRes / ssTot);
  }

  /**
   * 计算平均绝对误差
   * @param {Array} yTrue - 真实值
   * @param {Array} yPred - 预测值
   * @returns {number} - 平均绝对误差
   */
  _calculateMAE(yTrue, yPred) {
    if (yTrue.length !== yPred.length) {
      throw new Error('Length of yTrue and yPred must be the same');
    }

    const n = yTrue.length;
    return yTrue.reduce((sum, val, i) => sum + Math.abs(val - yPred[i]), 0) / n;
  }

  /**
   * 计算平均绝对百分比误差
   * @param {Array} yTrue - 真实值
   * @param {Array} yPred - 预测值
   * @returns {number} - 平均绝对百分比误差
   */
  _calculateMAPE(yTrue, yPred) {
    if (yTrue.length !== yPred.length) {
      throw new Error('Length of yTrue and yPred must be the same');
    }

    const n = yTrue.length;
    let sum = 0;
    let count = 0;

    for (let i = 0; i < n; i++) {
      if (yTrue[i] !== 0) {
        sum += Math.abs((yTrue[i] - yPred[i]) / yTrue[i]);
        count++;
      }
    }

    if (count === 0) {
      return 0;
    }

    return (sum / count) * 100;
  }

  /**
   * 计算标准差
   * @param {Array} values - 数值数组
   * @returns {number} - 标准差
   */
  _calculateStandardDeviation(values) {
    const n = values.length;
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / (n - 1);
    return Math.sqrt(variance);
  }

  /**
   * 打乱数组
   * @param {Array} array - 要打乱的数组
   */
  _shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * 获取可用的评估指标
   * @returns {Array} - 可用的评估指标
   */
  getAvailableMetrics() {
    return Object.keys(this.metrics);
  }
}

module.exports = ModelEvaluator;
module.exports.default = ModelEvaluator;