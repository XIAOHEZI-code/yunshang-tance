// analysisApi.js - Python迁移后的JS分析函数+统一调用接口
const modelFactory = require('./models/modelFactory.js');
const ModelEvaluator = require('./models/modelEvaluator.js');
const ParameterOptimizer = require('./models/parameterOptimizer.js');
const ModelIntegrator = require('./models/modelIntegrator.js');

/**
 * 计算数组的平均值
 * @param {Array} arr - 数值数组
 * @returns {number} - 平均值
 */
function mean(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const sum = arr.reduce((acc, val) => acc + (val || 0), 0);
  return sum / arr.length;
}

/**
 * 计算数组的标准差
 * @param {Array} arr - 数值数组
 * @returns {number} - 标准差
 */
function std(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const avg = mean(arr);
  const squaredDifferences = arr.map((val) => Math.pow((val || 0) - avg, 2));
  const variance = mean(squaredDifferences);
  return Math.sqrt(variance);
}

/**
 * 计算数组的最小值
 * @param {Array} arr - 数值数组
 * @returns {number} - 最小值
 */
function min(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  return Math.min(...arr.map((val) => val || 0));
}

/**
 * 计算数组的最大值
 * @param {Array} arr - 数值数组
 * @returns {number} - 最大值
 */
function max(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  return Math.max(...arr.map((val) => val || 0));
}

/**
 * 数据基本信息概览
 * @param {Array} data - 数据集
 * @returns {Object} - 基本信息
 */
function getBasicInfo(data) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    const columns = Object.keys(data[0]);
    const numericalCols = [];
    const categoricalCols = [];

    // 推断列类型
    columns.forEach((col) => {
      const values = data.map((row) => row[col]);
      const numValues = values.filter(
        (val) => typeof val === 'number' && !isNaN(val)
      );

      if (numValues.length / values.length > 0.8) {
        numericalCols.push(col);
      } else {
        categoricalCols.push(col);
      }
    });

    return {
      shape: { rows: data.length, columns: columns.length },
      columns,
      numericalColumns: numericalCols,
      categoricalColumns: categoricalCols,
      dataTypes: columns.reduce((acc, col) => {
        const sample = data[0][col];
        acc[col] = typeof sample;
        return acc;
      }, {})
    };
  } catch (error) {
    console.error('获取基本信息失败:', error);
    throw new Error('获取基本信息失败: ' + error.message);
  }
}

/**
 * 缺失值统计
 * @param {Array} data - 数据集
 * @returns {Object} - 缺失值统计结果
 */
function getMissingStats(data) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    const columns = Object.keys(data[0]);
    const missingStats = [];

    columns.forEach((col) => {
      const missingCount = data.filter(
        (row) => row[col] === undefined || row[col] === null || row[col] === ''
      ).length;
      const missingPercent = ((missingCount / data.length) * 100).toFixed(2);

      if (missingCount > 0) {
        missingStats.push({
          column: col,
          missingCount,
          missingPercent: parseFloat(missingPercent)
        });
      }
    });

    // 按缺失数量排序
    missingStats.sort((a, b) => b.missingCount - a.missingCount);

    return {
      hasMissingValues: missingStats.length > 0,
      missingStats,
      totalMissingValues: missingStats.reduce(
        (sum, stat) => sum + stat.missingCount,
        0
      )
    };
  } catch (error) {
    console.error('缺失值统计失败:', error);
    throw new Error('缺失值统计失败: ' + error.message);
  }
}

/**
 * 数值数据统计描述
 * @param {Array} data - 数据集
 * @returns {Object} - 统计描述结果
 */
function getNumericalStats(data) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    const columns = Object.keys(data[0]);
    const numericalCols = columns.filter((col) => {
      const sample = data[0][col];
      return typeof sample === 'number';
    });

    const stats = {};
    numericalCols.forEach(col => {
      const values = data.map(row => row[col]).filter(val => !isNaN(val));

      // 必须先排序才能计算分位数
      const sortedValues = [...values].sort((a, b) => a - b);
      const n = sortedValues.length;

      // 正确的分位数计算方法
      const q1Index = Math.floor(n * 0.25);
      const q2Index = Math.floor(n * 0.5);
      const q3Index = Math.floor(n * 0.75);

      stats[col] = {
        count: values.length,
        mean: mean(values).toFixed(4),
        std: std(values).toFixed(4),
        min: min(values).toFixed(4),
        '25%': (sortedValues[q1Index] || 0).toFixed(4),
        '50%': (sortedValues[q2Index] || 0).toFixed(4),
        '75%': (sortedValues[q3Index] || 0).toFixed(4),
        max: max(values).toFixed(4)
      };
    });

    return { numericalColumns: numericalCols, stats };
  } catch (error) {
    console.error('数值统计失败:', error);
    throw new Error('数值统计失败: ' + error.message);
  }
}

/**
 * 分类变量统计
 * @param {Array} data - 数据集
 * @returns {Object} - 分类变量统计结果
 */
function getCategoricalStats(data) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    const columns = Object.keys(data[0]);
    const categoricalCols = columns.filter((col) => {
      const sample = data[0][col];
      return typeof sample === 'string';
    });

    const stats = {};
    categoricalCols.forEach((col) => {
      const valueCounts = {};
      data.forEach((row) => {
        const val = row[col];
        if (val !== undefined && val !== null && val !== '') {
          valueCounts[val] = (valueCounts[val] || 0) + 1;
        }
      });

      // 计算百分比
      const total = Object.values(valueCounts).reduce(
        (sum, count) => sum + count,
        0
      );
      const normalizedCounts = {};
      Object.entries(valueCounts).forEach(([val, count]) => {
        normalizedCounts[val] = {
          count,
          percentage: ((count / total) * 100).toFixed(3)
        };
      });

      stats[col] = {
        uniqueValues: Object.keys(valueCounts).length,
        valueDistribution: normalizedCounts
      };
    });

    return { categoricalColumns: categoricalCols, stats };
  } catch (error) {
    console.error('分类变量统计失败:', error);
    throw new Error('分类变量统计失败: ' + error.message);
  }
}

/**
 * 动态计算随机森林模型参数
 * @param {number} nSamples - 样本数
 * @param {number} nFeatures - 特征数
 * @returns {Object} - 随机森林参数
 */
