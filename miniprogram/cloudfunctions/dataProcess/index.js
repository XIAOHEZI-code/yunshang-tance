// dataProcess/index.js - 数据处理云函数

/**
 * 数据处理云函数
 * 用于处理复杂的数据计算和分析任务
 */
exports.main = async(event, context) => {
  try {
    const { action, data, options } = event;

    switch (action) {
      case 'analyzeData':
        return await analyzeData(data, options);
      case 'processCSV':
        return await processCSV(data, options);
      case 'calculateStats':
        return await calculateStats(data, options);
      case 'detectOutliers':
        return await detectOutliers(data, options);
      case 'correlationAnalysis':
        return await correlationAnalysis(data, options);
      case 'featureImportance':
        return await featureImportance(data, options);
      case 'optimization':
        return await optimization(data, options);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Data processing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * 分析数据
 * @param {Array} data - 数据集
 * @param {Object} options - 分析选项
 * @returns {Object} 分析结果
 */
async function analyzeData(data, options) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid data: data must be a non-empty array');
  }

  const analysisType = options.type || 'basic';

  switch (analysisType) {
    case 'basic':
      return {
        success: true,
        result: {
          shape: {
            rows: data.length,
            columns: data.length > 0 ? Object.keys(data[0]).length : 0
          },
          fields: data.length > 0 ? Object.keys(data[0]) : []
        }
      };
    default:
      throw new Error(`Unknown analysis type: ${analysisType}`);
  }
}

/**
 * 处理CSV数据
 * @param {string} csvData - CSV字符串
 * @param {Object} options - 处理选项
 * @returns {Object} 处理结果
 */
async function processCSV(csvData, options) {
  if (!csvData || typeof csvData !== 'string') {
    throw new Error('Invalid CSV data');
  }

  const lines = csvData.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    throw new Error('Empty CSV data');
  }

  // 解析表头
  const headers = lines[0].split(',').map(header => header.trim());

  // 解析数据行
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(value => {
      const trimmed = value.trim();
      const num = parseFloat(trimmed);
      return isNaN(num) ? trimmed : num;
    });

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }

  return {
    success: true,
    result: {
      headers,
      data,
      rowCount: data.length
    }
  };
}

/**
 * 计算统计信息
 * @param {Array} data - 数据集
 * @param {Object} options - 计算选项
 * @returns {Object} 统计结果
 */
async function calculateStats(data, options) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid data: data must be a non-empty array');
  }

  const targetColumn = options.column;
  if (!targetColumn) {
    throw new Error('Target column is required');
  }

  const values = data.map(row => row[targetColumn]).filter(value => typeof value === 'number' && !isNaN(value));
  if (values.length === 0) {
    throw new Error('No valid numerical values found in the specified column');
  }

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const sortedValues = [...values].sort((a, b) => a - b);
  const median = sortedValues[Math.floor(sortedValues.length / 2)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    success: true,
    result: {
      mean,
      median,
      min,
      max,
      stdDev,
      count: values.length
    }
  };
}

/**
 * 检测异常值
 * @param {Array} data - 数据集
 * @param {Object} options - 检测选项
 * @returns {Object} 异常值检测结果
 */
async function detectOutliers(data, options) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid data: data must be a non-empty array');
  }

  const targetColumn = options.column;
  if (!targetColumn) {
    throw new Error('Target column is required');
  }

  const values = data.map(row => row[targetColumn]).filter(value => typeof value === 'number' && !isNaN(value));
  if (values.length === 0) {
    throw new Error('No valid numerical values found in the specified column');
  }

  // 使用IQR方法检测异常值
  const sortedValues = [...values].sort((a, b) => a - b);
  const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
  const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outliers = [];
  const outlierIndices = [];

  values.forEach((value, index) => {
    if (value < lowerBound || value > upperBound) {
      outliers.push(value);
      outlierIndices.push(index);
    }
  });

  return {
    success: true,
    result: {
      outliers,
      outlierIndices,
      lowerBound,
      upperBound,
      outlierCount: outliers.length
    }
  };
}

/**
 * 相关性分析
 * @param {Array} data - 数据集
 * @param {Object} options - 分析选项
 * @returns {Object} 相关性分析结果
 */
async function correlationAnalysis(data, options) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid data: data must be a non-empty array');
  }

  const targetColumn = options.target;
  const featureColumns = options.features || [];

  if (!targetColumn || featureColumns.length === 0) {
    throw new Error('Target column and feature columns are required');
  }

  const correlations = [];

  for (const feature of featureColumns) {
    const targetValues = data.map(row => row[targetColumn]).filter(value => typeof value === 'number' && !isNaN(value));
    const featureValues = data.map(row => row[feature]).filter(value => typeof value === 'number' && !isNaN(value));

    if (targetValues.length > 0 && featureValues.length > 0) {
      const correlation = calculateCorrelation(targetValues, featureValues);
      correlations.push({
        feature,
        correlation
      });
    }
  }

  return {
    success: true,
    result: {
      correlations
    }
  };
}

/**
 * 计算相关系数
 * @param {Array} x - x数组
 * @param {Array} y - y数组
 * @returns {number} 相关系数
 */
function calculateCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  const sumX = x.slice(0, n).reduce((sum, val) => sum + val, 0);
  const sumY = y.slice(0, n).reduce((sum, val) => sum + val, 0);
  const sumXY = x.slice(0, n).reduce((sum, val, i) => sum + val * y[i], 0);
  const sumX2 = x.slice(0, n).reduce((sum, val) => sum + val * val, 0);
  const sumY2 = y.slice(0, n).reduce((sum, val) => sum + val * val, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * 特征重要性分析
 * @param {Array} data - 数据集
 * @param {Object} options - 分析选项
 * @returns {Object} 特征重要性分析结果
 */
async function featureImportance(data, options) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid data: data must be a non-empty array');
  }

  const targetColumn = options.target;
  const featureColumns = options.features || [];

  if (!targetColumn || featureColumns.length === 0) {
    throw new Error('Target column and feature columns are required');
  }

  const importances = [];

  for (const feature of featureColumns) {
    const targetValues = data.map(row => row[targetColumn]).filter(value => typeof value === 'number' && !isNaN(value));
    const featureValues = data.map(row => row[feature]).filter(value => typeof value === 'number' && !isNaN(value));

    if (targetValues.length > 0 && featureValues.length > 0) {
      const correlation = Math.abs(calculateCorrelation(targetValues, featureValues));
      importances.push({
        feature,
        importance: correlation
      });
    }
  }

  // 按重要性排序
  importances.sort((a, b) => b.importance - a.importance);

  return {
    success: true,
    result: {
      featureImportance: importances
    }
  };
}

/**
 * 优化分析
 * @param {Array} data - 数据集
 * @param {Object} options - 优化选项
 * @returns {Object} 优化分析结果
 */
async function optimization(data, options) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid data: data must be a non-empty array');
  }

  const targetColumn = options.target;
  const featureColumns = options.features || [];

  if (!targetColumn || featureColumns.length === 0) {
    throw new Error('Target column and feature columns are required');
  }

  // 获取特征重要性
  const importanceResult = await featureImportance(data, { target: targetColumn, features: featureColumns });
  const importances = importanceResult.result.featureImportance;

  // 选择重要性较高的特征
  const topFeatures = importances.slice(0, 3).map(item => item.feature);

  return {
    success: true,
    result: {
      topFeatures,
      featureImportance: importances
    }
  };
}
