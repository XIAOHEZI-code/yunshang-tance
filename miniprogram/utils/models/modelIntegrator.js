/**
 * 模型集成器
 * 负责管理多个模型并组合它们的预测结果
 */
const BaseModel = require('./baseModel.js');
const modelFactory = require('./modelFactory.js');

class ModelIntegrator extends BaseModel {
  constructor(params = {}) {
    super(params);
    this.models = [];
    this.modelWeights = [];
    this.integrationMethod = params.integrationMethod || 'weightedAverage';
    this.modelsMeta = [];
    this.metaModel = null; // Meta-learner for stacking
  }

  /**
   * 添加模型
   * @param {string|BaseModel} model - 模型名称或模型实例
   * @param {Object} modelParams - 模型参数
   * @param {number} weight - 模型权重
   */
  addModel(model, modelParams = {}, weight = 1.0) {
    let modelInstance;
    let modelName;

    if (model instanceof BaseModel) {
      modelInstance = model;
      modelName = model.constructor.name;
    } else if (typeof model === 'string') {
      modelName = model;
      modelInstance = modelFactory.createModel(model, modelParams);
    } else {
      throw new Error('Model must be either a model name string or a BaseModel instance');
    }

    this.models.push(modelInstance);
    this.modelWeights.push(weight);
    this.modelsMeta.push({
      name: modelName,
      params: modelParams,
      weight: weight
    });
  }

  /**
   * 设置模型权重
   * @param {Array} weights - 模型权重数组
   */
  setModelWeights(weights) {
    if (weights.length !== this.models.length) {
      throw new Error('Weights array length must match models array length');
    }
    this.modelWeights = weights;
  }

  /**
   * 设置集成方法
   * @param {string} method - 集成方法 ('weightedAverage', 'majorityVote', 'stacking')
   */
  setIntegrationMethod(method) {
    const validMethods = ['weightedAverage', 'majorityVote', 'stacking'];
    if (!validMethods.includes(method)) {
      throw new Error(`Invalid integration method. Valid methods are: ${validMethods.join(', ')}`);
    }
    this.integrationMethod = method;
  }

  /**
   * 训练所有模型
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   */
  fit(X, y) {
    // Train all base models
    for (const model of this.models) {
      model.fit(X, y);
    }

    // If using stacking, train the meta-learner
    if (this.integrationMethod === 'stacking') {
      this._trainMetaModel(X, y);
    }

    this.isTrained = true;
  }

  /**
   * Train the meta-learner for stacking
   * @param {Array} X - Original feature matrix
   * @param {Array} y - Target values
   */
  _trainMetaModel(X, y) {
    // Generate meta-features: each base model's predictions on training data
    const metaFeatures = [];
    for (let i = 0; i < X.length; i++) {
      const metaRow = [];
      for (const model of this.models) {
        // Predict for single sample
        const pred = model.predict([X[i]])[0];
        metaRow.push(pred);
      }
      metaFeatures.push(metaRow);
    }

    // Use simple linear regression as meta-learner
    // Solve: metaFeatures * w = y  using normal equation
    const n = metaFeatures.length;
    const m = metaFeatures[0].length;

    // Compute X^T X
    const XTX = [];
    for (let i = 0; i < m; i++) {
      XTX[i] = [];
      for (let j = 0; j < m; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += metaFeatures[k][i] * metaFeatures[k][j];
        }
        XTX[i][j] = sum;
      }
      // Add small regularization for numerical stability
      XTX[i][i] += 1e-8;
    }