function _getRandomForestOptions(nSamples, nFeatures) {
  let nEstimators = Math.min(10, Math.max(3, Math.floor(nSamples / 50)));
  let maxDepth = Math.min(5, Math.max(3, Math.floor(Math.log2(nSamples))));
  let maxNodes = 50;

  if (nSamples > 1000) {
    nEstimators = Math.min(nEstimators, 5);
    maxDepth = Math.min(maxDepth, 3);
    maxNodes = 30;
  }

  const maxFeatures = Math.min(Math.ceil(Math.sqrt(nFeatures)), nFeatures);
  const maxThresholds = 10;
  const maxBootstrapSamples = Math.min(nSamples, 500);

  return {
    nEstimators,
    maxDepth,
    maxNodes,
    maxFeatures,
    maxThresholds,
    maxBootstrapSamples
  };
}

/**
 * 异常值检测
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @returns {Object} - 异常值检测结果
 */
function detectOutliers(data, targetColumn = 'productivity') {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    // 分离特征和目标变量
    const X = data.map((row) => {
      const features = { ...row };
      delete features[targetColumn];
      return Object.values(features);
    });
    const y = data.map((row) => row[targetColumn]);

    // 训练随机森林模型
    const nSamples = X.length;
    const nFeatures = X[0].length;
    const options = _getRandomForestOptions(nSamples, nFeatures);
    const rf = modelFactory.createModel('randomForest', options);
    rf.fit(X, y);

    // 预测并计算残差
    const yPred = rf.predict(X);
    const residuals = y.map((actual, idx) => Math.abs(actual - yPred[idx]));

    // 基于3σ准则识别异常值
    const stdResidual = std(residuals);
    const meanResidual = mean(residuals);
    const outlierThreshold = meanResidual + 3 * stdResidual;
    const outliers = residuals.map((res) => res > outlierThreshold);

    const outlierIndices = outliers
      .map((isOutlier, idx) => (isOutlier ? idx : -1))
      .filter((idx) => idx !== -1);

    return {
      residualStats: {
        mean: meanResidual.toFixed(4),
        std: stdResidual.toFixed(4),
        threshold: outlierThreshold.toFixed(4)
      },
      outlierCount: outlierIndices.length,
      outlierPercentage: ((outlierIndices.length / data.length) * 100).toFixed(
        2
      ),
      outlierIndices,
      outliers: data.filter((_, idx) => outliers[idx]),
      residuals // 添加残差数组，以便前端绘图
    };
  } catch (error) {
    console.error('异常值检测失败:', error);
    throw new Error('异常值检测失败: ' + error.message);
  }
}

/**
 * 计算排列重要性
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @param {number} nRepeats - 重复次数
 * @returns {Object} - 排列重要性结果
 */
function calculatePermutationImportance(
  data,
  targetColumn = 'productivity',
  nRepeats = 10
) {
  try {
    // 分离特征和目标变量
    const columns = Object.keys(data[0]);
    const featureColumns = columns.filter((col) => col !== targetColumn);

    const X = data.map((row) => {
      const features = { ...row };
      delete features[targetColumn];
      return Object.values(features);
    });
    const y = data.map((row) => row[targetColumn]);

    // 训练基础模型
    const nSamples = X.length;
    const nFeatures = X[0].length;
    const options = _getRandomForestOptions(nSamples, nFeatures);
    const rf = modelFactory.createModel('randomForest', options);
    rf.fit(X, y);

    // 计算基准性能
    const baselinePredictions = rf.predict(X);
    const baselineMSE = y.reduce((acc, val, idx) => {
      const diff = val - baselinePredictions[idx];
      return acc + diff * diff;
    }, 0) / y.length;

    // 计算每个特征的排列重要性
    const permutationImportances = featureColumns.map(
      (feature, featureIndex) => {
        let importanceSum = 0;
        const importanceScores = [];

        for (let i = 0; i < nRepeats; i++) {
          // 复制数据并打乱当前特征
          const XPermuted = X.map((row) => [...row]);
          const featureValues = XPermuted.map((row) => row[featureIndex]);

          // 打乱特征值
          for (let j = featureValues.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [featureValues[j], featureValues[k]] = [
              featureValues[k],
              featureValues[j]
            ];
          }

          // 将打乱的值放回
          XPermuted.forEach((row, idx) => {
            row[featureIndex] = featureValues[idx];
          });

          // 计算打乱后的性能
          const permutedPredictions = rf.predict(XPermuted);
          const permutedMSE = y.reduce((acc, val, idx) => {
            const diff = val - permutedPredictions[idx];
            return acc + diff * diff;
          }, 0) / y.length;

          // 重要性为性能下降
          const importance = permutedMSE - baselineMSE;
          importanceSum += importance;
          importanceScores.push(importance);
        }

        return {
          feature: feature,
          importance: importanceSum / nRepeats,
          std: std(importanceScores),
          scores: importanceScores
        };
      }
    );

    // 排序
    permutationImportances.sort((a, b) => b.importance - a.importance);

    return permutationImportances;
  } catch (error) {
    console.error('计算排列重要性失败:', error);
    throw new Error('计算排列重要性失败: ' + error.message);
  }
}

/**
 * 特征重要性分析
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @returns {Object} - 特征重要性结果
 */
