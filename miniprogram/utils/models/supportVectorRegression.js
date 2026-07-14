/**
 * 支持向量回归模型
 * 基于支持向量机的回归算法
 */
const BaseModel = require('./baseModel.js');

class SupportVectorRegression extends BaseModel {
  constructor(params = {}) {
    super(params);
    this.C = params.C || 1.0;
    this.epsilon = params.epsilon || 0.1;
    this.kernel = params.kernel || 'rbf'; // linear, poly, rbf
    this.gamma = params.gamma || 'auto'; // 核函数参数
    this.degree = params.degree || 3; // 多项式核函数的次数
    this.coef0 = params.coef0 || 0.0; // 多项式核函数的常数项
    this.tol = params.tol || 1e-3;
    this.maxIter = params.maxIter || -1; // -1 表示无限制
    this.alphas = null;
    this.supportVectors = null;
    this.supportVectorLabels = null;
    this.bias = 0;
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

    // 初始化参数
    if (this.gamma === 'auto') {
      this.gamma = 1.0 / numFeatures;
    }

    // 使用primal epsilon-SVR（子梯度下降）进行训练
    this._fitPrimalSVR(X, y, numSamples, numFeatures);

    this.isTrained = true;
  }

  /**
   * 使用子梯度下降实现primal epsilon-SVR
   * 最小化 (1/2)||w||² + C * Σ max(0, |y_i - w·x_i - b| - epsilon)
   * 对于非线性核，使用表示定理在α空间中优化
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   * @param {number} numSamples - 样本数量
   * @param {number} numFeatures - 特征数量
   */
  _fitPrimalSVR(X, y, numSamples, numFeatures) {
    const maxIter = this.maxIter > 0 ? this.maxIter : 1000;
    const tol = 1e-4;
    let lr = 0.01;
    const decay = 0.999;
    const C = this.C;
    const eps = this.epsilon;

    if (this.kernel === 'linear') {
      this._fitLinearPrimal(X, y, numSamples, numFeatures, maxIter, tol, lr, decay, C, eps);
    } else {
      this._fitKernelPrimal(X, y, numSamples, numFeatures, maxIter, tol, lr, decay, C, eps);
    }
  }

  /**
   * 线性核SVR：直接在w,b原空间中用子梯度下降
   */
  _fitLinearPrimal(X, y, numSamples, numFeatures, maxIter, tol, lr, decay, C, eps) {
    let w = new Array(numFeatures).fill(0);
    let b = 0;

    for (let iter = 0; iter < maxIter; iter++) {
      const residuals = new Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        let pred = b;
        for (let j = 0; j < numFeatures; j++) {
          pred += w[j] * X[i][j];
        }
        residuals[i] = y[i] - pred;
      }

      const lossGrads = new Array(numSamples).fill(0);
      for (let i = 0; i < numSamples; i++) {
        if (residuals[i] > eps) {
          lossGrads[i] = -1;
        } else if (residuals[i] < -eps) {
          lossGrads[i] = 1;
        }
      }

      const gradW = new Array(numFeatures);
      let gradNormSq = 0;
      for (let j = 0; j < numFeatures; j++) {
        gradW[j] = w[j];
        for (let i = 0; i < numSamples; i++) {
          gradW[j] += C * lossGrads[i] * X[i][j];
        }
        gradNormSq += gradW[j] * gradW[j];
      }

      let gradB = 0;
      for (let i = 0; i < numSamples; i++) {
        gradB += C * lossGrads[i];
      }
      gradNormSq += gradB * gradB;

      for (let j = 0; j < numFeatures; j++) {
        w[j] -= lr * gradW[j];
      }
      b -= lr * gradB;
      lr *= decay;

      if (Math.sqrt(gradNormSq) < tol) {
        break;
      }
    }

    this.weights = w;
    this.bias = b;

    const svIndices = [];
    for (let i = 0; i < numSamples; i++) {
      let pred = b;
      for (let j = 0; j < numFeatures; j++) {
        pred += w[j] * X[i][j];
      }
      const residual = y[i] - pred;
      if (Math.abs(residual) > eps) {
        svIndices.push(i);
      }
    }

    if (svIndices.length === 0) {
      this.alphas = new Array(numSamples).fill(C);
      this.supportVectors = X;
      this.supportVectorLabels = y;
      return;
    }

