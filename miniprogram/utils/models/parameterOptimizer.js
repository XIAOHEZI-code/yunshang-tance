/**
 * 参数自动调优工具
 * 提供网格搜索和随机搜索功能
 */
const ModelEvaluator = require('./modelEvaluator.js');

class ParameterOptimizer {
  constructor() {
    this.evaluator = new ModelEvaluator();
  }

  /**
   * 网格搜索
   * @param {BaseModel} model - 要调优的模型
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   * @param {Object} paramGrid - 参数网格
   * @param {number} cv - 交叉验证折数
   * @param {string} scoring - 评分指标
   * @param {number} n_jobs - 并行任务数（暂不支持）
   * @returns {Object} - 调优结果
   */
  gridSearch(model, X, y, paramGrid, cv = 5, scoring = 'r2', n_jobs = 1) {
    // 生成参数组合
    const paramCombinations = this._generateParamCombinations(paramGrid);
    return this._search(model, X, y, paramCombinations, cv, scoring);
  }

  /**
   * 随机搜索
   * @param {BaseModel} model - 要调优的模型
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   * @param {Object} paramDistributions - 参数分布
   * @param {number} nIter - 迭代次数
   * @param {number} cv - 交叉验证折数
   * @param {string} scoring - 评分指标
   * @returns {Object} - 调优结果
   */
  randomSearch(model, X, y, paramDistributions, nIter = 10, cv = 5, scoring = 'r2') {
    // 生成随机参数组合
    const paramCombinations = this._generateRandomParamCombinations(paramDistributions, nIter);
    return this._search(model, X, y, paramCombinations, cv, scoring);
  }

  /**
   * 执行搜索
   * @param {BaseModel} model - 要调优的模型
   * @param {Array} X - 特征矩阵
   * @param {Array} y - 目标变量
   * @param {Array} paramCombinations - 参数组合列表
   * @param {number} cv - 交叉验证折数
   * @param {string} scoring - 评分指标
   * @returns {Object} - 调优结果
   */
  _search(model, X, y, paramCombinations, cv, scoring) {
    let bestScore = scoring === 'r2' ? -Infinity : Infinity;
    let bestParams = null;
    let bestModel = null;
    const results = [];

    for (const params of paramCombinations) {
      try {
        // 创建模型实例
        const modelInstance = new model.constructor(params);

        // 交叉验证
        const cvResults = this.evaluator.crossValidate(modelInstance, X, y, cv, [scoring]);
        const meanScore = cvResults[scoring];

        // 存储结果
        results.push({
          params,
          score: meanScore,
          std: cvResults[`${scoring}_std`]
        });

        // 更新最佳结果
        if (this._isBetterScore(meanScore, bestScore, scoring)) {
          bestScore = meanScore;
          bestParams = params;

          // 训练最佳模型
          bestModel = new model.constructor(params);
          bestModel.fit(X, y);
        }
      } catch (error) {
        console.error(`Error with params ${JSON.stringify(params)}:`, error);
        results.push({
          params,
          error: error.message
        });
      }
    }

    return {
      bestParams,
      bestScore,
      bestModel,
      results
    };
  }

  /**
   * 生成参数组合
   * @param {Object} paramGrid - 参数网格
   * @returns {Array} - 参数组合列表
   */
  _generateParamCombinations(paramGrid) {
    const keys = Object.keys(paramGrid);
    if (keys.length === 0) {
      return [{}];
    }

    const firstKey = keys[0];
    const remainingKeys = keys.slice(1);
    const firstValues = paramGrid[firstKey];

    if (remainingKeys.length === 0) {
      return firstValues.map(value => ({ [firstKey]: value }));
    }

    const remainingCombinations = this._generateParamCombinations(
      remainingKeys.reduce((obj, key) => {
        obj[key] = paramGrid[key];
        return obj;
      }, {})
    );

    const combinations = [];
    for (const value of firstValues) {
      for (const combo of remainingCombinations) {
        combinations.push({
          [firstKey]: value,
          ...combo
        });
      }
    }

    return combinations;
  }

  /**
   * 生成随机参数组合
   * @param {Object} paramDistributions - 参数分布
   * @param {number} nIter - 迭代次数
   * @returns {Array} - 参数组合列表
   */
  _generateRandomParamCombinations(paramDistributions, nIter) {
    const combinations = [];
    const keys = Object.keys(paramDistributions);

    for (let i = 0; i < nIter; i++) {
      const params = {};
      for (const key of keys) {
        const distribution = paramDistributions[key];
        params[key] = this._sampleFromDistribution(distribution);
      }
      combinations.push(params);
    }

    return combinations;
  }

  /**
   * 从分布中采样
   * @param {Array|Function} distribution - 分布
   * @returns {*} - 采样值
   */
  _sampleFromDistribution(distribution) {
    if (Array.isArray(distribution)) {
      // 从数组中随机选择
      return distribution[Math.floor(Math.random() * distribution.length)];
    } else if (typeof distribution === 'function') {
      // 调用函数生成值
      return distribution();
    } else if (distribution.type === 'uniform') {
      // 均匀分布
      const { min, max } = distribution;
      return min + Math.random() * (max - min);
    } else if (distribution.type === 'int') {
      // 整数分布
      const { min, max } = distribution;
      return Math.floor(min + Math.random() * (max - min + 1));
    } else if (distribution.type === 'loguniform') {
      // 对数均匀分布
      const { min, max } = distribution;
      const logMin = Math.log(min);
      const logMax = Math.log(max);
      return Math.exp(logMin + Math.random() * (logMax - logMin));
    } else {
      // 默认返回原值
      return distribution;
    }
  }

  /**
   * 检查是否是更好的分数
   * @param {number} newScore - 新分数
   * @param {number} bestScore - 当前最佳分数
   * @param {string} scoring - 评分指标
   * @returns {boolean} - 是否更好
   */
  _isBetterScore(newScore, bestScore, scoring) {
    // 对于r2和准确度等指标，分数越高越好
    if (['r2', 'accuracy', 'precision', 'recall', 'f1'].includes(scoring)) {
      return newScore > bestScore;
    }
    // 对于mse、rmse、mae等指标，分数越低越好
    else if (['mse', 'rmse', 'mae', 'mape'].includes(scoring)) {
      return newScore < bestScore;
    }
    return false;
  }
}

module.exports = ParameterOptimizer;
module.exports.default = ParameterOptimizer;