function getFeatureImportance(data, targetColumn = 'productivity') {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    const columns = Object.keys(data[0]);
    const featureColumns = columns.filter((col) => col !== targetColumn);

    // 1. 基于相关性的特征重要性
    const correlationImportances = featureColumns.map((col) => {
      const featureValues = data.map((row) => row[col]);
      const targetValues = data.map((row) => row[targetColumn]);

      const featureMean = mean(featureValues);
      const targetMean = mean(targetValues);

      let numerator = 0;
      let denominator1 = 0;
      let denominator2 = 0;

      for (let i = 0; i < data.length; i++) {
        const fDiff = featureValues[i] - featureMean;
        const tDiff = targetValues[i] - targetMean;
        numerator += fDiff * tDiff;
        denominator1 += fDiff * fDiff;
        denominator2 += tDiff * tDiff;
      }

      const correlation =
        numerator / (Math.sqrt(denominator1 * denominator2) || 1);

      return {
        feature: col,
        importance: Math.abs(correlation),
        method: 'correlation'
      };
    });

    // 2. 排列重要性
    let permutationImportances = [];
    try {
      permutationImportances = calculatePermutationImportance(
        data,
        targetColumn
      );
    } catch (error) {
      console.warn('排列重要性计算失败，仅使用相关性重要性:', error);
    }

    // 3. 综合重要性
    const combinedImportances = featureColumns.map((feature) => {
      const corrImportance =
        correlationImportances.find((item) => item.feature === feature)
          ?.importance || 0;
      const permImportance =
        permutationImportances.find((item) => item.feature === feature)
          ?.importance || 0;

      // 归一化排列重要性
      const maxPermImportance = Math.max(
        ...permutationImportances.map((item) => item.importance),
        1
      );
      const normalizedPermImportance = permImportance / maxPermImportance;

      // 综合得分
      const combinedScore = (corrImportance + normalizedPermImportance) / 2;

      return {
        feature: feature,
        importance: combinedScore,
        correlationImportance: corrImportance,
        permutationImportance: normalizedPermImportance
      };
    });

    // 排序
    combinedImportances.sort((a, b) => b.importance - a.importance);

    // 选择重要特征
    const meanImportance = mean(
      combinedImportances.map((item) => item.importance)
    );
    const selectedFeatures = combinedImportances
      .filter((item) => item.importance >= meanImportance)
      .map((item) => item.feature);

    return {
      featureImportance: combinedImportances,
      correlationImportance: correlationImportances,
      permutationImportance: permutationImportances,
      selectedFeatures: selectedFeatures,
      meanImportance: meanImportance
    };
  } catch (error) {
    console.error('特征重要性分析失败:', error);
    throw new Error('特征重要性分析失败: ' + error.message);
  }
}

/**
 * 特征标准化
 * @param {Array} data - 数据集
 * @param {Array} featureColumns - 要标准化的特征列
 * @returns {Object} - 标准化结果
 */
function standardizeFeatures(data, featureColumns) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    if (!Array.isArray(featureColumns) || featureColumns.length === 0) {
      throw new Error('特征列列表为空');
    }

    // 计算每个特征的均值和标准差
    const stats = {};
    featureColumns.forEach((col) => {
      const values = data.map((row) => row[col]);
      stats[col] = {
        mean: mean(values),
        std: std(values)
      };
    });

    // 标准化数据
    const standardizedData = data.map((row) => {
      const standardized = { ...row };
      featureColumns.forEach((col) => {
        const { mean, std } = stats[col];
        standardized[col] = std !== 0 ? (row[col] - mean) / std : 0;
      });
      return standardized;
    });

    return {
      standardizedData,
      stats,
      featureColumns
    };
  } catch (error) {
    console.error('特征标准化失败:', error);
    throw new Error('特征标准化失败: ' + error.message);
  }
}

/**
 * 特征选择
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @param {string} method - 选择方法: 'importance', 'correlation', 'permutation'
 * @param {number} threshold - 选择阈值
 * @returns {Object} - 特征选择结果
 */
function selectFeatures(
  data,
  targetColumn = 'productivity',
  method = 'importance',
  threshold = 'mean'
) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    const columns = Object.keys(data[0]);
    const featureColumns = columns.filter((col) => col !== targetColumn);

    let selectedFeatures = [];
    let featureScores = [];

    switch (method) {
      case 'importance':
        {
          const importanceResult = getFeatureImportance(data, targetColumn);
          featureScores = importanceResult.featureImportance;

          if (threshold === 'mean') {
            const meanScore = importanceResult.meanImportance;
            selectedFeatures = featureScores
              .filter((item) => item.importance >= meanScore)
              .map((item) => item.feature);
          } else if (typeof threshold === 'number') {
            selectedFeatures = featureScores
              .filter((item) => item.importance >= threshold)
              .map((item) => item.feature);
          } else {
            // 默认选择前3个重要特征
            selectedFeatures = featureScores
              .slice(0, 3)
              .map((item) => item.feature);
          }
        }
        break;

      case 'correlation':
        {
          const correlationResult = getCorrelationAnalysis(data, targetColumn);
          featureScores = correlationResult.correlations.map((item) => ({
            feature: item.feature,
            importance: Math.abs(parseFloat(item.correlation))
          }));

          if (threshold === 'mean') {
            const meanScore = mean(featureScores.map((item) => item.importance));
            selectedFeatures = featureScores
              .filter((item) => item.importance >= meanScore)
              .map((item) => item.feature);
          } else if (typeof threshold === 'number') {
            selectedFeatures = featureScores
              .filter((item) => item.importance >= threshold)
              .map((item) => item.feature);
          } else {
            // 默认选择前3个相关特征
            selectedFeatures = featureScores
              .slice(0, 3)
              .map((item) => item.feature);
          }
        }
        break;

      case 'permutation':
        {
          const permutationResult = calculatePermutationImportance(data, targetColumn);
          featureScores = permutationResult;

          if (threshold === 'mean') {
            const meanScore = mean(featureScores.map((item) => item.importance));
            selectedFeatures = featureScores
              .filter((item) => item.importance >= meanScore)
              .map((item) => item.feature);
          } else if (typeof threshold === 'number') {
            selectedFeatures = featureScores
              .filter((item) => item.importance >= threshold)
              .map((item) => item.feature);
          } else {
            // 默认选择前3个重要特征
            selectedFeatures = featureScores
              .slice(0, 3)
              .map((item) => item.feature);
          }
        }
        break;

      default:
        throw new Error(`未知的特征选择方法: ${method}`);
    }

    return {
      selectedFeatures,
      featureScores,
      method,
      threshold,
      originalFeatures: featureColumns
    };
  } catch (error) {
    console.error('特征选择失败:', error);
    throw new Error('特征选择失败: ' + error.message);
  }
}

/**
 * 完整的数据预处理流水线
 * @param {Array} data - 原始数据集
 * @param {string} targetColumn - 目标列名
 * @returns {Object} - 预处理结果
 */
function preprocessData(data, targetColumn = 'productivity') {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    // 步骤1: 异常值检测和处理
    const outlierResult = detectOutliers(data, targetColumn);
    const cleanedData = data.filter((_, idx) => !outlierResult.outlierIndices.includes(idx));

    // 步骤2: 特征选择
    const selectionResult = selectFeatures(cleanedData, targetColumn, 'importance');

    // 步骤3: 特征标准化
    const standardizeResult = standardizeFeatures(cleanedData, selectionResult.selectedFeatures);

    return {
      originalData: data,
      cleanedData,
      standardizedData: standardizeResult.standardizedData,
      selectedFeatures: selectionResult.selectedFeatures,
      outlierResult,
      featureScores: selectionResult.featureScores,
      standardizationStats: standardizeResult.stats
    };
  } catch (error) {
    console.error('数据预处理失败:', error);
    throw new Error('数据预处理失败: ' + error.message);
  }
}

