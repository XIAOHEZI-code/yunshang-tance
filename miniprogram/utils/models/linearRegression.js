/**
 * 线性回归模型
 * 基于最小二乘法实现的线性回归
 */
const BaseModel = require('./baseModel.js');

class LinearRegression extends BaseModel {
  constructor(params = {}) {
    super(params);
    this.weights = null;
    this.bias = 0;
    this.learningRate = params.learningRate || 0.01;
    this.epochs = params.epochs || 1000;
    this.tolerance = params.tolerance || 1e-6;
    this.useGradientDescent = params.useGradientDescent || false;
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

    if (this.useGradientDescent) {
      this._fitGradientDescent(X, y, numSamples, numFeatures);
    } else {
      this._fitNormalEquation(X, y, numSamples, numFeatures);
    }

    this.isTrained = true;
  }

  /**
   * 使用梯度下降法训练
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   * @param {number} numSamples - 样本数量
   * @param {number} numFeatures - 特征数量
   */
  _fitGradientDescent(X, y, numSamples, numFeatures) {
    // 初始化权重和偏置
    this.weights = new Array(numFeatures).fill(0);
    this.bias = 0;

    for (let epoch = 0; epoch < this.epochs; epoch++) {
      const weightGradients = new Array(numFeatures).fill(0);
      let biasGradient = 0;

      // 计算梯度
      for (let i = 0; i < numSamples; i++) {
        const prediction = this._predictSingle(X[i]);
        const error = prediction - y[i];

        for (let j = 0; j < numFeatures; j++) {
          weightGradients[j] += (error * X[i][j]) / numSamples;
        }
        biasGradient += error / numSamples;
      }

      // 更新权重和偏置
      let maxChange = 0;
      for (let j = 0; j < numFeatures; j++) {
        const change = this.learningRate * weightGradients[j];
        this.weights[j] -= change;
        maxChange = Math.max(maxChange, Math.abs(change));
      }

      const biasChange = this.learningRate * biasGradient;
      this.bias -= biasChange;
      maxChange = Math.max(maxChange, Math.abs(biasChange));

      // 检查收敛
      if (maxChange < this.tolerance) {
        break;
      }
    }
  }

  /**
   * 使用正规方程训练
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   * @param {number} numSamples - 样本数量
   * @param {number} numFeatures - 特征数量
   */
  _fitNormalEquation(X, y, numSamples, numFeatures) {
    // 添加偏置项 (全为1的列)
    const XWithBias = X.map(row => [1, ...row]);
    const XTranspose = this._transposeMatrix(XWithBias);
    const XTX = this._multiplyMatrices(XTranspose, XWithBias);
    const XTy = this._multiplyMatrixVector(XTranspose, y);

    // 计算逆矩阵
    const XTXInverse = this._invertMatrix(XTX);
    if (!XTXInverse) {
      throw new Error('Matrix is singular, cannot compute inverse');
    }

    // 计算系数
    const coefficients = this._multiplyMatrixVector(XTXInverse, XTy);
    this.bias = coefficients[0];
    this.weights = coefficients.slice(1);
  }

  /**
   * 预测单个样本
   * @param {Array} instance - 单个样本
   * @returns {number} - 预测值
   */
  _predictSingle(instance) {
    if (!this.weights) {
      return this.bias;
    }

    let prediction = this.bias;
    for (let i = 0; i < instance.length; i++) {
      prediction += instance[i] * this.weights[i];
    }
    return prediction;
  }

  /**
   * 预测
   * @param {Array} X - 特征矩阵
   * @returns {Array} - 预测结果
   */
  predict(X) {
    if (!this.isTrained) {
      throw new Error('Model not trained');
    }

    return X.map(instance => this._predictSingle(instance));
  }

  /**
   * 获取特征重要性
   * @returns {Array} - 特征重要性
   */
  getFeatureImportance() {
    if (!this.weights) {
      return [];
    }

    // 使用权重的绝对值作为重要性
    const importances = this.weights.map(Math.abs);
    const sum = importances.reduce((acc, val) => acc + val, 0);

    // 归一化
    if (sum > 0) {
      return importances.map(imp => imp / sum);
    }

    return importances;
  }

