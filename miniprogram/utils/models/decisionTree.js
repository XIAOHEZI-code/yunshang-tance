/**
 * 决策树模型
 * 基于CART算法实现的回归树
 */
const BaseModel = require('./baseModel.js');

class DecisionTree extends BaseModel {
  constructor(params = {}) {
    super(params);
    this.maxDepth = params.maxDepth || 10;
    this.minSamplesSplit = params.minSamplesSplit || 2;
    this.minSamplesLeaf = params.minSamplesLeaf || 1;
    this.maxFeatures = params.maxFeatures || null;
    this.maxThresholds = params.maxThresholds || 10;
    this.maxNodes = params.maxNodes || 100;
    this.root = null;
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
    this.numFeatures = X[0].length;
    this.nodeCount = 0;
    this.root = this._buildTree(X, y, 0);
    this.isTrained = true;
  }

  /**
   * 构建决策树
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   * @param {number} depth - 当前深度
   * @returns {Object} - 树节点
   */
  _buildTree(X, y, depth) {
    const numSamples = X.length;
    const numFeatures = X[0].length;

    // 检查终止条件
    if (depth >= this.maxDepth || numSamples < this.minSamplesSplit || this._isHomogeneous(y) || this.nodeCount >= this.maxNodes) {
      return {
        type: 'leaf',
        value: this._calculateLeafValue(y)
      };
    }

    this.nodeCount++;

    // 选择最佳分裂点
    const bestSplit = this._findBestSplit(X, y, numSamples, numFeatures);

    // 如果无法分裂，返回叶节点
    if (!bestSplit || bestSplit.impurity === 0) {
      return {
        type: 'leaf',
        value: this._calculateLeafValue(y)
      };
    }

    // 分裂数据
    const { leftX, leftY, rightX, rightY } = this._splitData(X, y, bestSplit.featureIndex, bestSplit.threshold);

    // 检查分裂后样本数
    if (leftY.length < this.minSamplesLeaf || rightY.length < this.minSamplesLeaf) {
      return {
        type: 'leaf',
        value: this._calculateLeafValue(y)
      };
    }

    // 递归构建左右子树
    return {
      type: 'node',
      featureIndex: bestSplit.featureIndex,
      threshold: bestSplit.threshold,
      left: this._buildTree(leftX, leftY, depth + 1),
      right: this._buildTree(rightX, rightY, depth + 1)
    };
  }

  /**
   * 寻找最佳分裂点
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   * @param {number} numSamples - 样本数量
   * @param {number} numFeatures - 特征数量
   * @returns {Object|null} - 最佳分裂点
   */
  _findBestSplit(X, y, numSamples, numFeatures) {
    let bestSplit = null;
    let bestImpurity = Infinity;

    // 计算全局均值与方差
    const globalMean = y.reduce((sum, val) => sum + val, 0) / numSamples;
    const globalVariance = y.reduce((sum, val) => sum + Math.pow(val - globalMean, 2), 0) / numSamples;

    // 选择要考虑的特征
    const featuresToConsider = this._selectFeatures(numFeatures);

    for (const featureIndex of featuresToConsider) {
      // 获取该特征的所有可能值
      const featureValues = X.map(instance => instance[featureIndex]);
      const minVal = Math.min(...featureValues);
      const maxVal = Math.max(...featureValues);

      // 如果特征值相同，跳过
      if (minVal === maxVal) continue;

      // 生成分裂候选阈值 (最多 maxThresholds 个)
      const thresholds = [];
      for (let i = 1; i <= this.maxThresholds; i++) {
        thresholds.push(
          minVal + (maxVal - minVal) * (i / (this.maxThresholds + 1))
        );
      }

      for (const threshold of thresholds) {
        let leftSum = 0;
        let leftCount = 0;
        let rightSum = 0;
        let rightCount = 0;

        for (let i = 0; i < numSamples; i++) {
          if (X[i][featureIndex] <= threshold) {
            leftSum += y[i];
            leftCount++;
          } else {
            rightSum += y[i];
            rightCount++;
          }
        }

        // 跳过无效分裂
        if (leftCount === 0 || rightCount === 0) continue;

        const leftMean = leftSum / leftCount;
        const rightMean = rightSum / rightCount;

        const splitVariance = (leftCount * Math.pow(leftMean - globalMean, 2) + rightCount * Math.pow(rightMean - globalMean, 2)) / numSamples;
        let impurity = globalVariance - splitVariance;
        if (impurity < 0) impurity = 0;

        // 更新最佳分裂点
        if (impurity < bestImpurity) {
          bestImpurity = impurity;
          bestSplit = {
            featureIndex,
            threshold,
            impurity
          };
        }
      }
    }

    return bestSplit;
  }

  /**
   * 选择要考虑的特征
   * @param {number} numFeatures - 特征数量
   * @returns {Array} - 要考虑的特征索引
   */
  _selectFeatures(numFeatures) {
    if (this.maxFeatures === null) {
      return Array.from({ length: numFeatures }, (_, i) => i);
    }

    const numFeaturesToConsider = Math.min(this.maxFeatures, numFeatures);
    const features = Array.from({ length: numFeatures }, (_, i) => i);

    // 随机选择特征
    for (let i = features.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [features[i], features[j]] = [features[j], features[i]];
    }

    return features.slice(0, numFeaturesToConsider);
  }