/**
 * 数据分析统一调用接口
 * @param {Array} data - 数据集
 * @param {string} analysisType - 分析类型
 * @param {Object} options - 分析选项
 * @returns {Object} - 分析结果
 */
function analyzeData(data, analysisType, options = {}) {
  try {
    switch (analysisType) {
      case 'basicInfo':
        return getBasicInfo(data);
      case 'missingStats':
        return getMissingStats(data);
      case 'numericalStats':
        return getNumericalStats(data);
      case 'categoricalStats':
        return getCategoricalStats(data);
      case 'outliers':
        return detectOutliers(data, options.targetColumn);
      case 'featureImportance':
        return getFeatureImportance(data, options.targetColumn);
      case 'correlation':
        return getCorrelationAnalysis(data, options.targetColumn);
      case 'parameterGroup':
        return getParameterGroupAnalysis(
          data,
          options.targetColumn,
          options.groupColumns
        );
      case 'detailedParameterGroup':
        return getDetailedParameterGroupAnalysis(
          data,
          options.targetColumn,
          options.groupColumns
        );
      case 'marginalEffect':
        return getMarginalEffectAnalysis(
          data,
          options.targetColumn,
          options.features
        );
      case 'optimization':
        return generateOptimizationSuggestions(data, options.targetColumn);
      case 'evaluateModel':
        return evaluateModel(options.actual, options.predicted);
      case 'standardize':
        return standardizeFeatures(data, options.featureColumns);
      case 'permutationImportance':
        return calculatePermutationImportance(data, options.targetColumn, options.nRepeats);
      case 'featureSelection':
        return selectFeatures(data, options.targetColumn, options.method, options.threshold);
      case 'preprocess':
        return preprocessData(data, options.targetColumn);
      case 'generateReport':
        return generateAnalysisReport(data, options.targetColumn);
      case 'carbonEmission':
        return calculateCarbonEmission(options.params);
      case 'multiModelPrediction':
        return multiModelPrediction(data, options.targetColumn, options.modelOptions || {});
      default:
        throw new Error(`未知的分析类型: ${analysisType}`);
    }
  } catch (error) {
    console.error('数据分析失败:', error);
    throw new Error('数据分析失败: ' + error.message);
  }
}

/**
 * 计算两个数组的相关系数
 * @param {Array} x - 第一个数组
 * @param {Array} y - 第二个数组
 * @returns {number} - 相关系数
 */
function calculateCorrelation(x, y) {
  const n = x.length;
  const sumX = x.reduce((acc, val) => acc + val, 0);
  const sumY = y.reduce((acc, val) => acc + val, 0);
  const sumXY = x.reduce((acc, val, idx) => acc + val * y[idx], 0);
  const sumX2 = x.reduce((acc, val) => acc + val * val, 0);
  const sumY2 = y.reduce((acc, val) => acc + val * val, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * 相关性分析
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @returns {Object} - 相关性分析结果
 */
function getCorrelationAnalysis(data, targetColumn = 'productivity') {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    const columns = Object.keys(data[0]);
    const featureColumns = columns.filter((col) => col !== targetColumn);

    // 计算特征与目标变量的相关性
    const correlations = featureColumns.map((col) => {
      const featureValues = data
        .map((row) => row[col])
        .filter((val) => !isNaN(val));
      const targetValues = data
        .map((row) => row[targetColumn])
        .filter((val) => !isNaN(val));

      const correlation = calculateCorrelation(featureValues, targetValues);

      return {
        feature: col,
        correlation: correlation.toFixed(4),
        absoluteCorrelation: Math.abs(correlation).toFixed(4)
      };
    });

    // 排序
    correlations.sort(
      (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
    );

    // 计算相关矩阵
    const correlationMatrix = {};
    columns.forEach((col1) => {
      correlationMatrix[col1] = {};
      columns.forEach((col2) => {
        const values1 = data
          .map((row) => row[col1])
          .filter((val) => !isNaN(val));
        const values2 = data
          .map((row) => row[col2])
          .filter((val) => !isNaN(val));
        correlationMatrix[col1][col2] = calculateCorrelation(
          values1,
          values2
        ).toFixed(4);
      });
    });

    return {
      correlations,
      correlationMatrix,
      targetColumn
    };
  } catch (error) {
    console.error('相关性分析失败:', error);
    throw new Error('相关性分析失败: ' + error.message);
  }
}

/**
 * 模型性能评估
 * @param {Array} actual - 实际值数组
 * @param {Array} predicted - 预测值数组
 * @returns {Object} - 评估结果
 */
function evaluateModel(actual, predicted) {
  try {
    if (
      !Array.isArray(actual) ||
      !Array.isArray(predicted) ||
      actual.length !== predicted.length
    ) {
      throw new Error('输入数组长度不一致');
    }

    const n = actual.length;

    // 计算MSE
    const mse =
      actual.reduce((acc, val, idx) => {
        const diff = val - predicted[idx];
        return acc + diff * diff;
      }, 0) / n;

    // 计算R²
    const actualMean = mean(actual);
    const totalSumSquares = actual.reduce((acc, val) => {
      const diff = val - actualMean;
      return acc + diff * diff;
    }, 0);

    const residualSumSquares = actual.reduce((acc, val, idx) => {
      const diff = val - predicted[idx];
      return acc + diff * diff;
    }, 0);

    const r2 = 1 - residualSumSquares / totalSumSquares;

    return {
      mse: mse.toFixed(4),
      r2: r2.toFixed(4),
      rmse: Math.sqrt(mse).toFixed(4)
    };
  } catch (error) {
    console.error('模型评估失败:', error);
    throw new Error('模型评估失败: ' + error.message);
  }
}

/**
 * 参数分组分析
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @param {Array} groupColumns - 要分组分析的列
 * @returns {Object} - 分组分析结果
 */
function getParameterGroupAnalysis(
  data,
  targetColumn = 'productivity',
  groupColumns = [
    'Oxygen-enriched',
    'injection speed',
    'Injection temperature'
  ]
) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    // 如果没有提供分组列，使用数据中的所有列（除了目标列）
    if (!Array.isArray(groupColumns) || groupColumns.length === 0) {
      groupColumns = Object.keys(data[0]).filter((col) => col !== targetColumn);
    }

    const analysisResults = {};

    // 获取所有数值列作为指标列
    const metricColumns = Object.keys(data[0]).filter(
      (col) => typeof data[0][col] === 'number' && col !== groupColumns[0]
    );

    groupColumns.forEach((col) => {
      if (!Object.hasOwn(data[0], col)) return;

      const groups = {};
      data.forEach((row) => {
        const groupValue = row[col];
        if (!groups[groupValue]) {
          // 为每个分组创建一个对象，存储所有指标的数据
          const groupData = {};
          metricColumns.forEach((metricCol) => {
            groupData[metricCol] = [];
          });
          groups[groupValue] = groupData;
        }

        // 为每个指标添加数据
        metricColumns.forEach((metricCol) => {
          groups[groupValue][metricCol].push(row[metricCol]);
        });
      });

      const groupStats = {};
      Object.entries(groups).forEach(([value, groupData]) => {
        const stats = {};
        // 为每个指标计算统计值
        metricColumns.forEach((metricCol) => {
          const values = groupData[metricCol];
          stats[metricCol] = {
            mean: mean(values).toFixed(2),
            std: std(values).toFixed(2),
            count: values.length
          };
        });
        groupStats[value] = stats;
      });

      analysisResults[col] = {
        stats: groupStats,
        metrics: metricColumns
      };
    });

    // 如果没有找到任何分组列，使用默认分组
    if (Object.keys(analysisResults).length === 0 && data.length > 0) {
      // 使用第一个数值列作为分组列
      const firstNumericalColumn = Object.keys(data[0]).find(
        (col) => typeof data[0][col] === 'number' && col !== targetColumn
      );
      if (firstNumericalColumn) {
        const groups = {};
        data.forEach((row) => {
          // 将数值分为3个区间作为分组
          const value = row[firstNumericalColumn];
          const groupValue = Math.floor(value / 3).toString();
          if (!groups[groupValue]) {
            // 为每个分组创建一个对象，存储所有指标的数据
            const groupData = {};
            metricColumns.forEach((metricCol) => {
              groupData[metricCol] = [];
            });
            groups[groupValue] = groupData;
          }

          // 为每个指标添加数据
          metricColumns.forEach((metricCol) => {
            groups[groupValue][metricCol].push(row[metricCol]);
          });
        });

        const groupStats = {};
        Object.entries(groups).forEach(([value, groupData]) => {
          const stats = {};
          // 为每个指标计算统计值
          metricColumns.forEach((metricCol) => {
            const values = groupData[metricCol];
            stats[metricCol] = {
              mean: mean(values).toFixed(2),
              std: std(values).toFixed(2),
              count: values.length
            };
          });
          groupStats[value] = stats;
        });

        analysisResults[firstNumericalColumn] = {
          stats: groupStats,
          metrics: metricColumns
        };
      }
    }

    return analysisResults;
  } catch (error) {
    console.error('参数分组分析失败:', error);
    throw new Error('参数分组分析失败: ' + error.message);
  }
}

