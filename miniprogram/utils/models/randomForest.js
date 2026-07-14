/**
 * 随机森林模型
 * 基于多个决策树的集成学习方法
 */
const BaseModel = require('./baseModel.js');
const DecisionTree = require('./decisionTree.js');

class RandomForest extends BaseModel {
  constructor(params = {}) {
    super(params);
    this.nEstimators = params.nEstimators || 10;
    this.maxDepth = params.maxDepth || 10;
    this.minSamplesSplit = params.minSamplesSplit || 2;
    this.minSamplesLeaf = params.minSamplesLeaf || 1;
    this.maxFeatures = params.maxFeatures || 'auto';
    this.bootstrap = params.bootstrap || true;
    this.oobScore = params.oobScore || false;
    this.maxThresholds = params.maxThresholds || 10;
    this.maxNodes = params.maxNodes || 50;
    this.maxBootstrapSamples = params.maxBootstrapSamples || null;
    this.oobScore_ = null;
    this.trees = [];
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
    const numFeatures = X[0].length;

    // 确定每棵树要考虑的特征数量
    const featuresPerTree = this._calculateFeaturesPerTree(numFeatures);

    // 构建多棵决策树
    this.trees = [];
    for (let i = 0; i < this.nEstimators; i++) {
      // 生成 bootstrap 样本
      const { bootstrapX, bootstrapY, oobIndices } = this._generateBootstrapSample(X, y, numSamples);

      // 创建并训练决策树
      const tree = new DecisionTree({
        maxDepth: this.maxDepth,
        minSamplesSplit: this.minSamplesSplit,
        minSamplesLeaf: this.minSamplesLeaf,
        maxFeatures: featuresPerTree,
        maxNodes: this.maxNodes,
        maxThresholds: this.maxThresholds
      });

      tree.fit(bootstrapX, bootstrapY);
      this.trees.push({
        tree,
        oobIndices
      });
    }

    this.isTrained = true;

    // Compute OOB score if requested
    if (this.oobScore) {
      this.oobScore_ = this._computeOOBScore(X, y);
    }
  }

  /**
   * 计算每棵树要考虑的特征数量
   * @param {number} numFeatures - 特征数量
   * @returns {number} - 每棵树要考虑的特征数量
   */
  _calculateFeaturesPerTree(numFeatures) {
    if (typeof this.maxFeatures === 'number') {
      return Math.min(this.maxFeatures, numFeatures);
    } else if (this.maxFeatures === 'auto' || this.maxFeatures === 'sqrt') {
      return Math.sqrt(numFeatures);
    } else if (this.maxFeatures === 'log2') {
      return Math.max(1, Math.floor(Math.log2(numFeatures)));
    } else {
      return numFeatures;
    }
  }

  /**
   * 生成 bootstrap 样本
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   * @param {number} numSamples - 样本数量
   * @returns {Object} - bootstrap 样本和 OOB 索引
   */
  _generateBootstrapSample(X, y, numSamples) {
    const bootstrapX = [];
    const bootstrapY = [];
    const selectedIndices = new Set();
    const sampleSize = Math.min(numSamples, this.maxBootstrapSamples || numSamples);

    for (let i = 0; i < sampleSize; i++) {
      const index = Math.floor(Math.random() * numSamples);
      bootstrapX.push(X[index]);
      bootstrapY.push(y[index]);
      selectedIndices.add(index);
    }

    // 计算 OOB 索引
    const oobIndices = [];
    for (let i = 0; i < numSamples; i++) {
      if (!selectedIndices.has(i)) {
        oobIndices.push(i);
      }
    }

    return { bootstrapX, bootstrapY, oobIndices };
  }

  /**
   * Compute Out-of-Bag (OOB) score
   * @param {Array} X - Original feature matrix
   * @param {Array} y - Original target values
   * @returns {number} - OOB R² score
   */
  _computeOOBScore(X, y) {
    const numSamples = X.length;
    const oobPredictions = new Array(numSamples).fill(null);
    const oobCounts = new Array(numSamples).fill(0);

    // For each tree, predict OOB samples
    for (const { tree, oobIndices } of this.trees) {
      for (const idx of oobIndices) {
        const pred = tree._predictSingle(X[idx], tree.root);
        if (oobPredictions[idx] === null) {
          oobPredictions[idx] = pred;
        } else {
          oobPredictions[idx] += pred;
        }
        oobCounts[idx]++;
      }
    }

    // Average OOB predictions
    const validPredictions = [];
    const validActuals = [];
    for (let i = 0; i < numSamples; i++) {
      if (oobCounts[i] > 0) {
        validPredictions.push(oobPredictions[i] / oobCounts[i]);
        validActuals.push(y[i]);
      }
    }

    if (validPredictions.length === 0) return 0;

    // Calculate R²
    const yMean = validActuals.reduce((sum, v) => sum + v, 0) / validActuals.length;
    const ssRes = validActuals.reduce((sum, v, i) => sum + Math.pow(v - validPredictions[i], 2), 0);
    const ssTot = validActuals.reduce((sum, v) => sum + Math.pow(v - yMean, 2), 0);

    return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  }