    // Compute X^T y
    const XTy = [];
    for (let i = 0; i < m; i++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += metaFeatures[k][i] * y[k];
      }
      XTy[i] = sum;
    }

    // Solve linear system using Gaussian elimination
    const augmented = [];
    for (let i = 0; i < m; i++) {
      augmented[i] = [...XTX[i], XTy[i]];
    }

    // Gaussian elimination
    for (let i = 0; i < m; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < m; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      const pivot = augmented[i][i];
      if (Math.abs(pivot) < 1e-10) continue; // Skip singular

      for (let j = i; j <= m; j++) {
        augmented[i][j] /= pivot;
      }

      for (let k = 0; k < m; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = i; j <= m; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }

    // Extract weights and bias
    this.metaWeights = augmented.map(row => row[m]);
    this.metaBias = 0; // We already include bias implicitly via regularization
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

    const predictions = [];
    for (const model of this.models) {
      predictions.push(model.predict(X));
    }

    return this._integratePredictions(predictions);
  }

  /**
   * 集成预测结果
   * @param {Array} predictions - 各模型的预测结果
   * @returns {Array} - 集成后的预测结果
   */
  _integratePredictions(predictions) {
    if (predictions.length === 0) {
      return [];
    }

    const numSamples = predictions[0].length;
    const integratedPredictions = [];

    for (let i = 0; i < numSamples; i++) {
      let integratedValue;

      switch (this.integrationMethod) {
        case 'weightedAverage':
          integratedValue = this._weightedAverage(predictions, i);
          break;
        case 'majorityVote':
          integratedValue = this._majorityVote(predictions, i);
          break;
        case 'stacking':
          integratedValue = this._stacking(predictions, i);
          break;
        default:
          integratedValue = this._weightedAverage(predictions, i);
      }

      integratedPredictions.push(integratedValue);
    }

    return integratedPredictions;
  }

  /**
   * 加权平均集成
   * @param {Array} predictions - 各模型的预测结果
   * @param {number} sampleIndex - 样本索引
   * @returns {number} - 集成后的预测值
   */
  _weightedAverage(predictions, sampleIndex) {
    let weightedSum = 0;
    let weightSum = 0;

    for (let j = 0; j < predictions.length; j++) {
      weightedSum += predictions[j][sampleIndex] * this.modelWeights[j];
      weightSum += this.modelWeights[j];
    }

    return weightSum > 0 ? weightedSum / weightSum : 0;
  }

  /**
   * 多数投票集成
   * @param {Array} predictions - 各模型的预测结果
   * @param {number} sampleIndex - 样本索引
   * @returns {number} - 集成后的预测值
   */
  _majorityVote(predictions, sampleIndex) {
    const votes = new Map();

    for (const pred of predictions) {
      const value = Math.round(pred[sampleIndex]);
      votes.set(value, (votes.get(value) || 0) + 1);
    }

    let maxVote = 0;
    let majorityValue = 0;

    for (const [value, count] of votes.entries()) {
      if (count > maxVote) {
        maxVote = count;
        majorityValue = value;
      }
    }

    return majorityValue;
  }

  /**
   * 堆叠集成（简单实现）
   * @param {Array} predictions - 各模型的预测结果
   * @param {number} sampleIndex - 样本索引
   * @returns {number} - 集成后的预测值
   */
  _stacking(predictions, sampleIndex) {
    if (!this.metaWeights || this.metaWeights.length === 0) {
      // Fallback to weighted average if meta-model not trained
      return this._weightedAverage(predictions, sampleIndex);
    }

    // Meta-learner prediction: weighted sum of base model predictions
    let metaPrediction = 0;
    for (let j = 0; j < predictions.length; j++) {
      metaPrediction += predictions[j][sampleIndex] * (this.metaWeights[j] || 0);
    }
    return metaPrediction + this.metaBias;
  }

  /**
   * 获取各模型的预测结果
   * @param {Array} X - 特征矩阵
   * @returns {Array} - 各模型的预测结果
   */
  getIndividualPredictions(X) {
    if (!this.isTrained) {
      throw new Error('Model not trained');
    }

    const individualPredictions = [];
    for (let i = 0; i < this.models.length; i++) {
      individualPredictions.push({
        model: this.modelsMeta[i].name,
        predictions: this.models[i].predict(X)
      });
    }

    return individualPredictions;
  }

  /**
   * 获取模型状态
   * @returns {Object} - 模型状态
   */
  getState() {
    const state = super.getState();
    state.models = this.models.map(model => model.getState());
    state.modelWeights = this.modelWeights;
    state.modelsMeta = this.modelsMeta;
    state.integrationMethod = this.integrationMethod;
    state.metaWeights = this.metaWeights;
    state.metaBias = this.metaBias;
    return state;
  }

  /**
   * 设置模型状态
   * @param {Object} state - 模型状态
   */
  setState(state) {
    super.setState(state);
    this.modelWeights = state.modelWeights;
    this.modelsMeta = state.modelsMeta;
    this.integrationMethod = state.integrationMethod;
    this.metaWeights = state.metaWeights || null;
    this.metaBias = state.metaBias || 0;

    // 重新创建模型实例
    this.models = [];
    for (let i = 0; i < state.modelsMeta.length; i++) {
      const modelMeta = state.modelsMeta[i];
      const modelInstance = modelFactory.createModel(modelMeta.name, modelMeta.params);
      modelInstance.setState(state.models[i]);
      this.models.push(modelInstance);
    }
  }

  /**
   * 获取集成器信息
   * @returns {Object} - 集成器信息
   */
  getInfo() {
    return {
      integrationMethod: this.integrationMethod,
      models: this.modelsMeta,
      totalModels: this.models.length
    };
  }
}

module.exports = ModelIntegrator;
module.exports.default = ModelIntegrator;