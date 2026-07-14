// analysis.js - 冶金高炉过程数据分析页逻辑（重构版）

const { getTableSchema, queryData, getDataVersion } = require('../../utils/sqlStore');
const workerManager = require('../../utils/workerManager').default;
const echarts = require('../../components/ec-canvas/echarts');
const {
  showToast,
  formatDateTime,
  safeSerialize
} = require('../../utils/common');
const envDetector = require('../../utils/env').default;

// 分析步骤描述（用于状态透视条）
const ANALYSIS_STEPS = {
  basicInfo: ['读取数据集', '推断列类型', '统计基本指标'],
  numericalStats: ['筛选数值列', '计算均值/标准差', '生成统计摘要'],
  outliers: ['计算均值和标准差', '识别3σ异常点', '生成检测报告'],
  featureImportance: ['筛选特征列', '计算方差贡献率', '排序特征重要性'],
  permutationImportance: ['准备特征矩阵', '计算排列重要性', '归一化排序'],
  correlation: ['构建特征矩阵', '计算皮尔逊相关系数', '排序相关性结果'],
  parameterGroup: ['按分组字段聚合', '计算组内统计量', '生成分组分析表'],
  featureSelection: ['计算方差贡献', '筛选高价值特征', '生成特征集合'],
  preprocess: ['检测异常值', '分析特征重要性', '输出清洗结果'],
  optimization: ['评估特征空间', '识别高影响因素', '生成优化建议'],
  standardize: ['计算均值和标准差', '执行Z-score标准化', '验证标准化结果'],
  carbonEmission: ['读取工艺参数', '核算碳输入/输出', '计算净CO₂排放'],
  multiModelPrediction: ['准备特征矩阵', '拟合线性回归模型', '计算预测误差', '评估特征重要性']
};