/**
 * 生成优化建议
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @returns {Object} - 优化建议
 */
function generateOptimizationSuggestions(
  data,
  targetColumn = 'productivity'
) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    // 获取特征重要性
    const importanceResult = getFeatureImportance(data, targetColumn);
    const topFeatures = importanceResult.featureImportance
      .slice(0, 3)
      .map((item) => item.feature);

    // 获取相关性分析
    const correlationResult = getCorrelationAnalysis(data, targetColumn);
    const topCorrelatedFeatures = correlationResult.correlations
      .slice(0, 3)
      .map((item) => item.feature);

    // 生成建议
    const suggestions = [
      {
        type: 'primary',
        feature: topFeatures[0],
        suggestion: `重点关注${topFeatures[0]}的控制，这是对${targetColumn}影响最大的因素`
      },
      {
        type: 'secondary',
        feature: topFeatures[1],
        suggestion: `优化${topFeatures[1]}的设置，提高其与${topFeatures[0]}的协同作用`
      },
      {
        type: 'tertiary',
        feature: topFeatures[2],
        suggestion: `合理调整${topFeatures[2]}，进一步提升${targetColumn}`
      }
    ];

    return {
      suggestions,
      topFeatures,
      topCorrelatedFeatures,
      targetColumn
    };
  } catch (error) {
    console.error('生成优化建议失败:', error);
    throw new Error('生成优化建议失败: ' + error.message);
  }
}

/**
 * 边际效应分析
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @param {Array} features - 要分析的特征列表
 * @returns {Object} - 边际效应分析结果
 */
function getMarginalEffectAnalysis(
  data,
  targetColumn = 'productivity',
  features = []
) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    const columns = Object.keys(data[0]);
    const featureColumns = columns.filter((col) => col !== targetColumn);

    // 如果没有提供特征列表，使用前3个重要特征
    let analysisFeatures = features;
    if (!Array.isArray(features) || features.length === 0) {
      const importanceResult = getFeatureImportance(data, targetColumn);
      analysisFeatures = importanceResult.featureImportance
        .slice(0, 3)
        .map((item) => item.feature);
    }

    // 准备数据
    const X = data.map((row) => {
      const features = { ...row };
      delete features[targetColumn];
      return Object.values(features);
    });
    const y = data.map((row) => row[targetColumn]);

    // 训练随机森林模型
    const nSamples = X.length;
    const nFeatures = X[0].length;
    const options = _getRandomForestOptions(nSamples, nFeatures);
    const rf = modelFactory.createModel('randomForest', options);
    rf.fit(X, y);

    const marginalEffects = [];

    analysisFeatures.forEach((feature) => {
      const featureIndex = featureColumns.indexOf(feature);
      if (featureIndex === -1) return;

      // 创建网格数据
      const featureValues = data.map((row) => row[feature]);
      const minVal = Math.min(...featureValues);
      const maxVal = Math.max(...featureValues);
      const featureRange = [];

      // 生成100个均匀分布的点
      for (let i = 0; i <= 100; i++) {
        featureRange.push(minVal + (maxVal - minVal) * (i / 100));
      }

      // 固定其他特征为中位数
      const XGrid = X.map((row) => [...row]);
      for (let i = 0; i < XGrid[0].length; i++) {
        if (i !== featureIndex) {
          const columnValues = data.map((row) => row[featureColumns[i]]);
          const sortedValues = [...columnValues].sort((a, b) => a - b);
          const median = sortedValues[Math.floor(sortedValues.length / 2)];
          XGrid.forEach((row) => {
            row[i] = median;
          });
        }
      }

      // 预测
      const predictions = [];
      featureRange.forEach((val) => {
        const XTemp = XGrid.map((row) => [...row]);
        XTemp.forEach((row) => {
          row[featureIndex] = val;
        });
        const pred = rf.predict(XTemp);
        predictions.push(mean(pred));
      });

      marginalEffects.push({
        feature,
        featureRange,
        predictions
      });
    });

    return {
      marginalEffects,
      targetColumn,
      features: analysisFeatures
    };
  } catch (error) {
    console.error('边际效应分析失败:', error);
    throw new Error('边际效应分析失败: ' + error.message);
  }
}

