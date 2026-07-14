/**
 * ============================================
 *  统一算法 API  -  冶金高炉过程数据分析系统
 * ============================================
 * 
 * 已修复：ES6 import → CommonJS require，兼容微信小程序
 * 
 * 使用方式:
 *   const api = require('/api/index');
 *   const stats = api.statistics.numericalStats(data);
 *   const model = api.models.create('linearRegression');
 */

// ============ 导入所有算法模块（CommonJS） ============

const analysisApi = require('../utils/analysisApi.js');
const customPreprocess = require('../utils/customPreprocess');
const ModelFactory = require('../utils/models/modelFactory.js');
const ModelEvaluator = require('../utils/models/modelEvaluator.js');
const ModelIntegrator = require('../utils/models/modelIntegrator.js');
const ParameterOptimizer = require('../utils/models/parameterOptimizer.js');

// 兼容 default 导出
const _ModelFactory = ModelFactory.default || ModelFactory;
const _ModelEvaluator = ModelEvaluator.default || ModelEvaluator;
const _ModelIntegrator = ModelIntegrator.default || ModelIntegrator;
const _ParameterOptimizer = ParameterOptimizer.default || ParameterOptimizer;

// ============ 工具函数 ============

/**
 * 统一的错误处理包装器
 */
function wrapWithErrorHandler(fn, name) {
  return function(...args) {
    try {
      const result = fn.apply(this, args);
      return { success: true, data: result, error: null };
    } catch (error) {
      console.error(`[API Error] ${name}:`, error.message);
      return { success: false, data: null, error: error.message };
    }
  };
}

/**
 * 创建模拟数据集用于测试
 */
function createSampleData(rows = 10, cols = 4) {
  const data = [];
  for (let i = 0; i < rows; i++) {
    const row = { id: i + 1 };
    for (let j = 1; j <= cols; j++) {
      row[`feature${j}`] = parseFloat((1.0 + i * 0.3 + Math.random() * 0.1).toFixed(4));
    }
    row['target'] = parseFloat((10.0 + i * 0.7 + Math.random() * 0.2).toFixed(4));
    data.push(row);
  }
  return data;
}

// ============ API 对象定义 ============