  /**
   * 分裂数据
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   * @param {number} featureIndex - 特征索引
   * @param {number} threshold - 阈值
   * @returns {Object} - 分裂后的数据
   */
  _splitData(X, y, featureIndex, threshold) {
    const leftX = [];
    const leftY = [];
    const rightX = [];
    const rightY = [];

    for (let i = 0; i < X.length; i++) {
      if (X[i][featureIndex] <= threshold) {
        leftX.push(X[i]);
        leftY.push(y[i]);
      } else {
        rightX.push(X[i]);
        rightY.push(y[i]);
      }
    }

    return { leftX, leftY, rightX, rightY };
  }

  /**
   * 计算叶节点值
   * @param {Array} y - 目标变量
   * @returns {number} - 叶节点值
   */
  _calculateLeafValue(y) {
    // 回归树使用均值
    return y.reduce((sum, val) => sum + val, 0) / y.length;
  }

  /**
   * 计算杂质（均方误差）
   * @param {Array} leftY - 左子树目标变量
   * @param {Array} rightY - 右子树目标变量
   * @returns {number} - 杂质值
   */
  _calculateImpurity(leftY, rightY) {
    const leftMSE = this._calculateMSE(leftY);
    const rightMSE = this._calculateMSE(rightY);
    const totalSamples = leftY.length + rightY.length;

    return (leftY.length / totalSamples) * leftMSE + (rightY.length / totalSamples) * rightMSE;
  }

  /**
   * 计算均方误差
   * @param {Array} y - 目标变量
   * @returns {number} - 均方误差
   */
  _calculateMSE(y) {
    const mean = this._calculateLeafValue(y);
    return y.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / y.length;
  }

  /**
   * 检查目标变量是否同质
   * @param {Array} y - 目标变量
   * @returns {boolean} - 是否同质
   */
  _isHomogeneous(y) {
    const firstValue = y[0];
    return y.every(val => val === firstValue);
  }

  /**
   * 预测单个样本
   * @param {Array} instance - 单个样本
   * @param {Object} node - 当前节点
   * @returns {number} - 预测值
   */
  _predictSingle(instance, node) {
    if (node.type === 'leaf') {
      return node.value;
    }

    if (instance[node.featureIndex] <= node.threshold) {
      return this._predictSingle(instance, node.left);
    } else {
      return this._predictSingle(instance, node.right);
    }
  }

  /**
   * 预测
   * @param {Array} X - 特征矩阵
   * @returns {Array|number} - 预测结果
   */
  predict(X) {
    if (!this.isTrained || !this.root) {
      throw new Error('Model not trained');
    }

    if (!Array.isArray(X[0])) {
      return this._predictSingle(X, this.root);
    }

    return X.map(instance => this._predictSingle(instance, this.root));
  }

  /**
   * 获取特征重要性
   * @returns {Array} - 特征重要性
   */
  getFeatureImportance() {
    if (!this.root) {
      return [];
    }

    const numFeatures = this.numFeatures || 0;
    if (numFeatures === 0) return [];

    const importances = new Map();
    this._calculateFeatureImportance(this.root, importances);

    const totalImportance = Array.from(importances.values()).reduce((sum, val) => sum + val, 0);
    if (totalImportance === 0) {
      return new Array(numFeatures).fill(0);
    }

    // 创建全长的特征重要性数组，未使用的特征填充 0
    const result = new Array(numFeatures).fill(0);
    importances.forEach((importance, featureIndex) => {
      if (featureIndex >= 0 && featureIndex < numFeatures) {
        result[featureIndex] = importance / totalImportance;
      }
    });
    return result;
  }

  /**
   * 计算特征重要性
   * @param {Object} node - 当前节点
   * @param {Map} importances - 特征重要性映射
   */
  _calculateFeatureImportance(node, importances) {
    if (node.type === 'node') {
      // 简单实现：使用节点出现次数作为重要性
      const currentImportance = importances.get(node.featureIndex) || 0;
      importances.set(node.featureIndex, currentImportance + 1);

      this._calculateFeatureImportance(node.left, importances);
      this._calculateFeatureImportance(node.right, importances);
    }
  }

  /**
   * 计算特征贡献
   * @param {Array} instance - 单个样本
   * @returns {Array} - 特征贡献
   */
  calculateFeatureContributions(instance) {
    if (!this.root) {
      return [];
    }

    const contributions = new Array(instance.length).fill(0);
    let currentNode = this.root;
    const path = [];

    // 找到样本经过的路径
    while (currentNode.type !== 'leaf') {
      path.push(currentNode);
      if (instance[currentNode.featureIndex] <= currentNode.threshold) {
        currentNode = currentNode.left;
      } else {
        currentNode = currentNode.right;
      }
    }

    // 简单实现：路径上的特征贡献为1，其他为0
    for (const node of path) {
      contributions[node.featureIndex] = 1;
    }

    return contributions;
  }

  /**
   * 计算预测置信度
   * @param {Array} instance - 单个样本
   * @returns {number} - 置信度
   */
  calculateConfidence(instance) {
    if (!this.root) {
      return 0.5;
    }

    // 简单实现：基于路径长度和树深度
    let pathLength = 0;
    let currentNode = this.root;

    while (currentNode.type !== 'leaf') {
      pathLength++;
      if (instance[currentNode.featureIndex] <= currentNode.threshold) {
        currentNode = currentNode.left;
      } else {
        currentNode = currentNode.right;
      }
    }

    // 路径越长，置信度越高
    return Math.min(pathLength / this.maxDepth, 1);
  }

  /**
   * 获取模型状态
   * @returns {Object} - 模型状态
   */
  getState() {
    const state = super.getState();
    state.root = this.root;
    return state;
  }

  /**
   * 设置模型状态
   * @param {Object} state - 模型状态
   */
  setState(state) {
    super.setState(state);
    this.root = state.root;
  }
}

module.exports = DecisionTree;
module.exports.default = DecisionTree;