    this.alphas = svIndices.map(() => C);
    this.supportVectors = svIndices.map(i => X[i]);
    this.supportVectorLabels = svIndices.map(i => y[i]);
  }

  /**
   * 非线性核SVR：使用表示定理在α空间中用子梯度下降
   * f(x) = Σ α_j * K(x_j, x) + b
   */
  _fitKernelPrimal(X, y, numSamples, numFeatures, maxIter, tol, lr, decay, C, eps) {
    const kernelFn = this.kernel === 'rbf'
      ? (a, b) => this._kernelRBF(a, b)
      : (a, b) => this._kernelPoly(a, b);

    const K = new Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      K[i] = new Array(numSamples);
      for (let j = 0; j < numSamples; j++) {
        K[i][j] = kernelFn(X[i], X[j]);
      }
    }

    let alphas = new Array(numSamples).fill(0);
    let b = 0;

    for (let iter = 0; iter < maxIter; iter++) {
      const yPred = new Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        let pred = b;
        for (let j = 0; j < numSamples; j++) {
          pred += alphas[j] * K[i][j];
        }
        yPred[i] = pred;
      }

      const residuals = new Array(numSamples);
      const lossGrads = new Array(numSamples).fill(0);
      for (let i = 0; i < numSamples; i++) {
        residuals[i] = y[i] - yPred[i];
        if (residuals[i] > eps) {
          lossGrads[i] = -1;
        } else if (residuals[i] < -eps) {
          lossGrads[i] = 1;
        }
      }

      const gradAlphas = new Array(numSamples);
      let gradNormSq = 0;
      for (let j = 0; j < numSamples; j++) {
        gradAlphas[j] = alphas[j];
        for (let i = 0; i < numSamples; i++) {
          gradAlphas[j] += C * lossGrads[i] * K[i][j];
        }
        gradNormSq += gradAlphas[j] * gradAlphas[j];
      }

      let gradB = 0;
      for (let i = 0; i < numSamples; i++) {
        gradB += C * lossGrads[i];
      }
      gradNormSq += gradB * gradB;

      for (let j = 0; j < numSamples; j++) {
        alphas[j] -= lr * gradAlphas[j];
      }
      b -= lr * gradB;
      lr *= decay;

      if (Math.sqrt(gradNormSq) < tol) {
        break;
      }
    }

    this.bias = b;

    const svIndices = [];
    for (let i = 0; i < numSamples; i++) {
      if (Math.abs(alphas[i]) > this.tol) {
        svIndices.push(i);
      }
    }

    if (svIndices.length === 0) {
      this.alphas = new Array(numSamples).fill(0);
      this.supportVectors = X;
      this.supportVectorLabels = new Array(numSamples).fill(1);
      return;
    }

    this.alphas = svIndices.map(i => Math.abs(alphas[i]));
    this.supportVectorLabels = svIndices.map(i => alphas[i] >= 0 ? 1 : -1);
    this.supportVectors = svIndices.map(i => X[i]);
  }

  /**
   * 预测单个样本（线性核）
   * @param {Array} instance - 单个样本
   * @param {Array} weights - 权重向量
   * @returns {number} - 预测值
   */
  _predictLinear(instance, weights) {
    let prediction = 0;
    for (let i = 0; i < instance.length; i++) {
      prediction += instance[i] * weights[i];
    }
    return prediction;
  }

  /**
   * 预测单个样本
   * @param {Array} instance - 单个样本
   * @returns {number} - 预测值
   */
  _predictSingle(instance) {
    if (this.kernel === 'linear') {
      // 线性核预测：使用岭回归权重
      let prediction = this.bias;
      for (let i = 0; i < instance.length; i++) {
        prediction += instance[i] * (this.weights ? this.weights[i] : 0);
      }
      return prediction;
    } else if (this.kernel === 'rbf') {
      // RBF核预测
      let prediction = 0;
      for (let i = 0; i < this.supportVectors.length; i++) {
        if (this.alphas[i] > this.tol) {
          prediction += this.alphas[i] * this.supportVectorLabels[i] * this._kernelRBF(instance, this.supportVectors[i]);
        }
      }
      return prediction + this.bias;
    } else if (this.kernel === 'poly') {
      // 多项式核预测
      let prediction = 0;
      for (let i = 0; i < this.supportVectors.length; i++) {
        if (this.alphas[i] > this.tol) {
          prediction += this.alphas[i] * this.supportVectorLabels[i] * this._kernelPoly(instance, this.supportVectors[i]);
        }
      }
      return prediction + this.bias;
    }
    return 0;
  }

  /**
   * 线性核函数
   * @param {Array} x1 - 第一个样本
   * @param {Array} x2 - 第二个样本
   * @returns {number} - 核函数值
   */
  _kernelLinear(x1, x2) {
    let result = 0;
    for (let i = 0; i < x1.length; i++) {
      result += x1[i] * x2[i];
    }
    return result;
  }

  /**
   * RBF核函数
   * @param {Array} x1 - 第一个样本
   * @param {Array} x2 - 第二个样本
   * @returns {number} - 核函数值
   */
  _kernelRBF(x1, x2) {
    let squaredDistance = 0;
    for (let i = 0; i < x1.length; i++) {
      squaredDistance += Math.pow(x1[i] - x2[i], 2);
    }
    return Math.exp(-this.gamma * squaredDistance);
  }

  /**
   * 多项式核函数
   * @param {Array} x1 - 第一个样本
   * @param {Array} x2 - 第二个样本
   * @returns {number} - 核函数值
   */
  _kernelPoly(x1, x2) {
    let dotProduct = 0;
    for (let i = 0; i < x1.length; i++) {
      dotProduct += x1[i] * x2[i];
    }
    return Math.pow(this.gamma * dotProduct + this.coef0, this.degree);
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
    if (!this.supportVectors || this.supportVectors.length === 0) {
      return [];
    }

    const numFeatures = this.supportVectors[0].length;
    const importances = new Array(numFeatures).fill(0);

    // 对于线性核，使用权重的绝对值作为重要性
    if (this.kernel === 'linear' && this.alphas) {
      for (let i = 0; i < this.supportVectors.length; i++) {
        if (this.alphas[i] > this.tol) {
          for (let j = 0; j < numFeatures; j++) {
            importances[j] += Math.abs(this.alphas[i] * this.supportVectorLabels[i] * this.supportVectors[i][j]);
          }
        }
      }
    } else {
      // 对于非线性核，使用支持向量的特征方差作为重要性
      for (let j = 0; j < numFeatures; j++) {
        const featureValues = this.supportVectors.map(vector => vector[j]);
        const mean = featureValues.reduce((sum, val) => sum + val, 0) / featureValues.length;
        const variance = featureValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / featureValues.length;
        importances[j] = variance;
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
    if (!this.supportVectors || this.supportVectors.length === 0) {
      return [];
    }

    const numFeatures = instance.length;
    const contributions = new Array(numFeatures).fill(0);

    // 对于线性核，计算每个特征的贡献
    if (this.kernel === 'linear' && this.alphas) {
      for (let i = 0; i < this.supportVectors.length; i++) {
        if (this.alphas[i] > this.tol) {
          for (let j = 0; j < numFeatures; j++) {
            contributions[j] += this.alphas[i] * this.supportVectorLabels[i] * this.supportVectors[i][j];
          }
        }
      }
    } else {
      // 对于非线性核，使用特征值的变化对预测的影响作为贡献
      const basePrediction = this._predictSingle(instance);
      for (let j = 0; j < numFeatures; j++) {
        const perturbedInstance = [...instance];
        perturbedInstance[j] += 0.1; // 小扰动
        const perturbedPrediction = this._predictSingle(perturbedInstance);
        contributions[j] = perturbedPrediction - basePrediction;
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
    if (!this.supportVectors || this.supportVectors.length === 0) {
      return 0.5;
    }

    // 计算样本到支持向量的距离
    let minDistance = Infinity;
    for (const vector of this.supportVectors) {
      const distance = this._calculateEuclideanDistance(instance, vector);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    // 基于距离计算置信度
    // 距离越小，置信度越高
    const maxPossibleDistance = 100; // 假设最大可能距离
    const normalizedDistance = Math.min(minDistance / maxPossibleDistance, 1);
    return 1 - normalizedDistance;
  }

  /**
   * 计算欧几里得距离
   * @param {Array} x1 - 第一个样本
   * @param {Array} x2 - 第二个样本
   * @returns {number} - 距离
   */
  _calculateEuclideanDistance(x1, x2) {
    let squaredDistance = 0;
    for (let i = 0; i < x1.length; i++) {
      squaredDistance += Math.pow(x1[i] - x2[i], 2);
    }
    return Math.sqrt(squaredDistance);
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
   * 解线性方程组
   * @param {Array} A - 系数矩阵
   * @param {Array} b - 右端向量
   * @returns {Array} - 解向量
   */
  _solveLinearSystem(A, b) {
    const n = A.length;
    const augmented = Array(n).fill().map(() => Array(n + 1).fill(0));

    // 构建增广矩阵
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        augmented[i][j] = A[i][j];
      }
      augmented[i][n] = b[i];
    }

    // 高斯消元
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

      // 归一化主行
      const pivot = augmented[i][i];
      if (Math.abs(pivot) < 1e-10) {
        throw new Error('Matrix is singular');
      }

      for (let j = i; j <= n; j++) {
        augmented[i][j] /= pivot;
      }

      // 消去其他行
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = i; j <= n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }

    // 提取解
    const solution = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      solution[i] = augmented[i][n];
    }

    return solution;
  }

  /**
   * 获取模型状态
   * @returns {Object} - 模型状态
   */
  getState() {
    const state = super.getState();
    state.alphas = this.alphas;
    state.supportVectors = this.supportVectors;
    state.supportVectorLabels = this.supportVectorLabels;
    state.bias = this.bias;
    state.weights = this.weights;
    return state;
  }

  /**
   * 设置模型状态
   * @param {Object} state - 模型状态
   */
  setState(state) {
    super.setState(state);
    this.alphas = state.alphas;
    this.supportVectors = state.supportVectors;
    this.supportVectorLabels = state.supportVectorLabels;
    this.bias = state.bias;
    this.weights = state.weights;
  }
}

module.exports = SupportVectorRegression;
module.exports.default = SupportVectorRegression;