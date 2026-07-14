/**
 * 梯度提升模型
 * 基于提升方法的集成学习算法
 */
const BaseModel = require('./baseModel.js');
const DecisionTree = require('./decisionTree.js');

class GradientBoosting extends BaseModel {
  constructor(params = {}) {
    super(params);
    this.nEstimators = params.nEstimators || 10;
    this.learningRate = params.learningRate || 0.1;
    this.maxDepth = params.maxDepth || 3;
    this.minSamplesSplit = params.minSamplesSplit || 2;
    this.minSamplesLeaf = params.minSamplesLeaf || 1;
    this.loss = params.loss || 'ls'; // ls: least squares, lad: least absolute deviation
    this.models = [];
    this.initPrediction = null;
  }

  /**
   * 训练模型
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   */
  fit(X, y) {
    if (!X || !y || X.length === 0 || y.length === 0) {
      throw new Error('Invalid training data');
    }

    const numSamples = X.length;

    // 初始化预测值
    this.initPrediction = this._calculateInitialPrediction(y);
    const predictions = new Array(numSamples).fill(this.initPrediction);

    // 构建多个基学习器
    this.models = [];
    for (let i = 0; i < this.nEstimators; i++) {
      // 计算负梯度（残差）
      const residuals = this._calculateResiduals(y, predictions);

      // 训练基学习器（决策树）
      const tree = new DecisionTree({
        maxDepth: this.maxDepth,
        minSamplesSplit: this.minSamplesSplit,
        minSamplesLeaf: this.minSamplesLeaf,
        maxFeatures: null // 使用所有特征
      });

      tree.fit(X, residuals);

      // 更新预测值
      const treePredictions = tree.predict(X);
      for (let j = 0; j < numSamples; j++) {
        predictions[j] += this.learningRate * treePredictions[j];
      }

      this.models.push(tree);
    }

    this.isTrained = true;
  }

  /**
   * 计算初始预测值
   * @param {Array} y - 目标变量
   * @returns {number} - 初始预测值
   */
  _calculateInitialPrediction(y) {
    if (this.loss === 'ls') {
      // 最小二乘损失：使用均值
      return y.reduce((sum, val) => sum + val, 0) / y.length;
    } else if (this.loss === 'lad') {
      // 最小绝对偏差损失：使用中位数
      const sortedY = [...y].sort((a, b) => a - b);
      const mid = Math.floor(sortedY.length / 2);
      return sortedY.length % 2 !== 0 ? sortedY[mid] : (sortedY[mid - 1] + sortedY[mid]) / 2;
    }
    return 0;
  }

  /**
   * 计算残差（负梯度）
   * @param {Array} y - 目标变量
   * @param {Array} predictions - 当前预测值
   * @returns {Array} - 残差
   */
  _calculateResiduals(y, predictions) {
    const residuals = [];
    for (let i = 0; i < y.length; i++) {
      if (this.loss === 'ls') {
        // 最小二乘损失的负梯度是残差
        residuals.push(y[i] - predictions[i]);
      } else if (this.loss === 'lad') {
        // 最小绝对偏差损失的负梯度是符号函数
        residuals.push(y[i] > predictions[i] ? 1 : -1);
      }
    }
    return residuals;
  }

  /**
   * 预测单个样本
   * @param {Array} instance - 单个样本
   * @returns {number} - 预测值
   */
  _predictSingle(instance) {
    let prediction = this.initPrediction;
    for (const model of this.models) {
      prediction += this.learningRate * model._predictSingle(instance, model.root);
    }
    return prediction;
  }

  /**
   * 预测
   * @param {Array} X - 特征矩阵
   * @returns {Array} - 预测结果
   */
  predict(X) {
    if (!this.isTrained || this.models.length === 0) {
      throw new Error('Model not trained');
    }

    return X.map(instance => this._predictSingle(instance));
  }