/**
 * 详细的参数分组分析
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @param {Array} groupColumns - 要分组分析的列
 * @returns {Object} - 详细分组分析结果
 */
function getDetailedParameterGroupAnalysis(
  data,
  targetColumn = 'productivity',
  groupColumns = [
    'Oxygen-enriched',
    'injection speed',
    'Injection temperature',
    'HIR',
    'BR'
  ]
) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    const analysisResults = {};

    groupColumns.forEach((col) => {
      if (!Object.hasOwn(data[0], col)) return;

      const groups = {};
      data.forEach((row) => {
        const groupValue = row[col];
        if (!groups[groupValue]) {
          groups[groupValue] = [];
        }
        groups[groupValue].push(row[targetColumn]);
      });

      const groupStats = {};
      Object.entries(groups).forEach(([value, values]) => {
        groupStats[value] = {
          mean: mean(values).toFixed(2),
          std: std(values).toFixed(2),
          count: values.length
        };
      });

      analysisResults[col] = groupStats;
    });

    return {
      analysisResults,
      targetColumn,
      groupColumns
    };
  } catch (error) {
    console.error('详细参数分组分析失败:', error);
    throw new Error('详细参数分组分析失败: ' + error.message);
  }
}

/**
 * 生成综合分析报告
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @returns {Object} - 综合分析报告
 */
function generateAnalysisReport(
  data,
  targetColumn = 'productivity'
) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    // 1. 基本信息
    const basicInfo = getBasicInfo(data);

    // 2. 数值统计
    const numericalStats = getNumericalStats(data);

    // 3. 特征重要性
    const importanceResult = getFeatureImportance(data, targetColumn);

    // 4. 相关性分析
    const correlationResult = getCorrelationAnalysis(data, targetColumn);

    // 5. 异常值检测
    const outlierResult = detectOutliers(data, targetColumn);

    // 6. 优化建议
    const optimizationResult = generateOptimizationSuggestions(data, targetColumn);

    // 7. 详细分组分析
    const groupAnalysisResult = getDetailedParameterGroupAnalysis(data, targetColumn);

    // 8. 边际效应分析
    const marginalEffectResult = getMarginalEffectAnalysis(data, targetColumn);

    // 生成报告
    return {
      title: `${targetColumn}影响因素分析报告`,
      basicInfo,
      numericalStats,
      importanceResult,
      correlationResult,
      outlierResult,
      optimizationResult,
      groupAnalysisResult,
      marginalEffectResult,
      summary: {
        mostImportantFactor: importanceResult.featureImportance[0]?.feature || 'N/A',
        modelPerformance: {
          // 计算模型性能
          r2: 'N/A',
          mse: 'N/A'
        },
        outlierPercentage: outlierResult.outlierPercentage,
        recommendations: optimizationResult.suggestions.map((item) => item.suggestion)
      }
    };
  } catch (error) {
    console.error('生成分析报告失败:', error);
    throw new Error('生成分析报告失败: ' + error.message);
  }
}

/**
 * 碳排放计算
 * @param {Object} params - 计算参数
 * @returns {Object} - 碳排放计算结果
 */
