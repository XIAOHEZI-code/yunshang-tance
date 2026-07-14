// customPreprocess.js - 自定义数据预处理方案

const { detectOutliers, selectFeatures, standardizeFeatures } = require('./analysisApi');

/**
 * 自定义数据预处理方案
 * 提供更灵活的数据预处理选项，支持用户自定义处理流程
 */

/**
 * 自定义数据预处理函数
 * @param {Array} data - 原始数据集
 * @param {Object} options - 预处理选项
 * @param {string} options.targetColumn - 目标列名
 * @param {boolean} options.removeOutliers - 是否移除异常值
 * @param {boolean} options.featureSelection - 是否进行特征选择
 * @param {boolean} options.standardize - 是否进行特征标准化
 * @param {Object} options.outlierOptions - 异常值检测选项
 * @param {Object} options.selectionOptions - 特征选择选项
 * @param {Object} options.standardizeOptions - 特征标准化选项
 * @returns {Object} - 预处理结果
 */
function customPreprocess(data, options = {}) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    const {
      targetColumn = 'target',
      removeOutliers = true,
      featureSelection = true,
      standardize = true,
      outlierOptions = {},
      selectionOptions = {},
      standardizeOptions = {}
    } = options;

    let processedData = [...data];
    const results = {
      originalData: data,
      steps: []
    };

    // 步骤1: 异常值检测和处理
    if (removeOutliers) {
      const outlierResult = detectOutliersWithOptions(processedData, targetColumn, outlierOptions);
      processedData = processedData.filter((_, idx) => !outlierResult.outlierIndices.includes(idx));

      results.outlierResult = outlierResult;
      results.cleanedData = processedData;
      results.steps.push({
        type: 'outlier_removal',
        originalCount: data.length,
        cleanedCount: processedData.length,
        removedCount: data.length - processedData.length
      });
    }

    // 步骤2: 特征选择
    if (featureSelection) {
      const selectionResult = selectFeaturesWithOptions(processedData, targetColumn, selectionOptions);
      results.selectedFeatures = selectionResult.selectedFeatures;
      results.featureScores = selectionResult.featureScores;

      results.steps.push({
        type: 'feature_selection',
        selectedFeatures: selectionResult.selectedFeatures.length,
        totalFeatures: selectionResult.originalFeatures.length
      });
    }

    // 步骤3: 特征标准化
    if (standardize && results.selectedFeatures && results.selectedFeatures.length > 0) {
      const standardizeResult = standardizeFeaturesWithOptions(processedData, results.selectedFeatures, standardizeOptions);
      results.standardizedData = standardizeResult.standardizedData;
      results.standardizationStats = standardizeResult.stats;

      results.steps.push({
        type: 'feature_standardization',
        standardizedFeatures: results.selectedFeatures.length
      });
    }

    return results;
  } catch (error) {
    console.error('自定义数据预处理失败:', error);
    throw new Error('自定义数据预处理失败: ' + error.message);
  }
}

/**
 * 带选项的异常值检测
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @param {Object} options - 异常值检测选项
 * @param {string} options.method - 异常值检测方法: 'rf' (随机森林) 或 'iqr' (四分位距)
 * @param {number} options.threshold - 异常值阈值
 * @returns {Object} - 异常值检测结果
 */

function detectOutliersWithOptions(data, targetColumn, options = {}) {
  const { method = 'rf', threshold = 3 } = options;

  if (method === 'iqr') {
    return detectOutliersUsingIQR(data, targetColumn, threshold);
  } else {
    // 默认使用随机森林方法
    return detectOutliers(data, targetColumn);
  }
}

/**
 * 使用四分位距(IQR)检测异常值
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @param {number} threshold - 异常值阈值
 * @returns {Object} - 异常值检测结果
 */
function detectOutliersUsingIQR(data, targetColumn, threshold = 3) {
  const values = data.map(row => row[targetColumn]).filter(val => !isNaN(val));
  const sortedValues = [...values].sort((a, b) => a - b);
  const n = sortedValues.length;

  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sortedValues[q1Index];
  const q3 = sortedValues[q3Index];
  const iqr = q3 - q1;
  const lowerBound = q1 - threshold * iqr;
  const upperBound = q3 + threshold * iqr;

  const outlierIndices = [];
  data.forEach((row, idx) => {
    const value = row[targetColumn];
    if (!isNaN(value) && (value < lowerBound || value > upperBound)) {
      outlierIndices.push(idx);
    }
  });

  return {
    outlierIndices,
    outlierCount: outlierIndices.length,
    outlierPercentage: ((outlierIndices.length / data.length) * 100).toFixed(2),
    lowerBound: lowerBound.toFixed(4),
    upperBound: upperBound.toFixed(4),
    iqr: iqr.toFixed(4),
    method: 'iqr'
  };
}