Page({
  data: {
    // 数据
    tableSchema: null,
    tableData: [],
    numericalColumns: [],
    // 分析类型
    analysisTypes: [],
    selectedAnalysisIndex: 0,
    selectedTargetIndex: 0,
    selectedGroupIndex: 0,
    // 结果
    analysisResult: null,
    summaryCards: [],
    chartTitle: '',
    showDetail: false,
    analyzing: false,
    analysisHistory: [],
    // 状态透视
    statusBarText: '',
    statusBarType: 'status-info',
    statusBarIcon: '⏳',
    currentStep: 0,
    totalSteps: 0,
    // 图表
    isChartFloating: false,
    isChartMaskVisible: false,
    canvasNode: null,
    downloading: false,
    isChartRendering: false,
    chartWidth: 750,
    showChartHint: false,
    chartHint: '',
    showCorrelationHeatmap: false, // 相关矩阵热力图切换
    ec: {
      lazyLoad: true
    },
    floatingEc: {
      lazyLoad: true
    },
    // 环境
    isDesktop: false,
    // 配置面板
    configCollapsed: false,
    _isDataLoaded: false,
    // 详细数据表格
    detailTableData: { headers: [], rows: [] },
    // 数据版本戳（用于跨页面变更检测）
    _lastDataVersion: 0
  },

  async onLoad() {
    this.initEnvInfo();
    await this.initAnalysisTypes();
    this.loadAnalysisHistory();
    this.loadTableData();
  },

  onShow() {
    // 检测 sqlStore 数据是否在其他页面（如 dataParse）被更新
    const currentVersion = getDataVersion();
    if (!this.data._isDataLoaded || currentVersion !== this.data._lastDataVersion) {
      this.loadTableData();
      this.setData({ _lastDataVersion: currentVersion });
    }
  },

  onUnload() {
    if (this._runAnalysisTimeout) clearTimeout(this._runAnalysisTimeout);
  },

  onPullDownRefresh() {
    this.setData({ _isDataLoaded: false });
    this.loadTableData();
    wx.stopPullDownRefresh();
  },

  onShareAppMessage() {
    return { title: '冶金高炉过程数据分析', path: '/pages/analysis/analysis' };
  },

  // ============ 初始化 ============

  initEnvInfo() {
    const envInfo = envDetector.getEnvInfo();
    this.setData({ isDesktop: envInfo.isDesktop });
  },

  async initAnalysisTypes() {
    const fallbackTypes = [
      { type: 'basicInfo', name: '基本信息概览', category: '统计' },
      { type: 'numericalStats', name: '数值统计分析', category: '统计' },
      { type: 'outliers', name: '异常值检测', category: '质量', requiresTarget: true },
      { type: 'featureImportance', name: '特征重要性', category: '分析', requiresTarget: true },
      { type: 'permutationImportance', name: '排列重要性', category: '分析', requiresTarget: true },
      { type: 'correlation', name: '相关性分析', category: '分析', requiresTarget: true },
      { type: 'parameterGroup', name: '参数分组分析', category: '分析', requiresTarget: true },
      { type: 'featureSelection', name: '特征选择', category: '建模', requiresTarget: true },
      { type: 'preprocess', name: '数据预处理', category: '建模', requiresTarget: true },
      { type: 'standardize', name: '特征标准化', category: '建模' },
      { type: 'carbonEmission', name: '碳排放核算', category: '冶金' }
    ];
    try {
      const types = await workerManager.getAvailableAnalysisTypes();
      const analysisTypes = types.map(t => ({
        ...t,
        requiresTarget: ['outliers', 'featureImportance', 'permutationImportance', 'correlation', 'parameterGroup', 'featureSelection', 'preprocess', 'optimization', 'multiModelPrediction'].includes(t.type)
      }));
      this.setData({ analysisTypes });
    } catch (e) {
      this.setData({ analysisTypes: fallbackTypes });
    }
  },

  // ============ 数据加载 ============

  loadTableData() {
    try {
      const tableSchema = getTableSchema('analysis_data');
      if (tableSchema) {
        const queryResult = queryData('analysis_data');
        const tableData = queryResult.success ? queryResult.data : [];
        const numericalColumns = tableSchema.columns
          .filter(col => col.type === 'number')
          .map(col => col.name);
        this.setData({ tableSchema, tableData, numericalColumns, selectedTargetIndex: 0, _isDataLoaded: true });
        console.log('[loadTableData] completed, hasSchema=' + !!tableSchema + ', columns=' + (tableSchema?.columns?.length || 0) + ', dataRows=' + (tableData?.length || 0) + ', numericalCols=' + (numericalColumns?.length || 0));
      } else {
        this.setData({ tableSchema: null, tableData: [], numericalColumns: [], _isDataLoaded: true });
      }
    } catch (e) {
      console.error('加载表数据失败:', e);
      this.setData({ tableSchema: null, tableData: [], numericalColumns: [], _isDataLoaded: true });
      showToast('加载数据失败', '', 'error');
    }
  },

  // ============ 新版交互事件（分栏设计） ============

  /** 折叠/展开配置面板（移动端） */
  toggleConfigPanel() {
    this.setData({ configCollapsed: !this.data.configCollapsed });
  },

  /** 点击分析类型（Radio 列表） */
  selectAnalysisType(e) {
    console.log('[selectAnalysisType] clicked, index=' + (e.currentTarget?.dataset?.index));
    const index = Number(e.currentTarget.dataset.index);
    if (index === this.data.selectedAnalysisIndex) return; // 重复点击无需响应
    this.setData({
      selectedAnalysisIndex: index,
      analysisResult: null,
      summaryCards: [],
      showDetail: false,
      statusBarText: '',
      chartTitle: ''
    });
    // 视觉反馈：状态栏提示已选中类型
    const typeName = this.data.analysisTypes[index]?.name || '';
    this.setStatusBar(`已选择: ${typeName}，点击"开始分析"执行`, 'status-info', '✅');
    // 触觉反馈
    try {
      wx.vibrateShort({ type: 'light' });
    } catch (e) { /* ignore */ }
  },

  /** 点击目标列芯片 */
  selectTargetColumn(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ selectedTargetIndex: index, analysisResult: null, summaryCards: [] });
  },

  /** 点击分组列芯片 */
  selectGroupColumn(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ selectedGroupIndex: index, analysisResult: null, summaryCards: [] });
  },

  // ============ 兼容旧版 picker 事件（保留以防万一） ============
  onAnalysisTypeChange(e) {
    this.setData({ selectedAnalysisIndex: e.detail.value, analysisResult: null });
  },
  onTargetColumnChange(e) {
    this.setData({ selectedTargetIndex: e.detail.value });
  },
  onGroupColumnChange(e) {
    this.setData({ selectedGroupIndex: e.detail.value });
  },

  // ============ 状态透视工具方法 ============

  /** 更新状态透视条 */
  setStatusBar(text, type = 'status-info', icon = '⏳', step = 0, total = 0) {
    this.setData({
      statusBarText: text,
      statusBarType: type,
      statusBarIcon: icon,
      currentStep: step,
      totalSteps: total
    });
  },

  /** 按步骤广播分析进度 */
  async broadcastSteps(steps) {
    for (let i = 0; i < steps.length; i++) {
      this.setStatusBar(steps[i], 'status-loading', '⚙️', i + 1, steps.length);
      await new Promise(r => setTimeout(r, 120));
    }
  },

  // ============ 核心分析流程 ============

  runAnalysis() {
    console.log('[runAnalysis] START button clicked');
    if (this._runAnalysisTimeout) clearTimeout(this._runAnalysisTimeout);
    this._runAnalysisTimeout = setTimeout(async() => {
      const {
        tableData, analysisTypes, selectedAnalysisIndex,
        numericalColumns, selectedTargetIndex, selectedGroupIndex, isDesktop
      } = this.data;
      console.log('[runAnalysis] setTimeout callback entered, data: rows=' + (tableData || []).length + ', type=' + ((analysisTypes[selectedAnalysisIndex] || {}).type || '?') + ', isDesktop=' + isDesktop);

      if (!tableData?.length) {
        this.setStatusBar('暂无数据，请先导入 CSV 文件', 'status-error', '❌');
        return;
      }

      if (!analysisTypes || analysisTypes.length === 0 || !analysisTypes[selectedAnalysisIndex]) {
        this.setStatusBar('分析类型尚未加载', 'status-error', '❌');
        return;
      }
      const analysisType = analysisTypes[selectedAnalysisIndex].type;
      const steps = ANALYSIS_STEPS[analysisType] || ['执行分析计算'];

      try {
        this.setData({ analyzing: true, analysisResult: null, summaryCards: [], showDetail: false });
        console.log('[runAnalysis] step1: setData(analyzing=true) done');
        this.setStatusBar('准备数据...', 'status-loading', '⏳', 0, steps.length);

        await this.broadcastSteps(steps);
        console.log('[runAnalysis] step2: broadcastSteps completed, stepCount=' + steps.length);

        const options = {};
        if (analysisTypes[selectedAnalysisIndex].requiresTarget) {
          options.targetColumn = numericalColumns[selectedTargetIndex];
        }
        if (analysisType === 'standardize') options.featureColumns = numericalColumns;
        if (analysisType === 'parameterGroup') options.groupColumn = numericalColumns[selectedGroupIndex];
        if (isDesktop) {
          options.useAdvancedAnalysis = true; options.parallelProcessing = true;
        }

        const sampledData = this.sampleData(tableData, analysisType, isDesktop);
        console.log('[runAnalysis] step3: sampleData done, rows=' + sampledData.length);

        // 触觉反馈：让用户感知分析开始
        try {
          wx.vibrateShort({ type: 'medium' });
        } catch (e) { /* ignore */ }

        // 为碳排放核算从数据中提取实际参数
        if (analysisType === 'carbonEmission' && sampledData.length > 0) {
          const firstRow = sampledData[0];
          options.params = {};
          // 尝试从数据列名中提取碳排放相关参数
          const paramMapping = {
            'coke_weight': 'CR',
            'hotmetal_weight': 'HIR',
            'PC_weight': 'injection rate'
          };
          Object.entries(paramMapping).forEach(([paramKey, colName]) => {
            if (firstRow[colName] !== undefined) {
              options.params[paramKey] = parseFloat(firstRow[colName]) || 0;
            }
          });
        }

        console.log('[runAnalysis] step4: calling workerManager.analyze, type=' + analysisType + ', options.targetColumn=' + (options.targetColumn || 'none'));
        const result = await workerManager.analyze(sampledData, analysisType, options);
        console.log('[runAnalysis] step5: workerManager.analyze returned, resultKeys=' + Object.keys(result || {}).join(','));

        // 生成数据结构与摘要卡
        const cards = this.buildSummaryCards(result, analysisType);
        const title = analysisTypes[selectedAnalysisIndex].name;
        const detailTableData = this.buildDetailTableData(result, analysisType);

        // 合并为单次 setData，并在渲染完成后回调 renderChart
        this.setData({
          analysisResult: result,
          showDetail: false,
          summaryCards: cards,
          chartTitle: title,
          detailTableData
        }, async() => {
          console.log('[runAnalysis] step6: setData(analysisResult) completed rendering');

          // 渲染图表
          await this.renderChart(result, analysisType);
          console.log('[runAnalysis] step7: renderChart completed');

          this.addToHistory(result, analysisType);
          this.setStatusBar(`✅ ${title} 完成`, 'status-success', '✅');
          console.log('[runAnalysis] COMPLETED successfully');
        });

      } catch (err) {
        console.error('[runAnalysis] ERROR caught:', 'message=' + (err.message || 'unknown'), 'stack=' + (err.stack || 'no_stack'));
        this.setStatusBar('分析失败: ' + (err.message || '未知错误'), 'status-error', '❌');
        this.setData({ analyzing: false });
      } finally {
        this.setData({ analyzing: false });
      }
    }, 300);
  },

  /** 数据采样策略 */
  sampleData(data, analysisType, isDesktop = false) {
    const maxRows = isDesktop ? 5000 : 1000;
    if (data.length <= maxRows) return data;
    const indices = Array.from({ length: data.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, Math.min(data.length, maxRows)).map(i => data[i]);
  },

  /** 构建摘要卡片数据 */
  buildSummaryCards(result, type) {
    const cards = [];
    try {
      if (type === 'basicInfo' && result.shape) {
        cards.push({ icon: '📋', value: result.shape.rows, label: '数据行数' });
        cards.push({ icon: '📑', value: result.shape.columns, label: '参数列数' });
        cards.push({ icon: '🔢', value: (result.numericalColumns || []).length, label: '数值列' });
        cards.push({ icon: '🏷', value: (result.categoricalColumns || []).length, label: '分类列' });
      } else if (type === 'numericalStats' && result.stats) {
        // Bug Fix：补充数值统计摘要卡片
        const cols = result.numericalColumns || Object.keys(result.stats);
        cards.push({ icon: '🔢', value: cols.length, label: '数值列数' });
        if (cols.length > 0) {
          const firstCol = cols[0];
          const s = result.stats[firstCol];
          if (s) {
            cards.push({ icon: '📊', value: parseFloat(s.mean).toFixed(2), label: `${firstCol} 均值` });
            cards.push({ icon: '〰️', value: parseFloat(s.std).toFixed(2), label: `${firstCol} 标准差` });
            cards.push({ icon: '📐', value: `${s.min} ~ ${s.max}`, label: `${firstCol} 范围` });
          }
        }
      } else if (type === 'outliers' && result.outlierCount !== undefined) {

        cards.push({ icon: '⚠️', value: result.outlierCount, label: '异常点数' });
        cards.push({ icon: '📊', value: result.outlierPercentage + '%', label: '异常率' });
        cards.push({ icon: '📈', value: result.residualStats?.mean ? parseFloat(result.residualStats.mean).toFixed(2) : '-', label: '均值' });
        cards.push({ icon: '〰️', value: result.residualStats?.std ? parseFloat(result.residualStats.std).toFixed(2) : '-', label: '标准差' });
      } else if ((type === 'featureImportance' || type === 'permutationImportance') && (result.featureImportance || Array.isArray(result))) {
        const fi = result.featureImportance || result;
        cards.push({ icon: '🏆', value: fi[0]?.feature || '-', label: '最重要特征' });
        cards.push({ icon: '📏', value: fi.length, label: '特征总数' });
      } else if (type === 'correlation' && result.correlations?.length) {
        const top = result.correlations[0];
        cards.push({ icon: '🔗', value: top?.feature || '-', label: '最强相关' });
        cards.push({ icon: '📊', value: top?.correlation || '-', label: '相关系数' });
      } else if (type === 'carbonEmission' && result.result) {
        cards.push({ icon: '🌫️', value: parseFloat(result.result.direct_CO2_weight).toFixed(2), label: 'CO₂排放(kg)' });
        cards.push({ icon: '⛏', value: parseFloat(result.result.materials_brought_in_CO2).toFixed(2), label: '原料碳输入' });
        cards.push({ icon: '🔥', value: parseFloat(result.result.energy_brought_in_CO2).toFixed(2), label: '能源碳输入' });
        cards.push({ icon: '♻️', value: parseFloat(result.result.recovery_CO2).toFixed(2), label: '回收CO₂' });
      } else if (type === 'multiModelPrediction' && result.models?.length) {
        const m = result.models[0];
        cards.push({ icon: '📐', value: m.r2, label: 'R²得分' });
        cards.push({ icon: '📉', value: m.mse, label: 'MSE误差' });
        cards.push({ icon: '🧩', value: result.models.length, label: '模型数' });
        cards.push({ icon: '📊', value: result.featureImportance?.length || '-', label: '特征数' });
      } else if (type === 'standardize' && result.featureColumns) {
        cards.push({ icon: '📋', value: result.featureColumns.length, label: '标准化列数' });
        cards.push({ icon: '📊', value: result.standardizedData?.length || '-', label: '样本数' });
      } else if (type === 'preprocess' && result.originalData) {
        cards.push({ icon: '📥', value: result.originalData.length, label: '原始行数' });
        cards.push({ icon: '✅', value: result.cleanedData?.length || '-', label: '清洗后行数' });
        cards.push({ icon: '⚠️', value: result.outlierResult?.outlierCount || 0, label: '剔除异常值' });
        cards.push({ icon: '🏆', value: result.selectedFeatures?.length || '-', label: '选中特征数' });
      }
    } catch (e) { /* 忽略卡片构建异常 */ }
    return cards;
  },

  async renderChart(result, analysisType) {
    if (this.data.isChartRendering) return;
    this.setData({ isChartRendering: true });
    try {
      const chartComponent = this.selectComponent('#analysisChart');
      if (!chartComponent) {
        console.error('ECharts component #analysisChart not found');
        return;
      }

      const option = this.getEChartsOption(result, analysisType, false);
      if (!option) {
        console.warn('ECharts option is empty, skipping chart rendering');
        return;
      }

      if (chartComponent.chart) {
        chartComponent.chart.setOption(option, true);
        return;
      }

      chartComponent.init((canvas, width, height, dpr) => {
        const chart = echarts.init(canvas, null, {
          width: width,
          height: height,
          devicePixelRatio: dpr
        });
        chart.setOption(option);
        this.chartInstance = chart;
        return chart;
      });
    } catch (e) {
      console.error('图表渲染失败:', e);
      showToast('图表渲染失败: ' + e.message, '', 'error');
    } finally {
      this.setData({ isChartRendering: false });
    }
  },

  async renderFloatingChart(result, analysisType) {
    try {
      const chartComponent = this.selectComponent('#floating-analysisChart');
      if (!chartComponent) {
        console.error('ECharts component #floating-analysisChart not found');
        return;
      }

      const option = this.getEChartsOption(result, analysisType, true);
      if (!option) return;

      if (chartComponent.chart) {
        chartComponent.chart.setOption(option, true);
        return;
      }

      chartComponent.init((canvas, width, height, dpr) => {
        const chart = echarts.init(canvas, null, {
          width: width,
          height: height,
          devicePixelRatio: dpr
        });
        chart.setOption(option);
        this.floatingChartInstance = chart;
        return chart;
      });
    } catch (e) {
      showToast('图表渲染失败: ' + e.message, '', 'error');
    }
  },

  getEChartsOption(result, analysisType, isFloating = false) {
    if (!result) return null;

    // 1. Basic Info
    if (analysisType === 'basicInfo') {
      if (!result.shape) return null;
      return {
        title: { text: '数据集基本信息', left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: ['数据行数', '参数列数'] },
        yAxis: { type: 'value' },
        series: [{
          name: '数量',
          type: 'bar',
          barWidth: '40%',
          data: [result.shape.rows, result.shape.columns],
          itemStyle: { color: '#1890ff' }
        }]
      };
    }

    // 2. Numerical Stats
    if (analysisType === 'numericalStats') {
      if (!result.stats) return null;
      const cols = [];
      const means = [];
      Object.entries(result.stats).forEach(([col, stats]) => {
        if (stats.mean !== null && stats.mean !== undefined) {
          cols.push(col);
          means.push(parseFloat(stats.mean));
        }
      });
      return {
        title: { text: '各参数均值对比', left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '25%', containLabel: true },
        xAxis: { type: 'category', data: cols, axisLabel: { rotate: 45, interval: 0, fontSize: 10 } },
        yAxis: { type: 'value' },
        series: [{
          name: '均值',
          type: 'bar',
          data: means,
          itemStyle: { color: '#52c41a' }
        }],
        dataZoom: [{ type: 'inside' }]
      };
    }

    // 3. Outliers
    if (analysisType === 'outliers') {
      const numCol = this.data.numericalColumns[this.data.selectedTargetIndex] || this.data.numericalColumns[0];
      if (!numCol || !this.data.tableData?.length) return null;
      const normal = [];
      const outlier = [];
      this.data.tableData.forEach((row, idx) => {
        const pt = [idx, parseFloat(row[numCol]) || 0];
        if (result.outlierIndices?.includes(idx)) {
          outlier.push(pt);
        } else {
          normal.push(pt);
        }
      });
      return {
        title: { text: `${numCol} 异常值检测`, left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
        tooltip: {
          trigger: 'item',
          formatter: (params) => `样本 #${params.value[0]}<br/>值: ${params.value[1].toFixed(4)}`
        },
        legend: { data: ['正常数据', '异常数据'], bottom: 5 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: { type: 'value', name: '序号' },
        yAxis: { type: 'value', name: '指标' },
        series: [
          { name: '正常数据', type: 'scatter', data: normal, itemStyle: { color: '#4CAF50' }, symbolSize: 6 },
          { name: '异常数据', type: 'scatter', data: outlier, itemStyle: { color: '#F44336' }, symbolSize: 10 }
        ],
        dataZoom: [{ type: 'inside' }]
      };
    }

    // 4. Feature Importance
    if (analysisType === 'featureImportance') {
      const fi = result.featureImportance;
      if (!fi?.length) return null;
      const features = [];
      const importances = [];
      fi.forEach(item => {
        if (item.feature) {
          features.push(item.feature);
          importances.push(parseFloat(item.importance) || 0);
        }
      });
      const sorted = features.map((f, i) => ({ f, imp: importances[i] }))
        .sort((a, b) => a.imp - b.imp);
      return {
        title: { text: '特征重要性排名', left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: sorted.map(x => x.f) },
        series: [{
          name: '重要性',
          type: 'bar',
          data: sorted.map(x => x.imp),
          itemStyle: { color: '#1890ff' }
        }]
      };
    }

    // 5. Permutation Importance
    if (analysisType === 'permutationImportance') {
      if (!Array.isArray(result) || result.length === 0) return null;
      const sorted = [...result].reverse();
      return {
        title: { text: '排列重要性排名', left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: sorted.map(x => x.feature) },
        series: [{
          name: '排列重要性',
          type: 'bar',
          data: sorted.map(x => parseFloat(x.importance) || 0),
          itemStyle: { color: '#fa8c16' }
        }]
      };
    }

    // 6. Correlation
    if (analysisType === 'correlation') {
      if (this.data.showCorrelationHeatmap && result.correlationMatrix) {
        const matrix = result.correlationMatrix;
        const features = Object.keys(matrix);
        const heatmapData = [];
        features.forEach((f1, i) => {
          features.forEach((f2, j) => {
            const val = parseFloat(matrix[f1][f2]) || 0;
            heatmapData.push([j, i, val]);
          });
        });
        return {
          title: { text: '参数相关系数矩阵', left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
          tooltip: {
            position: 'top',
            formatter: (params) => {
              const xF = features[params.value[0]];
              const yF = features[params.value[1]];
              return `${xF} ↔ ${yF}<br/>相关系数: ${params.value[2].toFixed(4)}`;
            }
          },
          grid: { left: '5%', right: '5%', top: '15%', bottom: '20%', containLabel: true },
          xAxis: { type: 'category', data: features, axisLabel: { rotate: 45, interval: 0, fontSize: 8 } },
          yAxis: { type: 'category', data: features, axisLabel: { fontSize: 8 } },
          visualMap: {
            min: -1,
            max: 1,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '0%',
            itemHeight: 12,
            textStyle: { fontSize: 9 },
            inRange: {
              color: ['#313695', '#4575b4', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
            }
          },
          series: [{
            name: '相关系数',
            type: 'heatmap',
            data: heatmapData,
            label: {
              show: true,
              fontSize: 8,
              formatter: (params) => params.value[2].toFixed(2)
            }
          }]
        };
      }

      if (!result.correlations?.length) return null;
      const sorted = [...result.correlations].reverse();
      return {
        title: { text: `与 ${result.targetColumn || '目标'} 相关性`, left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: sorted.map(x => x.feature) },
        series: [{
          name: '相关系数',
          type: 'bar',
          data: sorted.map(x => parseFloat(x.correlation) || 0),
          itemStyle: {
            color: (params) => params.value >= 0 ? '#f5222d' : '#1890ff'
          }
        }]
      };
    }

    // 7. Parameter Group
    if (analysisType === 'parameterGroup') {
      if (!result || !Object.keys(result).length) return null;
      const firstKey = Object.keys(result)[0];
      const groupData = result[firstKey];
      if (!groupData?.stats) return null;
      const groupKeys = Object.keys(groupData.stats);
      const metricKeys = Object.keys(groupData.stats[groupKeys[0]] || {});
      if (!metricKeys.length) return null;
      const metric = metricKeys[0];
      const metricData = groupKeys.map(k => parseFloat(groupData.stats[k][metric]?.mean || 0));
      return {
        title: { text: `${firstKey} 分组分析`, left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: groupKeys },
        yAxis: { type: 'value' },
        series: [{
          name: metric,
          type: 'bar',
          data: metricData,
          itemStyle: { color: '#722ed1' }
        }]
      };
    }

    // 8. Feature Selection
    if (analysisType === 'featureSelection') {
      if (!result.featureScores?.length) return null;
      const features = [];
      const scores = [];
      result.featureScores.forEach(x => {
        features.push(x.feature);
        scores.push(parseFloat(x.score) || 0);
      });
      return {
        title: { text: '特征价值评估', left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '25%', containLabel: true },
        xAxis: { type: 'category', data: features, axisLabel: { rotate: 45 } },
        yAxis: { type: 'value' },
        series: [{
          name: '评估得分',
          type: 'bar',
          data: scores,
          itemStyle: {
            color: (params) => {
              const feat = features[params.dataIndex];
              return result.selectedFeatures?.includes(feat) ? '#52c41a' : '#bfbfbf';
            }
          }
        }],
        dataZoom: [{ type: 'inside' }]
      };
    }

    // 9. Preprocess
    if (analysisType === 'preprocess') {
      if (!result.cleanedData?.length) return null;
      const numCol = this.data.numericalColumns[this.data.selectedTargetIndex] || this.data.numericalColumns[0];
      if (!numCol) return null;
      const original = result.originalData.map(row => parseFloat(row[numCol]) || 0);
      const cleaned = result.cleanedData.map(row => parseFloat(row[numCol]) || 0);
      const limit = isFloating ? 200 : 100;
      const slicedOriginal = original.slice(0, limit);
      const slicedCleaned = cleaned.slice(0, limit);
      const xAxis = Array.from({ length: Math.max(slicedOriginal.length, slicedCleaned.length) }, (_, i) => i.toString());
      return {
        title: { text: `${numCol} 预处理对比 (前 ${limit} 样本)`, left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
        tooltip: { trigger: 'axis' },
        legend: { data: ['原始数据', '清洗数据'], bottom: 5 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: xAxis },
        yAxis: { type: 'value' },
        series: [
          { name: '原始数据', type: 'line', data: slicedOriginal, itemStyle: { color: '#ff4d4f' }, symbol: 'none' },
          { name: '清洗数据', type: 'line', data: slicedCleaned, itemStyle: { color: '#52c41a' }, symbol: 'none' }
        ],
        dataZoom: [{ type: 'inside' }]
      };
    }

    // 10. Optimization
    if (analysisType === 'optimization') {
      if (!result.topFeatures) return null;
      const { topFeatures, featureImportance } = result;
      const importances = featureImportance?.length ?
        topFeatures.map(f => {
          const item = featureImportance.find(x => x.feature === f); return item ? item.importance : 0;
        }) :
        topFeatures.map((_, i) => 1.0 - i * 0.2);
      return {
        title: { text: '关键参数优化重要性', left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '25%', containLabel: true },
        xAxis: { type: 'category', data: topFeatures, axisLabel: { rotate: 45 } },
        yAxis: { type: 'value' },
        series: [{
          name: '相对重要性',
          type: 'bar',
          data: importances,
          itemStyle: { color: '#fa8c16' }
        }]
      };
    }

    // 11. Standardize
    if (analysisType === 'standardize') {
      if (!result.standardizedData?.length || !result.featureColumns?.length) return null;
      const col = result.featureColumns[0];
      const data = result.standardizedData.slice(0, 100).map(row => parseFloat(row[col]) || 0);
      return {
        title: { text: `${col} 标准化值 (前100样本)`, left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: data.map((_, i) => i.toString()) },
        yAxis: { type: 'value' },
        series: [{
          name: col,
          type: 'bar',
          data,
          itemStyle: { color: '#13c2c2' }
        }],
        dataZoom: [{ type: 'inside' }]
      };
    }

    // 12. Carbon Emission
    if (analysisType === 'carbonEmission') {
      if (!result.result) return null;
      const r = result.result;
      const keys = ['直接CO₂', '能源带入', '原料带入', '产品带出', '回收CO₂'];
      const values = [r.direct_CO2_weight, r.energy_brought_in_CO2, r.materials_brought_in_CO2, r.taken_out_CO2, r.recovery_CO2].map(v => parseFloat(v) || 0);
      const pieData = keys.map((k, i) => ({ value: values[i], name: k }));
      return {
        title: { text: '高炉碳排放构成核算', left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
        tooltip: { trigger: 'item', formatter: '{a} <br/>{b}: {c} kg ({d}%)' },
        legend: { bottom: 0, left: 'center', textStyle: { fontSize: 10 } },
        series: [{
          name: 'CO₂排放贡献',
          type: 'pie',
          radius: ['35%', '65%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: isFloating,
            position: 'outside',
            formatter: '{b}: {c}kg'
          },
          data: pieData
        }]
      };
    }

    // 13. MultiModel Prediction
    if (analysisType === 'multiModelPrediction') {
      if (!result.models?.length || !result.actualValues) return null;
      const limit = isFloating ? 50 : 25;
      const actual = result.actualValues.slice(0, limit).map(v => parseFloat(v) || 0);
      const xAxis = actual.map((_, i) => `样本 ${i + 1}`);
      const series = [{
        name: '实际值',
        type: 'line',
        data: actual,
        symbolSize: 6,
        showSymbol: true,
        itemStyle: { color: '#ff4d4f' },
        lineStyle: { width: 3, type: 'dashed' }
      }];
      const colors = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#13c2c2'];
      result.models.forEach((m, idx) => {
        const pred = (m.predictions || []).slice(0, limit).map(v => parseFloat(v) || 0);
        series.push({
          name: m.name === 'Ensemble' ? '集成模型' : m.name,
          type: 'line',
          data: pred,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: colors[idx % colors.length] },
          lineStyle: { width: 2 }
        });
      });
      return {
        title: { text: `模型预测 vs 实际值 (前 ${limit} 样本)`, left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
        tooltip: { trigger: 'axis' },
        legend: { data: series.map(x => x.name), bottom: 0, textStyle: { fontSize: 10 } },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: xAxis },
        yAxis: { type: 'value', name: '生产率' },
        series,
        dataZoom: [{ type: 'inside' }]
      };
    }

    // Fallback default chart
    const col = this.data.numericalColumns[this.data.selectedTargetIndex] || this.data.numericalColumns[0];
    if (!col || !this.data.tableData?.length) {
      return {
        title: { text: '暂无可显示的数据', left: 'center', textStyle: { fontSize: 13, color: '#999' } }
      };
    }
    const data = this.data.tableData.slice(0, 30).map(row => parseFloat(row[col]) || 0);
    return {
      title: { text: `${col} 趋势图 (前30样本)`, left: 'center', textStyle: { fontSize: isFloating ? 16 : 13 } },
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', data: data.map((_, i) => i.toString()) },
      yAxis: { type: 'value' },
      series: [{
        name: col,
        type: 'line',
        data,
        itemStyle: { color: '#1890ff' }
      }]
    };
  },

  // ============ 图表交互 ============

  async onChartClick() {
    if (!this.data.analysisResult) return;
    const { analysisTypes, selectedAnalysisIndex } = this.data;
    if (!analysisTypes || analysisTypes.length === 0 || !analysisTypes[selectedAnalysisIndex]) return;
    try {
      this.setData({ isChartFloating: true, isChartMaskVisible: true });
      await new Promise(r => setTimeout(r, 50));
      const type = analysisTypes[selectedAnalysisIndex].type;
      await this.renderFloatingChart(this.data.analysisResult, type);
    } catch (e) {
      this.setData({ isChartFloating: false, isChartMaskVisible: false });
    }
  },

  onCloseFloatingChart() {
    this.setData({ isChartFloating: false, isChartMaskVisible: false });
  },
  onMaskClick() {
    this.onCloseFloatingChart();
  },

  downloadChart() {
    const chartComponent = this.selectComponent('#analysisChart');
    if (!chartComponent) {
      showToast('请先运行分析', '', 'error');
      return;
    }
    this.setData({ downloading: true });

    chartComponent.canvasToTempFilePath({
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            showToast('图表已保存到相册', '', 'success');
          },
          fail: (err) => {
            showToast('保存失败: ' + err.errMsg, '', 'error');
          },
          complete: () => {
            this.setData({ downloading: false });
          }
        });
      },
      fail: (err) => {
        showToast('导出图表失败: ' + err.errMsg, '', 'error');
        this.setData({ downloading: false });
      }
    });
  },

  toggleDetail() {
    this.setData({ showDetail: !this.data.showDetail });
  },

  /** 切换相关矩阵热力图/条形图 */
  toggleCorrelationHeatmap() {
    this.setData({
      showCorrelationHeatmap: !this.data.showCorrelationHeatmap
    }, () => {
      if (this.data.analysisResult) {
        this.renderChart(this.data.analysisResult, 'correlation');
      }
    });
  },

  /** 导出分析结果为 JSON 文件 */
  exportResult() {
    if (!this.data.analysisResult) {
      showToast('暂无结果可导出', '', 'error'); return;
    }
    try {
      const typeName = this.data.analysisTypes[this.data.selectedAnalysisIndex]?.name || 'result';
      const content = JSON.stringify(this.data.analysisResult, null, 2);
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/analysis_${Date.now()}.json`;
      fs.writeFileSync(filePath, content, 'utf8');
      wx.shareFileMessage({
        filePath,
        fileName: `${typeName}_分析结果.json`,
        fail: () => {
          wx.setClipboardData({
            data: content.slice(0, 10000),
            success: () => showToast('结果已复制到剪贴板', '', 'success')
          });
        }
      });
    } catch (e) {
      showToast('导出失败: ' + (e.message || ''), '', 'error');
    }
  },

  /** 构建详细数据表格（按分析类型适配） */
  buildDetailTableData(result, type) {
    try {
      if (type === 'basicInfo' && result.columns) {
        return {
          headers: ['列名', '数据类型', '列类别'],
          rows: result.columns.map(col => [
            col,
            result.dataTypes?.[col] || '-',
            (result.numericalColumns || []).includes(col) ? '数值型' : '分类型'
          ])
        };
      }
      if (type === 'numericalStats' && result.stats) {
        const cols = result.numericalColumns || Object.keys(result.stats);
        return {
          headers: ['参数', '均值', '标准差', '最小值', '25%', '中位数', '75%', '最大值', '计数'],
          rows: cols.map(col => {
            const s = result.stats[col] || {};
            return [col, s.mean || '-', s.std || '-', s.min || '-', s['25%'] || '-', s['50%'] || '-', s['75%'] || '-', s.max || '-', s.count || '-'];
          })
        };
      }
      if (type === 'outliers') {
        if (result.outlierIndices?.length === 0) return { headers: ['检测结果'], rows: [['未发现异常值']] };
        return {
          headers: ['样本序号', '偏差(绝对值)'],
          rows: (result.outlierIndices || []).map((idx) => [
            idx,
            result.residuals ? parseFloat(result.residuals[idx]).toFixed(4) : '-'
          ])
        };
      }
      if ((type === 'featureImportance' || type === 'permutationImportance')) {
        const fi = result.featureImportance || (Array.isArray(result) ? result : []);
        return {
          headers: ['排名', '特征名称', '重要性得分'],
          rows: fi.map((item, i) => [i + 1, item.feature || '-', parseFloat(item.importance || 0).toFixed(4)])
        };
      }
      if (type === 'correlation' && result.correlations) {
        return {
          headers: ['特征', '相关系数', '|相关系数|'],
          rows: result.correlations.map(item => [item.feature, item.correlation, item.absoluteCorrelation])
        };
      }
      if (type === 'featureSelection' && result.featureScores) {
        return {
          headers: ['特征', '得分', '是否选中'],
          rows: result.featureScores.map(item => [
            item.feature,
            parseFloat(item.importance || 0).toFixed(4),
            (result.selectedFeatures || []).includes(item.feature) ? '✅ 选中' : '❌ 未选'
          ])
        };
      }
      if (type === 'preprocess') {
        return {
          headers: ['指标', '数值'],
          rows: [
            ['原始数据行数', result.originalData?.length || '-'],
            ['清洗后数据行数', result.cleanedData?.length || '-'],
            ['异常值数量', result.outlierResult?.outlierCount || '-'],
            ['异常率', (result.outlierResult?.outlierPercentage || '-') + '%'],
            ['选中特征数', (result.selectedFeatures || []).length],
            ['选中特征', (result.selectedFeatures || []).join(', ') || '-']
          ]
        };
      }
      if (type === 'standardize' && result.featureColumns) {
        const cols = result.featureColumns.slice(0, 6);
        return {
          headers: ['样本', ...cols],
          rows: (result.standardizedData || []).slice(0, 30).map((row, i) => [
            i + 1, ...cols.map(c => parseFloat(row[c] || 0).toFixed(3))
          ])
        };
      }
      if (type === 'carbonEmission' && result.result) {
        const r = result.result;
        return {
          headers: ['碳流向', '数值(kg)'],
          rows: [
            ['直接CO₂排放', r.direct_CO2_weight],
            ['能源带入CO₂', r.energy_brought_in_CO2],
            ['原辅料带入CO₂', r.materials_brought_in_CO2],
            ['产品带出CO₂', r.taken_out_CO2],
            ['回收CO₂', r.recovery_CO2],
            ['焦炭碳重', r.coke_C_weight],
            ['煤粉碳重', r.PC_C_weight],
            ['溶剂碳重', r.flux_C_weight],
            ['铁水碳重', r.hotmetal_C_weight]
          ]
        };
      }
      if (type === 'multiModelPrediction' && result.models) {
        return {
          headers: ['模型名称', 'R²决定系数', 'MSE均方误差'],
          rows: (result.models || []).map(m => [m.name, m.r2, m.mse])
        };
      }
      if (type === 'parameterGroup') {
        const firstKey = Object.keys(result)[0];
        const groupData = result[firstKey];
        if (!groupData?.stats) return { headers: [], rows: [] };
        const groupKeys = Object.keys(groupData.stats);
        const metricKey = groupKeys[0] ? Object.keys(groupData.stats[groupKeys[0]])[0] : null;
        if (!metricKey) return { headers: [], rows: [] };
        return {
          headers: [firstKey, `${metricKey}均值`, `${metricKey}最大`, `${metricKey}最小`],
          rows: groupKeys.map(k => {
            const s = groupData.stats[k][metricKey] || {};
            return [k, parseFloat(s.mean || 0).toFixed(2), parseFloat(s.max || 0).toFixed(2), parseFloat(s.min || 0).toFixed(2)];
          })
        };
      }
      if (type === 'optimization' && result.topFeatures) {
        return {
          headers: ['关键参数', '相对重要性'],
          rows: result.topFeatures.map((f, i) => {
            const imp = result.featureImportance?.find(x => x.feature === f)?.importance || (1.0 - i * 0.2);
            return [f, parseFloat(imp).toFixed(4)];
          })
        };
      }
    } catch (e) {
      console.error('buildDetailTableData error:', e);
    }
    return { headers: [], rows: [] };
  },

  // ============ 历史记录 ============

  loadAnalysisHistory() {
    const history = wx.getStorageSync('analysisHistory') || [];
    this.setData({ analysisHistory: history });
  },

  addToHistory(result, analysisType) {
    const history = this.data.analysisHistory;
    const name = this.data.analysisTypes.find(t => t.type === analysisType)?.name || analysisType;
    const item = { id: Date.now().toString(), type: name, result: safeSerialize(result), time: formatDateTime(new Date(), 'YYYY-MM-DD HH:mm:ss') };
    history.unshift(item);
    if (history.length > 10) history.pop();
    this.setData({ analysisHistory: history });
    wx.setStorageSync('analysisHistory', history);
  },

  loadHistoryResult(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.analysisHistory[index];
    if (!item) return;
    const type = this.data.analysisTypes.find(t => t.name === item.type)?.type || 'basicInfo';
    // 同步左侧分析类型高亮
    const typeIndex = this.data.analysisTypes.findIndex(t => t.name === item.type);

    let resultObj = item.result;
    if (typeof resultObj === 'string') {
      try {
        resultObj = JSON.parse(resultObj);
      } catch (err) {
        console.error('解析历史数据失败:', err);
      }
    }

    const cards = this.buildSummaryCards(resultObj, type);
    const detailTableData = this.buildDetailTableData(resultObj, type);
    this.setData({
      analysisResult: resultObj,
      showDetail: false,
      chartTitle: item.type,
      summaryCards: cards,
      detailTableData,
      selectedAnalysisIndex: typeIndex >= 0 ? typeIndex : this.data.selectedAnalysisIndex
    }, () => {
      this.renderChart(resultObj, type);
      this.setStatusBar(`已载入历史: ${item.type}`, 'status-success', '🕐');
    });
  },

  // ============ 导航 ============

  navigateToDataParse() {
    wx.navigateTo({ url: '/pages/dataParse/dataParse', fail: () => showToast('导航失败', '', 'error') });
  },

  // ============ 结果概览（预留扩展点） ============
  updateResultOverview(result, analysisType) {
    console.log('updateResultOverview:', analysisType);
  }
});