function calculateCarbonEmission(params = {}) {
  try {
    // 默认参数
    const defaultParams = {
      hotmetal_Fe_content: 0.9524,
      hotmetal_C_content: 0.0412,
      hotmetal_weight: 1,
      ore_Fe_content: 0.58145,
      ore_FeO_content: 0.07671,
      coke_C_content: 0.8631,
      coke_weight: 300,
      PC_C_content: 0.783,
      PC_weight: 160,
      flux_CaCO3_content: 0.1464,
      flux_MgCO3_content: 0.1465,
      flux_weight: 110,
      BFG_CO_volumefraction: 0.23,
      BFG_CO2_volumefraction: 0.18,
      BFG_production: 1500,
      BFG_consumption: 430,
      ore_C_content: 0
    };

    // 合并参数
    const {
      hotmetal_Fe_content,
      hotmetal_C_content,
      hotmetal_weight,
      ore_Fe_content,
      ore_FeO_content,
      coke_C_content,
      coke_weight,
      PC_C_content,
      PC_weight,
      flux_CaCO3_content,
      flux_MgCO3_content,
      flux_weight,
      BFG_CO_volumefraction,
      BFG_CO2_volumefraction,
      BFG_production,
      BFG_consumption,
      ore_C_content
    } = { ...defaultParams, ...params };

    // 计算铁矿石重量
    const ore_weight = hotmetal_weight * hotmetal_Fe_content / (ore_Fe_content + ore_FeO_content * 56 / (56 + 16));

    // 计算各种原材料中的碳含量
    const ore_C_weight = ore_weight * ore_C_content * 1000;
    const coke_C_weight = coke_weight * coke_C_content;
    const PC_C_weight = PC_weight * PC_C_content;
    const flux_C_weight = flux_weight * (flux_CaCO3_content * 12 / (40 + 12 + 16 * 3) + flux_MgCO3_content * 12 / (24 + 12 + 16 * 3));
    const hotmetal_C_weight = hotmetal_weight * hotmetal_C_content * 1000;

    // 计算高炉煤气中的碳
    const BFG_production_C_weight = BFG_production * (BFG_CO_volumefraction + BFG_CO2_volumefraction) / 0.0224 * 12 * 0.001;
    const BFG_consumption_C_weight = BFG_consumption * (BFG_CO_volumefraction + BFG_CO2_volumefraction) / 0.0224 * 12 * 0.001;

    // 计算能源带入的CO2
    const energy_brought_in_CO2 = (12 + 16 * 2) / 12 * (BFG_consumption_C_weight + PC_C_weight);

    // 计算原辅料带入的CO2
    const materials_brought_in_CO2 = (12 + 16 * 2) / 12 * (ore_C_weight + flux_C_weight + coke_C_weight);

    // 计算产品带出的CO2
    const taken_out_CO2 = (12 + 16 * 2) / 12 * hotmetal_C_weight;

    // 计算回收的CO2
    const recovery_CO2 = (12 + 16 * 2) / 12 * BFG_production_C_weight;

    // 计算直接碳排放
    const direct_CO2_weight = materials_brought_in_CO2 + energy_brought_in_CO2 - taken_out_CO2 - recovery_CO2;

    return {
      success: true,
      result: {
        direct_CO2_weight: direct_CO2_weight.toFixed(4),
        energy_brought_in_CO2: energy_brought_in_CO2.toFixed(4),
        materials_brought_in_CO2: materials_brought_in_CO2.toFixed(4),
        taken_out_CO2: taken_out_CO2.toFixed(4),
        recovery_CO2: recovery_CO2.toFixed(4),
        ore_weight: ore_weight.toFixed(4),
        ore_C_weight: ore_C_weight.toFixed(4),
        coke_C_weight: coke_C_weight.toFixed(4),
        PC_C_weight: PC_C_weight.toFixed(4),
        flux_C_weight: flux_C_weight.toFixed(4),
        hotmetal_C_weight: hotmetal_C_weight.toFixed(4),
        BFG_production_C_weight: BFG_production_C_weight.toFixed(4),
        BFG_consumption_C_weight: BFG_consumption_C_weight.toFixed(4)
      },
      parameters: {
        hotmetal_Fe_content,
        hotmetal_C_content,
        hotmetal_weight,
        ore_Fe_content,
        ore_FeO_content,
        coke_C_content,
        coke_weight,
        PC_C_content,
        PC_weight,
        flux_CaCO3_content,
        flux_MgCO3_content,
        flux_weight,
        BFG_CO_volumefraction,
        BFG_CO2_volumefraction,
        BFG_production,
        BFG_consumption,
        ore_C_content
      }
    };
  } catch (error) {
    console.error('碳排放计算失败:', error);
    throw new Error('碳排放计算失败: ' + error.message);
  }
}

/**
 * 多模型预测
 * @param {Array} data - 数据集
 * @param {string} targetColumn - 目标列名
 * @param {Object} options - 预测选项
 * @returns {Object} - 多模型预测结果
 */
function multiModelPrediction(data, targetColumn = 'productivity', options = {}) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    // 准备数据
    const columns = Object.keys(data[0]);
    const featureColumns = columns.filter((col) => col !== targetColumn);

    // Filter featureColumns to only numeric columns
    const numericFeatureColumns = featureColumns.filter((col) => {
      return data.every((row) => {
        const val = row[col];
        if (val === null || val === undefined || val === '') return false;
        const parsed = parseFloat(val);
        return !isNaN(parsed) && isFinite(parsed);
      });
    });

    // Build X from numeric features only
    const rawX = data.map((row) =>
      numericFeatureColumns.map((col) => parseFloat(row[col]))
    );
    const rawY = data.map((row) => parseFloat(row[targetColumn]));

    // Filter out invalid rows (NaN in y or NaN in X features)
    const X = [];
    const y = [];
    for (let i = 0; i < rawY.length; i++) {
      if (!isNaN(rawY[i]) && rawX[i].every((v) => !isNaN(v))) {
        X.push(rawX[i]);
        y.push(rawY[i]);
      }
    }

    // 解析选项
    const {
      models = ['linearRegression', 'decisionTree', 'randomForest'],
      params = {},
      optimize = false,
      evaluate = true
    } = options;

    // 初始化结果对象
    const modelResults = [];
    const predictions = {};
    const featureImportance = {};
    const modelParams = {};

    // 初始化评估器和优化器
    const evaluator = new ModelEvaluator();
    const optimizer = new ParameterOptimizer();

    // 训练和预测每个模型
    for (const modelName of models) {
      try {
        // 获取模型参数
        const modelParam = params[modelName] || {};

        // 创建模型实例
        const model = modelFactory.createModel(modelName, modelParam);

        // 如果需要自动调优
        let trainedModel = model;
        if (optimize) {
          // 定义参数分布
          const paramDistributions = getParamDistributions(modelName);

          // 随机搜索调优
          const optimizationResult = optimizer.randomSearch(
            model,
            X,
            y,
            paramDistributions,
            10, // 迭代次数
            5, // 交叉验证折数
            'r2' // 评分指标
          );

          trainedModel = optimizationResult.bestModel;
          modelParams[modelName] = optimizationResult.bestParams;
        } else {
          // 直接训练模型
          model.fit(X, y);
        }

        // 预测
        const modelPredictions = trainedModel.predict(X);
        predictions[modelName] = modelPredictions;

        // 计算特征重要性
        featureImportance[modelName] = trainedModel.getFeatureImportance();

        // 评估模型
        let evaluation = null;
        if (evaluate) {
          evaluation = evaluator.evaluate(trainedModel, X, y, ['mse', 'rmse', 'r2', 'mae', 'mape']);
        }

        // 存储模型结果
        modelResults.push({
          name: modelName,
          r2: evaluation ? evaluation.r2.toFixed(4) : 'N/A',
          mse: evaluation ? evaluation.mse.toFixed(4) : 'N/A',
          rmse: evaluation ? evaluation.rmse.toFixed(4) : 'N/A',
          mae: evaluation ? evaluation.mae.toFixed(4) : 'N/A',
          mape: evaluation ? evaluation.mape.toFixed(4) : 'N/A',
          predictions: modelPredictions.map(pred => pred.toFixed(4)),
          params: modelParams[modelName] || modelParam
        });

      } catch (error) {
        console.error(`Error with model ${modelName}:`, error);
        modelResults.push({
          name: modelName,
          error: error.message,
          predictions: []
        });
      }
    }

    // 创建模型集成器
    const integrator = new ModelIntegrator({
      integrationMethod: 'weightedAverage'
    });

    // 添加所有模型到集成器
    for (const modelName of models) {
      try {
        const modelParam = params[modelName] || {};
        const model = modelFactory.createModel(modelName, modelParam);
        model.fit(X, y);
        integrator.addModel(model, modelParam, 1.0);
      } catch (error) {
        console.error(`Error adding model ${modelName} to integrator:`, error);
      }
    }

    // 集成预测
    let ensemblePredictions = [];
    if (integrator.models.length > 0) {
      // 手动设置集成器为已训练状态，因为我们已经训练了所有添加的模型
      integrator.isTrained = true;
      ensemblePredictions = integrator.predict(X);

      // 评估集成模型
      let ensembleEvaluation = null;
      if (evaluate) {
        ensembleEvaluation = evaluator.evaluate(integrator, X, y, ['mse', 'rmse', 'r2', 'mae', 'mape']);
      }

      // 添加集成模型结果
      modelResults.push({
        name: 'Ensemble',
        r2: ensembleEvaluation ? ensembleEvaluation.r2.toFixed(4) : 'N/A',
        mse: ensembleEvaluation ? ensembleEvaluation.mse.toFixed(4) : 'N/A',
        rmse: ensembleEvaluation ? ensembleEvaluation.rmse.toFixed(4) : 'N/A',
        mae: ensembleEvaluation ? ensembleEvaluation.mae.toFixed(4) : 'N/A',
        mape: ensembleEvaluation ? ensembleEvaluation.mape.toFixed(4) : 'N/A',
        predictions: ensemblePredictions.map(pred => pred.toFixed(4)),
        params: { integrationMethod: 'weightedAverage' }
      });
    }

    // 计算综合特征重要性
    const combinedFeatureImportance = numericFeatureColumns.map((feature, idx) => {
      let totalImportance = 0;
      let count = 0;

      for (const modelName in featureImportance) {
        const importances = featureImportance[modelName];
        if (importances[idx] !== undefined) {
          totalImportance += importances[idx];
          count++;
        }
      }

      return {
        feature,
        importance: count > 0 ? totalImportance / count : 0
      };
    }).sort((a, b) => b.importance - a.importance);

    return {
      models: modelResults,
      featureImportance: combinedFeatureImportance,
      actualValues: y.map(val => val.toFixed(4)),
      availableModels: modelFactory.getAvailableModels(),
      optimization: optimize,
      summary: {
        totalModels: modelResults.length,
        successfulModels: modelResults.filter(m => !m.error).length,
        bestModel: modelResults.reduce((best, current) => {
          if (best.error) return current;
          if (current.error) return best;
          return parseFloat(current.r2) > parseFloat(best.r2) ? current : best;
        })
      }
    };
  } catch (error) {
    console.error('多模型预测失败:', error);
    throw new Error('多模型预测失败: ' + error.message);
  }
}