  /**
   * 获取特征重要性
   * @returns {Array} - 特征重要性
   */
  getFeatureImportance() {
    if (this.models.length === 0) {
      return [];
    }

    // 聚合所有基学习器的特征重要性
    const importances = [];
    const firstModelImportance = this.models[0].getFeatureImportance();

    // 初始化重要性数组
    for (let i = 0; i < firstModelImportance.length; i++) {
      importances.push(0);
    }

    // 累加所有基学习器的重要性
    for (const model of this.models) {
      const modelImportance = model.getFeatureImportance();
      for (let i = 0; i < modelImportance.length; i++) {
        importances[i] += modelImportance[i];
      }
    }

    // 归一化
    const totalImportance = importances.reduce((sum, val) => sum + val, 0);
    if (totalImportance === 0) {
      return importances;
    }

    return importances.map(imp => imp / totalImportance);
  }

  /**
   * 计算特征贡献
   * @param {Array} instance - 单个样本
   * @returns {Array} - 特征贡献
   */
  calculateFeatureContributions(instance) {
    if (this.models.length === 0) {
      return [];
    }

    // 聚合所有基学习器的特征贡献
    const contributions = [];
    const firstModelContribution = this.models[0].calculateFeatureContributions(instance);

    // 初始化贡献数组
    for (let i = 0; i < firstModelContribution.length; i++) {
      contributions.push(0);
    }

    // 累加所有基学习器的贡献
    for (const model of this.models) {
      const modelContribution = model.calculateFeatureContributions(instance);
      for (let i = 0; i < modelContribution.length; i++) {
        contributions[i] += this.learningRate * modelContribution[i];
      }
    }

    // 归一化
    const totalContribution = contributions.reduce((sum, val) => sum + Math.abs(val), 0);
    if (totalContribution === 0) {
      return contributions;
    }

    return contributions.map(cont => cont / totalContribution);
  }

  /**
   * 计算预测置信度
   * @param {Array} instance - 单个样本
   * @returns {number} - 置信度
   */
  calculateConfidence(instance) {
    if (this.models.length === 0) {
      return 0.5;
    }

    // 计算各基学习器预测的一致性
    const predictions = [this.initPrediction];
    let currentPrediction = this.initPrediction;

    for (const model of this.models) {
      currentPrediction += this.learningRate * model._predictSingle(instance, model.root);
      predictions.push(currentPrediction);
    }

    // 计算预测的稳定性
    const lastPrediction = predictions[predictions.length - 1];
    const variance = predictions.reduce((sum, val) => sum + Math.pow(val - lastPrediction, 2), 0) / predictions.length;
    const stdDev = Math.sqrt(variance);

    // 基于预测的标准差计算置信度
    const maxPossibleStdDev = 10; // 假设最大可能标准差
    const normalizedStdDev = Math.min(stdDev / maxPossibleStdDev, 1);
    return 1 - normalizedStdDev;
  }

  /**
   * 获取模型状态
   * @returns {Object} - 模型状态
   */
  getState() {
    const state = super.getState();
    state.models = this.models.map(model => model.getState());
    state.initPrediction = this.initPrediction;
    return state;
  }

  /**
   * 设置模型状态
   * @param {Object} state - 模型状态
   */
  setState(state) {
    super.setState(state);
    this.initPrediction = state.initPrediction;
    this.models = state.models.map(modelState => {
      const model = new DecisionTree({
        maxDepth: this.maxDepth,
        minSamplesSplit: this.minSamplesSplit,
        minSamplesLeaf: this.minSamplesLeaf
      });
      model.setState(modelState);
      return model;
    });
  }

  /**
   * 获取各基学习器的预测结果
   * @param {Array} X - 特征矩阵
   * @returns {Array} - 各基学习器的预测结果
   */
  getIndividualPredictions(X) {
    if (!this.isTrained || this.models.length === 0) {
      throw new Error('Model not trained');
    }

    const individualPredictions = [];
    const currentPredictions = new Array(X.length).fill(this.initPrediction);

    individualPredictions.push({
      iteration: 0,
      predictions: [...currentPredictions]
    });

    for (let i = 0; i < this.models.length; i++) {
      const model = this.models[i];
      const modelPredictions = model.predict(X);

      for (let j = 0; j < X.length; j++) {
        currentPredictions[j] += this.learningRate * modelPredictions[j];
      }

      individualPredictions.push({
        iteration: i + 1,
        predictions: [...currentPredictions]
      });
    }

    return individualPredictions;
  }
}

module.exports = GradientBoosting;
module.exports.default = GradientBoosting;