const api = {

  // ========================================
  // 1. 统计信息
  // ========================================
  statistics: {
    basicInfo: wrapWithErrorHandler(analysisApi.getBasicInfo, 'basicInfo'),
    numericalStats: wrapWithErrorHandler(analysisApi.getNumericalStats, 'numericalStats'),
    missingStats: wrapWithErrorHandler(analysisApi.getMissingStats, 'missingStats'),
    categoricalStats: wrapWithErrorHandler(analysisApi.getCategoricalStats, 'categoricalStats'),
  },

  // ========================================
  // 2. 数据质量
  // ========================================
  quality: {
    detectOutliers: wrapWithErrorHandler(
      (data, targetColumn = 'productivity') => analysisApi.detectOutliers(data, targetColumn),
      'detectOutliers'
    ),
  },

  // ========================================
  // 3. 特征分析
  // ========================================
  features: {
    importance: wrapWithErrorHandler(
      (data, targetColumn = 'productivity') => analysisApi.getFeatureImportance(data, targetColumn),
      'featureImportance'
    ),
    permutationImportance: wrapWithErrorHandler(
      (data, targetColumn = 'productivity', nRepeats = 10) => 
        analysisApi.calculatePermutationImportance(data, targetColumn, nRepeats),
      'permutationImportance'
    ),
    correlation: wrapWithErrorHandler(
      (data, targetColumn = 'productivity') => analysisApi.getCorrelationAnalysis(data, targetColumn),
      'correlation'
    ),
    selectFeatures: wrapWithErrorHandler(
      (data, targetColumn = 'productivity', method = 'importance', threshold = 'mean') =>
        analysisApi.selectFeatures(data, targetColumn, method, threshold),
      'selectFeatures'
    ),
    marginalEffect: wrapWithErrorHandler(
      (data, targetColumn = 'productivity', features = []) =>
        analysisApi.getMarginalEffectAnalysis(data, targetColumn, features),
      'marginalEffect'
    ),
  },

  // ========================================
  // 4. 分组分析
  // ========================================
  grouping: {
    parameterGroup: wrapWithErrorHandler(
      (data, targetColumn = 'productivity', groupColumns = ['Oxygen-enriched', 'injection speed', 'Injection temperature']) =>
        analysisApi.getParameterGroupAnalysis(data, targetColumn, groupColumns),
      'parameterGroup'
    ),
    detailedParameterGroup: wrapWithErrorHandler(
      (data, targetColumn = 'productivity', groupColumns = ['Oxygen-enriched', 'injection speed', 'Injection temperature', 'HIR', 'BR']) =>
        analysisApi.getDetailedParameterGroupAnalysis(data, targetColumn, groupColumns),
      'detailedParameterGroup'
    ),
  },

  // ========================================
  // 5. 数据预处理
  // ========================================
  preprocess: {
    standard: wrapWithErrorHandler(
      (data, targetColumn = 'productivity') => analysisApi.preprocessData(data, targetColumn),
      'preprocessData'
    ),
    standardize: wrapWithErrorHandler(
      (data, featureColumns) => analysisApi.standardizeFeatures(data, featureColumns),
      'standardize'
    ),
    custom: wrapWithErrorHandler(
      (data, options = {}) => customPreprocess.customPreprocess(data, options),
      'customPreprocess'
    ),
    batch: wrapWithErrorHandler(
      (datasets, options = {}) => customPreprocess.batchPreprocess(datasets, options),
      'batchPreprocess'
    ),
    generateConfig: wrapWithErrorHandler(
      (config = {}) => customPreprocess.generatePreprocessConfig(config),
      'generatePreprocessConfig'
    ),
    evaluateResult: wrapWithErrorHandler(
      (result) => customPreprocess.evaluatePreprocessResult(result),
      'evaluatePreprocessResult'
    ),
  },

  // ========================================
  // 6. 机器学习模型
  // ========================================
  models: {
    list() {
      try {
        const models = _ModelFactory.getAvailableModels();
        return { success: true, data: models, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    },
    isAvailable(modelName) {
      try {
        const result = _ModelFactory.isModelAvailable(modelName);
        return { success: true, data: result, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    },
    create(modelName, params = {}) {
      try {
        const model = _ModelFactory.createModel(modelName, params);
        return { success: true, data: model, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    },
    train(model, X, y) {
      try {
        model.fit(X, y);
        return { success: true, data: { isTrained: model.isTrained }, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    },
    predict(model, X) {
      try {
        const predictions = model.predict(X);
        return { success: true, data: predictions, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    },
    getFeatureImportance(model) {
      try {
        const importance = model.getFeatureImportance();
        return { success: true, data: importance, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    },
    calculateContributions(model, instance) {
      try {
        const contributions = model.calculateFeatureContributions(instance);
        return { success: true, data: contributions, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    },
    confidence(model, instance) {
      try {
        const conf = model.calculateConfidence(instance);
        return { success: true, data: conf, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    },
    save(model) {
      try {
        const state = model.getState();
        return { success: true, data: state, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    },
    load(model, state) {
      try {
        model.setState(state);
        return { success: true, data: null, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    },
  },

  // ========================================
  // 7. 模型评估
  // ========================================
  evaluation: {
    evaluate: wrapWithErrorHandler(
      (model, X, y, metrics = ['mse', 'rmse', 'r2']) => {
        const evaluator = new (_ModelEvaluator.default || _ModelEvaluator)();
        return evaluator.evaluate(model, X, y, metrics);
      },
      'evaluate'
    ),
    crossValidate: wrapWithErrorHandler(
      (model, X, y, cv = 5, metrics = ['mse', 'rmse', 'r2']) => {
        const evaluator = new (_ModelEvaluator.default || _ModelEvaluator)();
        return evaluator.crossValidate(model, X, y, cv, metrics);
      },
      'crossValidate'
    ),
    compare: wrapWithErrorHandler(
      (models, X, y, cv = 5, metrics = ['mse', 'rmse', 'r2']) => {
        const evaluator = new (_ModelEvaluator.default || _ModelEvaluator)();
        return evaluator.compareModels(models, X, y, cv, metrics);
      },
      'compareModels'
    ),
  },

  // ========================================
  // 8. 超参数优化
  // ========================================
  optimization: {
    gridSearch: wrapWithErrorHandler(
      (model, X, y, paramGrid, cv = 5, scoring = 'r2') => {
        const optimizer = new (_ParameterOptimizer.default || _ParameterOptimizer)();
        return optimizer.gridSearch(model, X, y, paramGrid, cv, scoring);
      },
      'gridSearch'
    ),
    randomSearch: wrapWithErrorHandler(
      (model, X, y, paramDistributions, nIter = 10, cv = 5, scoring = 'r2') => {
        const optimizer = new (_ParameterOptimizer.default || _ParameterOptimizer)();
        return optimizer.randomSearch(model, X, y, paramDistributions, nIter, cv, scoring);
      },
      'randomSearch'
    ),
    suggestions: wrapWithErrorHandler(
      (data, targetColumn = 'productivity') => 
        analysisApi.generateOptimizationSuggestions(data, targetColumn),
      'optimizationSuggestions'
    ),
  },

  // ========================================
  // 9. 模型集成
  // ========================================
  ensemble: {
    create(params = {}) {
      try {
        const Cls = _ModelIntegrator.default || _ModelIntegrator;
        const integrator = new Cls(params);
        return { success: true, data: integrator, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    },
    fit(integrator, X, y) {
      try {
        integrator.fit(X, y);
        return { success: true, data: { isTrained: integrator.isTrained }, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    },
    predict(integrator, X) {
      try {
        const predictions = integrator.predict(X);
        return { success: true, data: predictions, error: null };
      } catch (error) {
        return { success: false, data: null, error: error.message };
      }
    },
  },

  // ========================================
  // 10. 碳排放核算
  // ========================================
  carbon: {
    calculate: wrapWithErrorHandler(
      (params = {}) => analysisApi.calculateCarbonEmission(params),
      'carbonEmission'
    ),
  },

  // ========================================
  // 11. 多模型预测
  // ========================================
  prediction: {
    multiModel: wrapWithErrorHandler(
      (data, targetColumn = 'productivity', options = {}) =>
        analysisApi.multiModelPrediction(data, targetColumn, options),
      'multiModelPrediction'
    ),
  },

  // ========================================
  // 12. 报告生成
  // ========================================
  reporting: {
    generateReport: wrapWithErrorHandler(
      (data, targetColumn = 'productivity') =>
        analysisApi.generateAnalysisReport(data, targetColumn),
      'generateReport'
    ),
  },

  // ========================================
  // 13. 可用分析类型
  // ========================================
  info: {
    getAnalysisTypes: wrapWithErrorHandler(
      () => analysisApi.getAvailableAnalysisTypes ? analysisApi.getAvailableAnalysisTypes() : [],
      'getAnalysisTypes'
    ),
    getVersion() {
      return {
        success: true,
        data: {
          name: '冶金高炉过程数据分析 - 算法 API',
          version: '1.1.0',
          models: _ModelFactory.getAvailableModels(),
          totalAlgorithms: 28,
        },
        error: null
      };
    },
  },

  // ========================================
  // 14. 工具
  // ========================================
  utils: {
    createSampleData,
    evaluateModel: wrapWithErrorHandler(
      (actual, predicted) => analysisApi.evaluateModel(actual, predicted),
      'evaluateModel'
    ),
  },
};

// CommonJS 导出（微信小程序兼容）
module.exports = api;
module.exports.default = api;