  /**
   * 计算特征贡献
   * @param {Array} instance - 单个样本
   * @returns {Array} - 特征贡献
   */
  calculateFeatureContributions(instance) {
    if (!this.weights) {
      return [];
    }

    return instance.map((value, index) => value * this.weights[index]);
  }

  /**
   * 计算预测置信度
   * @param {Array} instance - 单个样本
   * @returns {number} - 置信度
   */
  calculateConfidence(instance) {
    // 简单实现：基于特征值的范围和权重的稳定性
    if (!this.weights) {
      return 0.5;
    }

    const weightsSum = this.weights.reduce((acc, val) => acc + Math.abs(val), 0);
    const instanceSum = instance.reduce((acc, val) => acc + Math.abs(val), 0);

    if (weightsSum === 0 || instanceSum === 0) {
      return 0.5;
    }

    // 计算标准化的置信度
    const confidence = 1 / (1 + Math.exp(-0.1 * weightsSum * instanceSum));
    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * 获取模型状态
   * @returns {Object} - 模型状态
   */
  getState() {
    const state = super.getState();
    state.weights = this.weights;
    state.bias = this.bias;
    return state;
  }

  /**
   * 设置模型状态
   * @param {Object} state - 模型状态
   */
  setState(state) {
    super.setState(state);
    this.weights = state.weights;
    this.bias = state.bias;
  }

  /**
   * 矩阵转置
   * @param {Array} matrix - 输入矩阵
   * @returns {Array} - 转置后的矩阵
   */
  _transposeMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const transposed = Array(cols).fill().map(() => Array(rows).fill(0));

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        transposed[j][i] = matrix[i][j];
      }
    }

    return transposed;
  }

  /**
   * 矩阵乘法
   * @param {Array} matrix1 - 第一个矩阵
   * @param {Array} matrix2 - 第二个矩阵
   * @returns {Array} - 乘积矩阵
   */
  _multiplyMatrices(matrix1, matrix2) {
    const rows1 = matrix1.length;
    const cols1 = matrix1[0].length;
    const cols2 = matrix2[0].length;
    const result = Array(rows1).fill().map(() => Array(cols2).fill(0));

    for (let i = 0; i < rows1; i++) {
      for (let j = 0; j < cols2; j++) {
        for (let k = 0; k < cols1; k++) {
          result[i][j] += matrix1[i][k] * matrix2[k][j];
        }
      }
    }

    return result;
  }

  /**
   * 矩阵与向量乘法
   * @param {Array} matrix - 矩阵
   * @param {Array} vector - 向量
   * @returns {Array} - 乘积向量
   */
  _multiplyMatrixVector(matrix, vector) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const result = Array(rows).fill(0);

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        result[i] += matrix[i][j] * vector[j];
      }
    }

    return result;
  }

  /**
   * 矩阵求逆
   * @param {Array} matrix - 输入矩阵
   * @returns {Array|null} - 逆矩阵或null（如果不可逆）
   */
  _invertMatrix(matrix) {
    const n = matrix.length;
    const augmented = Array(n).fill().map(() => Array(2 * n).fill(0));

    // 构建增广矩阵 [A | I]
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        augmented[i][j] = matrix[i][j];
      }
      augmented[i][i + n] = 1;
    }

    // 高斯-约旦消元
    for (let i = 0; i < n; i++) {
      // 寻找主元素
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }

      // 交换行
      if (maxRow !== i) {
        [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      }

      // 检查主元素是否为零
      if (Math.abs(augmented[i][i]) < 1e-10) {
        return null; // 矩阵不可逆
      }

      // 归一化主行
      const pivot = augmented[i][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }

      // 消去其他行
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }

    // 提取逆矩阵
    const inverse = Array(n).fill().map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        inverse[i][j] = augmented[i][j + n];
      }
    }

    return inverse;
  }
}

module.exports = LinearRegression;
module.exports.default = LinearRegression;