/**
 * 获取模型参数分布
 * @param {string} modelName - 模型名称
 * @returns {Object} - 参数分布
 */
function getParamDistributions(modelName) {
  const distributions = {
    linearRegression: {
      learningRate: { type: 'loguniform', min: 0.001, max: 0.1 },
      epochs: { type: 'int', min: 100, max: 1000 },
      useGradientDescent: [true, false]
    },
    decisionTree: {
      maxDepth: { type: 'int', min: 3, max: 15 },
      minSamplesSplit: { type: 'int', min: 2, max: 10 },
      minSamplesLeaf: { type: 'int', min: 1, max: 5 },
      maxFeatures: ['auto', null]
    },
    randomForest: {
      nEstimators: { type: 'int', min: 5, max: 20 },
      maxDepth: { type: 'int', min: 3, max: 10 },
      minSamplesSplit: { type: 'int', min: 2, max: 5 },
      maxFeatures: ['auto', 'sqrt']
    },
    gradientBoosting: {
      nEstimators: { type: 'int', min: 5, max: 20 },
      learningRate: { type: 'loguniform', min: 0.01, max: 0.3 },
      maxDepth: { type: 'int', min: 2, max: 6 },
      loss: ['ls', 'lad']
    },
    svr: {
      C: { type: 'loguniform', min: 0.1, max: 10 },
      epsilon: { type: 'loguniform', min: 0.01, max: 0.3 },
      kernel: ['linear', 'rbf'],
      gamma: ['auto', { type: 'loguniform', min: 0.001, max: 0.1 }]
    }
  };

  return distributions[modelName] || {};
}

/**
 * 获取所有可用的分析类型
 * @returns {Array} - 分析类型列表
 */
function getAvailableAnalysisTypes() {
  return [
    { type: 'basicInfo', name: '基本信息概览' },
    { type: 'missingStats', name: '缺失值统计' },
    { type: 'numericalStats', name: '数值数据统计' },
    { type: 'categoricalStats', name: '分类变量统计' },
    { type: 'outliers', name: '异常值检测' },
    { type: 'featureImportance', name: '特征重要性分析' },
    { type: 'permutationImportance', name: '排列重要性分析' },
    { type: 'correlation', name: '相关性分析' },
    { type: 'parameterGroup', name: '参数分组分析' },
    { type: 'detailedParameterGroup', name: '详细参数分组分析' },
    { type: 'marginalEffect', name: '边际效应分析' },
    { type: 'featureSelection', name: '特征选择' },
    { type: 'preprocess', name: '数据预处理' },
    { type: 'optimization', name: '优化建议' },
    { type: 'standardize', name: '特征标准化' },
    { type: 'generateReport', name: '生成综合分析报告' },
    { type: 'carbonEmission', name: '碳排放计算' },
    { type: 'multiModelPrediction', name: '多模型预测' }
  ];
}

// 兼容 CommonJS require() 写法
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getBasicInfo,
    getMissingStats,
    getNumericalStats,
    getCategoricalStats,
    detectOutliers,
    calculatePermutationImportance,
    getFeatureImportance,
    standardizeFeatures,
    selectFeatures,
    preprocessData,
    analyzeData,
    getCorrelationAnalysis,
    evaluateModel,
    getParameterGroupAnalysis,
    generateOptimizationSuggestions,
    getMarginalEffectAnalysis,
    getDetailedParameterGroupAnalysis,
    getAvailableAnalysisTypes,
    multiModelPrediction
  };
}