/**
 * 带选项的特征选择
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @param {Object} options - 特征选择选项
 * @param {string} options.method - 特征选择方法: 'importance', 'correlation', 'permutation'
 * @param {string|number} options.threshold - 选择阈值
 * @returns {Object} - 特征选择结果
 */
function selectFeaturesWithOptions(data, targetColumn, options = {}) {
  const { method = 'importance', threshold = 'mean' } = options;

  return selectFeatures(data, targetColumn, method, threshold);
}

/**
 * 带选项的特征标准化
 * @param {Array} data - 数据集
 * @param {Array} featureColumns - 要标准化的特征列
 * @param {Object} options - 特征标准化选项
 * @param {string} options.method - 标准化方法: 'zscore' (Z-score) 或 'minmax' (Min-Max)
 * @returns {Object} - 标准化结果
 */
function standardizeFeaturesWithOptions(data, featureColumns, options = {}) {
  const { method = 'zscore' } = options;

  if (method === 'minmax') {
    return standardizeFeaturesMinMax(data, featureColumns);
  } else {
    // 默认使用Z-score标准化
    return standardizeFeatures(data, featureColumns);
  }
}

/**
 * Min-Max标准化
 * @param {Array} data - 数据集
 * @param {Array} featureColumns - 要标准化的特征列
 * @returns {Object} - 标准化结果
 */
function standardizeFeaturesMinMax(data, featureColumns) {
  // 计算每个特征的最小值和最大值
  const stats = {};
  featureColumns.forEach(col => {
    const values = data.map(row => row[col]);
    stats[col] = {
      min: Math.min(...values),
      max: Math.max(...values),
      range: Math.max(...values) - Math.min(...values)
    };
  });

  // 标准化数据
  const standardizedData = data.map(row => {
    const standardized = { ...row };
    featureColumns.forEach(col => {
      const { min, max, range } = stats[col];
      standardized[col] = range !== 0 ? (row[col] - min) / range : 0;
    });
    return standardized;
  });

  return {
    standardizedData,
    stats,
    featureColumns,
    method: 'minmax'
  };
}

/**
 * 批量数据预处理
 * @param {Array} datasets - 数据集数组
 * @param {Object} options - 预处理选项
 * @returns {Array} - 预处理结果数组
 */
function batchPreprocess(datasets, options = {}) {
  return datasets.map((data, index) => {
    try {
      const result = customPreprocess(data, options);
      return {
        index,
        success: true,
        result
      };
    } catch (error) {
      return {
        index,
        success: false,
        error: error.message
      };
    }
  });
}

/**
 * 预处理配置生成器
 * @param {Object} config - 用户配置
 * @returns {Object} - 预处理选项
 */
function generatePreprocessConfig(config = {}) {
  return {
    targetColumn: config.targetColumn || 'target',
    removeOutliers: config.removeOutliers !== false,
    featureSelection: config.featureSelection !== false,
    standardize: config.standardize !== false,
    outlierOptions: {
      method: config.outlierMethod || 'rf',
      threshold: config.outlierThreshold || 3
    },
    selectionOptions: {
      method: config.selectionMethod || 'importance',
      threshold: config.selectionThreshold || 'mean'
    },
    standardizeOptions: {
      method: config.standardizeMethod || 'zscore'
    }
  };
}

/**
 * 预处理结果评估
 * @param {Object} preprocessResult - 预处理结果
 * @returns {Object} - 评估结果
 */
function evaluatePreprocessResult(preprocessResult) {
  const { originalData, cleanedData, selectedFeatures } = preprocessResult;

  const evaluation = {
    dataQuality: {
      originalRows: originalData.length,
      cleanedRows: cleanedData ? cleanedData.length : originalData.length,
      rowReduction: cleanedData ? ((originalData.length - cleanedData.length) / originalData.length * 100).toFixed(2) : '0.00',
      featureCount: selectedFeatures ? selectedFeatures.length : Object.keys(originalData[0]).length - 1
    },
    processingEfficiency: {
      steps: preprocessResult.steps ? preprocessResult.steps.length : 0,
      hasOutlierRemoval: !!preprocessResult.outlierResult,
      hasFeatureSelection: !!selectedFeatures,
      hasStandardization: !!preprocessResult.standardizedData
    },
    recommendations: []
  };

  // 生成建议
  if (evaluation.dataQuality.rowReduction > 30) {
    evaluation.recommendations.push({
      type: 'warning',
      message: '异常值移除比例过高，可能导致数据信息丢失'
    });
  }

  if (selectedFeatures && selectedFeatures.length === 0) {
    evaluation.recommendations.push({
      type: 'error',
      message: '特征选择结果为空，请调整选择参数'
    });
  }

  return evaluation;
}

module.exports = {
  customPreprocess,
  batchPreprocess,
  generatePreprocessConfig,
  evaluatePreprocessResult
};
