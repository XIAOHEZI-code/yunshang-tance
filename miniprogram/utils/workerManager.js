// workerManager.js - Web Worker 管理工具

// 导入环境检测工具
const envDetector = require('./env');

// 导入分析API模块
const analysisApi = require('./analysisApi');

// 导入 BaseWorkerManager
const BaseWorkerManager = require('./baseWorkerManager.js');

// 导入MCP管理器
let mcpManager = null;
try {
  mcpManager = require('./mcp/mcpManager').default;
} catch (error) {
  console.warn('MCP manager not available, using fallback methods:', error);
}

class WorkerManager extends BaseWorkerManager {
  constructor() {
    super({
      workerScript: 'worker/analysisWorker.js',
      taskTimeout: 30000 // 会被优化配置中的超时时间动态覆盖
    });
    this.pendingTasks = this.callbacks; // 保持向后兼容的别名
    this.isInitialized = false;
    this.useDirectExecution = false;
    this.mcpUnavailable = false;
    this.analysisFunctions = null;
    this.deviceCapabilities = null;
    this.optimizationSettings = null;
  }

  /**
   * 返回平台/环境是否支持 Worker
   */
  _isPlatformSupported() {
    if (!this.deviceCapabilities) {
      this.detectDeviceCapabilities();
    }
    return this.deviceCapabilities && this.deviceCapabilities.supportsWorkers;
  }

  /**
   * 初始化 Worker
   */
  init() {
    if (this.isInitialized) return;

    try {
      // 检测设备能力
      this.detectDeviceCapabilities();

      // 检查 MCP 是否实际配置
      if (mcpManager) {
        try {
          const serverUrl = mcpManager.config ? mcpManager.config.get('server.url') : '';
          const PLACEHOLDER_URLS = ['https://mcp.example.com', 'http://mcp.example.com', '', null, undefined];
          if (PLACEHOLDER_URLS.includes(serverUrl)) {
            this.mcpUnavailable = true;
            console.log('MCP server not configured (placeholder URL), using local analysis only');
          }
        } catch (e) {
          this.mcpUnavailable = true;
        }
      }

      // 调用基类的 initWorker 启动 Worker
      const workerInited = this.initWorker();
      if (!workerInited) {
        console.log('Worker API not available or platform unsupported, using direct execution');
        this.useDirectExecution = true;
      }
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      this.useDirectExecution = true;
      this.isInitialized = true;
    }
  }

  /**
   * 重写 initWorker 以进行 postMessage 消息格式拦截适配
   */
  initWorker() {
    const success = super.initWorker();
    if (success && this.worker) {
      // 拦截 postMessage，将基类生成的 taskId 映射到 analysisWorker.js 所需 of id
      const originalPostMessage = this.worker.postMessage.bind(this.worker);
      this.worker.postMessage = (msg) => {
        if (msg && msg.taskId !== undefined) {
          msg.id = msg.taskId;
        }
        originalPostMessage(msg);
      };
    }
    return success;
  }

  /**
   * 处理 Worker 返回的特定格式消息
   * 适配 { id, success, result, error } 到基类的 { taskId, success, data, error }
   */
  handleWorkerMessage(res) {
    const dataObj = (res && res.data && res.data.id !== undefined) ? res.data : res;
    const { id, success, result, error } = dataObj;

    if (id !== undefined) {
      super.handleWorkerMessage({
        taskId: id,
        success,
        data: result,
        error
      });
    } else {
      console.warn('[WorkerManager] Received message without id:', res);
    }
  }

  /**
   * 处理 Worker 错误，拦截 Critical 类型的错误进行熔断降级
   */
  handleWorkerError(error) {
    const errorMsg = String(error && (error.message || error) || '');
    console.warn('Worker error:', errorMsg);
    
    const isCritical = 
      errorMsg.includes('not defined') || 
      errorMsg.includes('not found') ||
      errorMsg.includes('crashed') ||
      errorMsg.includes('terminated');
    
    if (isCritical) {
      console.error('Critical worker error, falling back to direct execution');
      this.useDirectExecution = true;
      super.handleWorkerError(error);
    } else {
      console.warn('Non-critical worker warning, continuing normally');
    }
  }