  /**
   * 预测单个样本
   * @param {Array} instance - 单个样本
   * @returns {number} - 预测值
   */
  _predictSingle(instance) {
    const predictions = this.trees.map(({ tree }) => tree._predictSingle(instance, tree.root));
    return this._aggregatePredictions(predictions);
  }

  /**
   * 聚合多个树的预测结果
   * @param {Array} predictions - 各树的预测结果
   * @returns {number} - 聚合后的预测值
   */
  _aggregatePredictions(predictions) {
    // 回归问题使用均值
    return predictions.reduce((sum, val) => sum + val, 0) / predictions.length;
  }

  /**
   * 预测
   * @param {Array} X - 特征矩阵
   * @returns {Array|number} - 预测结果
   */
  predict(X) {
    if (!this.isTrained || this.trees.length === 0) {
      throw new Error('Model not trained');
    }

    if (!Array.isArray(X[0])) {
      return this._predictSingle(X);
    }

    return X.map(instance => this._predictSingle(instance));
  }

  /**
   * 获取特征重要性
   * @returns {Array} - 特征重要性
   */
  getFeatureImportance() {
    if (this.trees.length === 0) {
      return [];
    }

    // 从第一棵树获取特征数量
    const numFeatures = this.trees[0].tree.numFeatures || 0;
    if (numFeatures === 0) return [];

    // 初始化全长的重要性数组
    const importances = new Array(numFeatures).fill(0);

    // 累加所有树的重要性
    for (const { tree } of this.trees) {
      const treeImportance = tree.getFeatureImportance();
      // 防御性：只累加有效范围内的重要性
      const len = Math.min(treeImportance.length, numFeatures);
      for (let i = 0; i < len; i++) {
        importances[i] += treeImportance[i];
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
    if (this.trees.length === 0) {
      return [];
    }

    // 聚合所有树的特征贡献
    const contributions = [];
    const firstTreeContribution = this.trees[0].tree.calculateFeatureContributions(instance);

    // 初始化贡献数组
    for (let i = 0; i < firstTreeContribution.length; i++) {
      contributions.push(0);
    }

    // 累加所有树的贡献
    for (const { tree } of this.trees) {
      const treeContribution = tree.calculateFeatureContributions(instance);
      for (let i = 0; i < treeContribution.length; i++) {
        contributions[i] += treeContribution[i];
      }
    }

    // 归一化
    const totalContribution = contributions.reduce((sum, val) => sum + val, 0);
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
    if (this.trees.length === 0) {
      return 0.5;
    }

    // 计算各树预测的一致性
    const predictions = this.trees.map(({ tree }) => tree._predictSingle(instance, tree.root));
    const mean = this._aggregatePredictions(predictions);
    const variance = predictions.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / predictions.length;
    const stdDev = Math.sqrt(variance);

    // 基于预测的标准差计算置信度
    // 标准差越小，置信度越高
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
    state.trees = this.trees.map(({ tree }) => tree.getState());
    state.oobScore_ = this.oobScore_;
    return state;
  }

  /**
   * 设置模型状态
   * @param {Object} state - 模型状态
   */
  setState(state) {
    super.setState(state);
    this.trees = state.trees.map(treeState => {
      const tree = new DecisionTree({
        maxDepth: this.maxDepth,
        minSamplesSplit: this.minSamplesSplit,
        minSamplesLeaf: this.minSamplesLeaf,
        maxFeatures: this.maxFeatures,
        maxNodes: this.maxNodes,
        maxThresholds: this.maxThresholds
      });
      tree.setState(treeState);
      return { tree, oobIndices: [] };
    });
    this.oobScore_ = state.oobScore_ !== undefined ? state.oobScore_ : null;
  }

  /**
   * 获取各树的预测结果
   * @param {Array} X - 特征矩阵
   * @returns {Array} - 各树的预测结果
   */
  getIndividualTreePredictions(X) {
    if (!this.isTrained || this.trees.length === 0) {
      throw new Error('Model not trained');
    }

    const individualPredictions = [];
    for (let i = 0; i < this.trees.length; i++) {
      const { tree } = this.trees[i];
      individualPredictions.push({
        treeIndex: i,
        predictions: tree.predict(X)
      });
    }

    return individualPredictions;
  }

  /**
   * Get the Out-of-Bag (OOB) score
   * @returns {number|null} - OOB R² score, or null if not computed
   */
  getOOBScore() {
    return this.oobScore_;
  }
}

module.exports = RandomForest;
module.exports.default = RandomForest;