  /**
   * 检测设备能力并设置优化策略
   */
  detectDeviceCapabilities() {
    const envInfo = envDetector.getEnvInfo();
    this.deviceCapabilities = envInfo.deviceCapabilities;

    // 根据设备能力设置优化策略
    if (envInfo.isDesktop) {
      // 桌面端优化策略
      this.optimizationSettings = {
        useWorker: true,
        batchSize: 1000,
        parallelTasks: 4,
        timeout: 60000, // 60秒超时
        useAdvancedAnalysis: true,
        memoryLimit: 1024 * 1024 * 1024, // 1GB内存限制
        cacheResults: true
      };
    } else {
      // 移动端优化策略
      this.optimizationSettings = {
        useWorker: true,
        batchSize: 500,
        parallelTasks: 2,
        timeout: 30000, // 30秒超时
        useAdvancedAnalysis: false,
        memoryLimit: 512 * 1024 * 1024, // 512MB内存限制
        cacheResults: false
      };
    }
  }

  /**
   * 发送任务到 Worker
   */
  sendTask(action, data = null, analysisType = null, options = {}) {
    if (!this.isInitialized) {
      this.init();
    }

    const optimizedOptions = {
      ...options,
      ...this.optimizationSettings,
      deviceCapabilities: this.deviceCapabilities
    };

    const timeoutDuration = this.optimizationSettings?.timeout || 30000;

    const message = {
      action,
      data,
      analysisType,
      options: optimizedOptions
    };

    const fallbackFn = () => {
      if (action === 'analyze') {
        return this.performAnalysis(data, analysisType, optimizedOptions);
      } else if (action === 'getAvailableAnalysisTypes') {
        return this.getAvailableAnalysisTypesDirect();
      } else {
        throw new Error(`Unknown action: ${action}`);
      }
    };

    if (this.useDirectExecution) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            resolve(fallbackFn());
          } catch (e) {
            reject(e);
          }
        }, 0);
      });
    }

    return this._dispatchTask(message, fallbackFn, timeoutDuration);
  }

  /**
   * 直接执行分析（非 Worker 模式）
   * @param {Array} data - 数据集
   * @param {string} analysisType - 分析类型
   * @param {Object} options - 分析选项
   * @returns {Object} - 分析结果
   */
  performAnalysis(data, analysisType, options) {
    const analysisApi = require('./analysisApi.js');
    console.log('[workerManager.performAnalysis] dispatching type=' + analysisType + ', dataRows=' + (data ? data.length : 0) + ', targetColumn=' + (options.targetColumn || 'none'));
    if (analysisType === 'basicInfo') {
      console.log('[workerManager.performAnalysis] dispatching to getBasicInfo');
      return this.getBasicInfo(data);
    } else if (analysisType === 'numericalStats') {
      return this.getNumericalStats(data);
    } else if (analysisType === 'correlation') {
      return this.getCorrelationAnalysis(data, options.targetColumn);
    } else if (analysisType === 'featureImportance') {
      return this.getFeatureImportance(data, options.targetColumn);
    } else if (analysisType === 'permutationImportance') {
      return analysisApi.calculatePermutationImportance(data, options.targetColumn);
    } else if (analysisType === 'outliers') {
      return this.detectOutliers(data, options.targetColumn);
    } else if (analysisType === 'preprocess') {
      return this.preprocessData(data, options.targetColumn);
    } else if (analysisType === 'standardize') {
      return analysisApi.standardizeFeatures(data, options.featureColumns || Object.keys(data[0]));
    } else if (analysisType === 'parameterGroup') {
      // analysisApi expects (data, targetColumn, groupColumns)
      return analysisApi.getParameterGroupAnalysis(data, options.targetColumn, options.groupColumn ? [options.groupColumn] : []);
    } else if (analysisType === 'featureSelection') {
      return analysisApi.selectFeatures(data, options.targetColumn);
    } else if (analysisType === 'carbonEmission') {
      return this.calculateCarbonEmissionLocal(options.params);
    } else if (analysisType === 'multiModelPrediction') {
      return this.multiModelPrediction(data, options.targetColumn);
    } else {
      throw new Error(`Unknown analysis type: ${analysisType}`);
    }
  }

  /**
   * 数据基本信息概览
   * @param {Array} data - 数据集
   * @returns {Object} - 基本信息
   */
  getBasicInfo(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }
    console.log('[workerManager.getBasicInfo] entry, dataRows=' + data.length);

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

    console.log('[workerManager.getBasicInfo] done, columns=' + columns.length + ', numericalCols=' + numericalCols.length + ', categoricalCols=' + categoricalCols.length);
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
  }

  /**
   * 数值统计描述（补充缺失的方法）
   * @param {Array} data - 数据集
   * @returns {Object} { numericalColumns, stats }
   */
  getNumericalStats(data) {
    if (!Array.isArray(data) || data.length === 0) throw new Error('数据集为空');
    const columns = Object.keys(data[0]);
    const numericalCols = columns.filter(col => {
      const vals = data.map(r => r[col]).filter(v => typeof v === 'number' && !isNaN(v));
      return vals.length / data.length > 0.5;
    });
    const stats = {};
    numericalCols.forEach(col => {
      const vals = data.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
      if (!vals.length) return;
      const sorted = [...vals].sort((a, b) => a - b);
      const n = sorted.length;
      const avg = this.mean(vals);
      const variance = this.mean(vals.map(v => Math.pow(v - avg, 2)));
      stats[col] = {
        count: n,
        mean: avg.toFixed(4),
        std: Math.sqrt(variance).toFixed(4),
        min: sorted[0].toFixed(4),
        '25%': sorted[Math.floor(n * 0.25)].toFixed(4),
        '50%': sorted[Math.floor(n * 0.5)].toFixed(4),
        '75%': sorted[Math.floor(n * 0.75)].toFixed(4),
        max: sorted[n - 1].toFixed(4)
      };
    });
    return { numericalColumns: numericalCols, stats };
  }

  /**
   * 计算数组的平均值
   * @param {Array} arr - 数值数组
   * @returns {number} - 平均值
   */
  mean(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    const sum = arr.reduce((acc, val) => acc + (val || 0), 0);
    return sum / arr.length;
  }

  /**
   * 计算两个数组的相关系数
   * @param {Array} x - 第一个数组
   * @param {Array} y - 第二个数组
   * @returns {number} - 相关系数
   */
  calculateCorrelation(x, y) {
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
  getCorrelationAnalysis(data, targetColumn = 'productivity') {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    const columns = Object.keys(data[0]);
    const featureColumns = columns.filter((col) => col !== targetColumn);

    // Bug Fix: 同步 filter，保证 featureValues 和 targetValues 索引对齐
    const correlations = featureColumns.map((col) => {
      const pairs = data
        .map((row) => [row[col], row[targetColumn]])
        .filter(([f, t]) => !isNaN(parseFloat(f)) && !isNaN(parseFloat(t)));
      const featureValues = pairs.map(([f]) => parseFloat(f));
      const targetValues = pairs.map(([, t]) => parseFloat(t));

      const correlation = featureValues.length < 2 ? 0 : this.calculateCorrelation(featureValues, targetValues);

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

    // 计算相关矩阵 - 利用对称性减少计算量
    const correlationMatrix = {};
    columns.forEach((col1, i) => {
      correlationMatrix[col1] = {};
      columns.forEach((col2, j) => {
        if (i === j) {
          // 对角线元素为 1
          correlationMatrix[col1][col2] = '1.0000';
        } else if (i > j) {
          // 利用对称性，直接使用已计算的值
          correlationMatrix[col1][col2] = correlationMatrix[col2][col1];
        } else {
          // Bug Fix: 成对过滤，确保 values1 和 values2 索引对齐
          const pairs = data
            .map((row) => [row[col1], row[col2]])
            .filter(([v1, v2]) => !isNaN(parseFloat(v1)) && !isNaN(parseFloat(v2)));
          const values1 = pairs.map(([v1]) => parseFloat(v1));
          const values2 = pairs.map(([, v2]) => parseFloat(v2));
          correlationMatrix[col1][col2] = values1.length < 2
            ? '0.0000'
            : this.calculateCorrelation(values1, values2).toFixed(4);
        }
      });
    });

    return {
      correlations,
      correlationMatrix,
      targetColumn
    };
  }

  /**
   * 特征重要性分析
   * @param {Array} data - 数据集
   * @param {string} targetColumn - 目标列名
   * @returns {Object} - 特征重要性结果
   */
  getFeatureImportance(data, targetColumn = 'productivity') {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    const columns = Object.keys(data[0]);
    const featureColumns = columns.filter((col) => col !== targetColumn);

    // 1. 基于线性相关性的特征重要性
    const linearCorrelationImportances = featureColumns.map((col) => {
      const featureValues = data.map((row) => row[col]);
      const targetValues = data.map((row) => row[targetColumn]);

      const featureMean = this.mean(featureValues);
      const targetMean = this.mean(targetValues);

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
        method: 'linear_correlation',
        correlation: correlation
      };
    });

    // 2. 方差贡献率（真实计算，替代原来的 Math.random()）
    //    对每个特征列，计算该列与目标列联合的方差贡献比例
    const targetValues = data.map((row) => row[targetColumn]).filter((v) => !isNaN(parseFloat(v))).map(parseFloat);
    const targetVariance = this.std(targetValues) ** 2 || 1;

    const varianceContributions = featureColumns.map((feature) => {
      const pairs = data
        .map((row) => [row[feature], row[targetColumn]])
        .filter(([f, t]) => !isNaN(parseFloat(f)) && !isNaN(parseFloat(t)));
      const fv = pairs.map(([f]) => parseFloat(f));
      const tv = pairs.map(([, t]) => parseFloat(t));
      // 用特征与目标的协方差占目标方差之比作为方差贡献
      if (fv.length < 2) return { feature, importance: 0 };
      const fMean = this.mean(fv);
      const tMean = this.mean(tv);
      const fStd = this.std(fv) || 1;
      const cov = fv.reduce((acc, f, i) => acc + (f - fMean) * (tv[i] - tMean), 0) / fv.length;
      const correlation = cov / (fStd * (this.std(tv) || 1));
      return { feature, importance: Math.abs(correlation), std: 0 };
    });

    // 3. 综合重要性（线性相关 + 方差贡献，各占50%）
    const combinedImportances = featureColumns.map((feature) => {
      const linearImportance =
        linearCorrelationImportances.find((item) => item.feature === feature)?.importance || 0;
      const varContrib =
        varianceContributions.find((item) => item.feature === feature)?.importance || 0;

      const combinedScore = (linearImportance + varContrib) / 2;

      return {
        feature,
        importance: combinedScore,
        linearCorrelationImportance: linearImportance,
        varianceContribution: varContrib
      };
    });

    // 排序
    combinedImportances.sort((a, b) => b.importance - a.importance);

    // 选择重要特征
    const meanImportance = this.mean(
      combinedImportances.map((item) => item.importance)
    );
    const selectedFeatures = combinedImportances
      .filter((item) => item.importance >= meanImportance)
      .map((item) => item.feature);

    return {
      featureImportance: combinedImportances,
      linearCorrelationImportance: linearCorrelationImportances,
      permutationImportance: [],
      selectedFeatures: selectedFeatures,
      meanImportance: meanImportance,
      // 添加方法说明和局限性
      methodology: {
        linearCorrelation: {
          description: '基于皮尔逊相关系数的线性相关性分析',
          limitations: [
            '仅能捕捉线性关系',
            '无法检测非线性关系（如y=x²）',
            '对异常值敏感'
          ]
        },
        permutationImportance: {
          description: '基于模型性能下降的排列重要性',
          advantages: [
            '可以捕捉非线性关系',
            '对特征交互敏感',
            '更接近实际模型性能'
          ]
        }
      }
    };
  }

  /**
   * 异常值检测
   * @param {Array} data - 数据集
   * @param {string} targetColumn - 目标列名
   * @returns {Object} - 异常值检测结果
   */
  detectOutliers(data, targetColumn = 'productivity') {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    // Bug Fix: threshold 应为 3σ，而非 mean+3σ
    const targetValues = data.map((row) => parseFloat(row[targetColumn]) || 0);
    const meanValue = this.mean(targetValues);
    const stdValue = this.std(targetValues);
    const sigmaThreshold = 3 * stdValue; // 正确：3倍标准差作为阈值

    const outlierIndices = [];
    targetValues.forEach((value, idx) => {
      if (Math.abs(value - meanValue) > sigmaThreshold) {
        outlierIndices.push(idx);
      }
    });

    return {
      residualStats: {
        mean: meanValue.toFixed(4),
        std: stdValue.toFixed(4),
        threshold: sigmaThreshold.toFixed(4)
      },
      outlierCount: outlierIndices.length,
      outlierPercentage: ((outlierIndices.length / data.length) * 100).toFixed(2),
      outlierIndices,
      outliers: data.filter((_, idx) => outlierIndices.includes(idx)),
      residuals: targetValues.map((value) => Math.abs(value - meanValue))
    };
  }

  /**
   * 计算数组的标准差
   * @param {Array} arr - 数值数组
   * @returns {number} - 标准差
   */
  std(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    const avg = this.mean(arr);
    const squaredDifferences = arr.map((val) => Math.pow((val || 0) - avg, 2));
    const variance = this.mean(squaredDifferences);
    return Math.sqrt(variance);
  }

  /**
   * 完整的数据预处理流水线
   * @param {Array} data - 原始数据集
   * @param {string} targetColumn - 目标列名
   * @returns {Object} - 预处理结果
   */
  preprocessData(data, targetColumn = 'productivity') {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('数据集为空');
    }

    // 步骤1: 异常值检测和处理
    const outlierResult = this.detectOutliers(data, targetColumn);
    const cleanedData = data.filter((_, idx) => !outlierResult.outlierIndices.includes(idx));

    // 步骤2: 特征选择
    const importanceResult = this.getFeatureImportance(cleanedData, targetColumn);
    const selectedFeatures = importanceResult.selectedFeatures;

    return {
      originalData: data,
      cleanedData,
      selectedFeatures: selectedFeatures,
      outlierResult,
      featureScores: importanceResult.featureImportance
    };
  }



  /**
   * 多模型预测
   * @param {Array} data - 数据集
   * @param {string} targetColumn - 目标列名
   * @returns {Object} - 多模型预测结果
   */
  multiModelPrediction(data, targetColumn = 'productivity', options = {}) {
    try {
      return analysisApi.multiModelPrediction(data, targetColumn, options);
    } catch (error) {
      console.error('多模型预测失败:', error);
      throw new Error('多模型预测失败: ' + error.message);
    }
  }

  /**
   * 获取可用的分析类型（直接模式）
   * @returns {Array} - 分析类型列表
   */
  getAvailableAnalysisTypesDirect() {
    return [
      { type: 'basicInfo', name: '基本信息概览', category: '统计' },
      { type: 'numericalStats', name: '数值统计分析', category: '统计' },
      { type: 'outliers', name: '异常值检测', category: '质量' },
      { type: 'featureImportance', name: '特征重要性', category: '分析' },
      { type: 'permutationImportance', name: '排列重要性', category: '分析' },
      { type: 'correlation', name: '相关性分析', category: '分析' },
      { type: 'parameterGroup', name: '参数分组分析', category: '分析' },
      { type: 'featureSelection', name: '特征选择', category: '建模' },
      { type: 'preprocess', name: '数据预处理', category: '建模' },
      { type: 'standardize', name: '特征标准化', category: '建模' },
      { type: 'carbonEmission', name: '碳排放核算', category: '冶金' },
      { type: 'multiModelPrediction', name: '多模型预测', category: '建模' }
    ];
  }

  /**
   * 分析数据
   * @param {Array} data - 数据集
   * @param {string} analysisType - 分析类型
   * @param {Object} options - 分析选项
   * @returns {Promise} - 分析结果
   */
  async analyze(data, analysisType, options = {}) {
    console.log('[workerManager.analyze] entry, type=' + analysisType + ', mcpUnavailable=' + this.mcpUnavailable + ', dataRows=' + (data ? data.length : 0));
    // Skip MCP if we already know it's unavailable
    if (this.mcpUnavailable) {
      console.log('[workerManager.analyze] MCP unavailable, delegating to sendTask');
      return this.sendTask('analyze', data, analysisType, options);
    }

    try {
      // 尝试使用MCP进行分析
      if (mcpManager && mcpManager.getConnectionStatus()) {
        console.log('Using MCP for analysis:', analysisType);
        return await mcpManager.analyze(data, analysisType, options);
      } else if (mcpManager) {
        // MCP可用但未连接，尝试初始化
        const connected = await mcpManager.init();
        if (connected) {
          console.log('MCP initialized, using for analysis:', analysisType);
          return await mcpManager.analyze(data, analysisType, options);
        } else {
          // Mark MCP as unavailable to skip future attempts
          this.mcpUnavailable = true;
          console.log('[workerManager.analyze] delegating to sendTask (mcpUnavailable=' + this.mcpUnavailable + ')');
          return this.sendTask('analyze', data, analysisType, options);
        }
      } else {
        // MCP不可用，使用本地分析
        this.mcpUnavailable = true;
        console.log('[workerManager.analyze] delegating to sendTask (mcpUnavailable=' + this.mcpUnavailable + ')');
        return this.sendTask('analyze', data, analysisType, options);
      }
    } catch (error) {
      console.error('MCP analysis error, falling back to local analysis:', error);
      this.mcpUnavailable = true;
      console.log('[workerManager.analyze] delegating to sendTask (mcpUnavailable=' + this.mcpUnavailable + ')');
      return this.sendTask('analyze', data, analysisType, options);
    }
  }

  /**
   * 获取可用的分析类型
   * @returns {Promise} - 分析类型列表
   */
  async getAvailableAnalysisTypes() {
    // Skip MCP if we already know it's unavailable
    if (this.mcpUnavailable) {
      return this.sendTask('getAvailableAnalysisTypes');
    }
    
    try {
      if (mcpManager && mcpManager.getConnectionStatus()) {
        const models = await mcpManager.getModels();
        return models.map(model => ({
          type: model.type,
          name: model.name
        }));
      } else if (mcpManager) {
        const connected = await mcpManager.init();
        if (connected) {
          const models = await mcpManager.getModels();
          return models.map(model => ({
            type: model.type,
            name: model.name
          }));
        }
      }
    } catch (error) {
      console.warn('MCP not available for analysis types, using local:', error.message || error);
    }
    
    // Mark MCP as unavailable to skip future attempts
    this.mcpUnavailable = true;
    return this.sendTask('getAvailableAnalysisTypes');
  }

  /**
   * 预测数据
   * @param {Array} data - 数据集
   * @param {string} modelType - 模型类型
   * @param {Object} options - 预测选项
   * @returns {Promise} - 预测结果
   */
  async predict(data, modelType, options = {}) {
    if (this.mcpUnavailable) {
      return this.multiModelPrediction(data, options.targetColumn);
    }
    try {
      if (mcpManager && mcpManager.getConnectionStatus()) {
        return await mcpManager.predict(data, modelType, options);
      }
    } catch (error) {
      console.warn('MCP prediction unavailable, using local:', error.message || error);
    }
    this.mcpUnavailable = true;
    return this.multiModelPrediction(data, options.targetColumn);
  }

  /**
   * 计算碳排放量
   * @param {Object} params - 计算参数
   * @returns {Promise} - 碳排放计算结果
   */
  async calculateCarbonEmission(params = {}) {
    if (this.mcpUnavailable) {
      return this.calculateCarbonEmissionLocal(params);
    }
    try {
      if (mcpManager && mcpManager.getConnectionStatus()) {
        return await mcpManager.calculateCarbonEmission(params);
      }
    } catch (error) {
      console.warn('MCP carbon emission unavailable, using local:', error.message || error);
    }
    this.mcpUnavailable = true;
    return this.calculateCarbonEmissionLocal(params);
  }

  /**
   * 本地碳排放计算（降级方案）
   * @param {Object} params - 计算参数
   * @returns {Object} - 碳排放计算结果
   */
  calculateCarbonEmissionLocal(params = {}) {
    // 原有的碳排放计算逻辑
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
   * 终止 Worker 线程
   */
  terminate() {
    this.destroyWorker();
    this.isInitialized = false;
    this.callbacks.forEach((cb) => cb(new Error('Worker terminated')));
    this.callbacks.clear();
    console.log('Worker terminated');
  }
}

// 导出单例实例
const workerManager = new WorkerManager();

// 微信小程序和 Node.js 均使用 CommonJS，直接导出
module.exports = workerManager;
module.exports.default = workerManager;
module.exports.WorkerManager = WorkerManager;