/**
 * ============================================
 *  算法全面测试 - 冶金高炉过程数据分析系统
 * ============================================
 * 
 * 测试所有28+算法的正确性。
 * 运行方式: node api/test_algorithms.js
 */

// ============ Babel 运行时转译 (支持 ES Module) ============
require('@babel/register')({
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
});

// ============ 导入 ============
const api = require('./index');

// 直接导入模型类 (因为 ModelFactory 动态导入在 Node.js 中需 Babel)
const LinearRegression = require('../utils/models/linearRegression.js').default;
const DecisionTree = require('../utils/models/decisionTree.js').default;
const RandomForest = require('../utils/models/randomForest.js').default;
const GradientBoosting = require('../utils/models/gradientBoosting.js').default;
const SupportVectorRegression = require('../utils/models/supportVectorRegression.js').default;
const ModelEvaluator = require('../utils/models/modelEvaluator.js').default;
const ModelIntegrator = require('../utils/models/modelIntegrator.js').default;
const ParameterOptimizer = require('../utils/models/parameterOptimizer.js').default;

// ============ 工具 ============

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    process.stdout.write('  ✅ ');
  } else {
    failed++;
    failures.push(message);
    process.stdout.write('  ❌ ');
  }
  console.log(message);
}

function assertApprox(actual, expected, tolerance = 0.01, message) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, `${message} (expected=${expected}, actual=${actual}, diff=${diff})`);
}

function assertNotEmpty(obj, message) {
  assert(obj !== null && obj !== undefined, `${message}: is null/undefined`);
  if (obj && typeof obj === 'object') {
    assert(Object.keys(obj).length > 0, `${message}: empty object`);
  }
}

function title(text) {
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  ${text}`);
  console.log(`═══════════════════════════════════════════`);
}

function subtitle(text) {
  console.log(`\n  --- ${text} ---`);
}

// ============ 测试数据 ============

// 线性关系数据: target = 10 + 2*feature1 + 3*feature2 + noise, feature3 独立
const linearData = [];
for (let i = 0; i < 50; i++) {
  const f1 = Math.random() * 10;
  const f2 = Math.random() * 5;
  const f3 = Math.random() * 8;
  const noise = (Math.random() - 0.5) * 0.5;
  linearData.push({
    feature1: parseFloat(f1.toFixed(4)),
    feature2: parseFloat(f2.toFixed(4)),
    feature3: parseFloat(f3.toFixed(4)),
    target: parseFloat((10 + 2 * f1 + 3 * f2 + 0.5 * f3 + noise).toFixed(4))
  });
}

// 非线性数据: target = sin(feature1) + cos(feature2) + noise
const nonlinearData = [];
for (let i = 0; i < 50; i++) {
  const f1 = Math.random() * 6.28;
  const f2 = Math.random() * 6.28;
  const noise = (Math.random() - 0.5) * 0.2;
  nonlinearData.push({
    feature1: parseFloat(f1.toFixed(4)),
    feature2: parseFloat(f2.toFixed(4)),
    target: parseFloat((Math.sin(f1) + Math.cos(f2) + noise).toFixed(4))
  });
}

// 简单数据集（特征间独立，无共线性）
const simpleData = [
  { id: 1, feature1: 1.0, feature2: 5.0, feature3: 3.0, target: 10.0 },
  { id: 2, feature1: 2.0, feature2: 1.0, feature3: 9.0, target: 12.0 },
  { id: 3, feature1: 3.0, feature2: 8.0, feature3: 1.0, target: 14.0 },
  { id: 4, feature1: 4.0, feature2: 3.0, feature3: 7.0, target: 16.0 },
  { id: 5, feature1: 5.0, feature2: 9.0, feature3: 4.0, target: 18.0 },
  { id: 6, feature1: 6.0, feature2: 2.0, feature3: 8.0, target: 20.0 },
  { id: 7, feature1: 7.0, feature2: 7.0, feature3: 2.0, target: 22.0 },
  { id: 8, feature1: 8.0, feature2: 4.0, feature3: 6.0, target: 24.0 },
  { id: 9, feature1: 9.0, feature2: 6.0, feature3: 5.0, target: 26.0 },
  { id: 10, feature1: 10.0, feature2: 10.0, feature3: 10.0, target: 28.0 },
];

const sampleData = api.utils.createSampleData(20, 5);

// ============ 测试开始 ============

console.log('\n🔥 冶金高炉过程数据分析系统 - 全面算法测试');
console.log('='.repeat(55));

// ==========================================
// 1. 统计信息测试
// ==========================================
title('1. 统计信息 (Statistics)');

subtitle('1.1 基本信息概览 (basicInfo)');
{
  const r = api.statistics.basicInfo(simpleData);
  assert(r.success === true, 'basicInfo 执行成功');
  assert(r.data.shape.rows === 10, '行数 = 10');
  assert(r.data.shape.columns === 5, '列数 = 5');
  assert(r.data.numericalColumns.length >= 3, '有数值列');
  assert(Array.isArray(r.data.columns), 'columns 是数组');
}

subtitle('1.2 数值统计 (numericalStats)');
{
  const r = api.statistics.numericalStats(simpleData);
  assert(r.success === true, 'numericalStats 执行成功');
  assert(r.data.numericalColumns.length >= 3, '有数值列');
  assert(r.data.stats['target'] !== undefined, 'target 列有统计');
  assert(r.data.stats['target'].mean !== undefined, '有 mean 值');
  assert(r.data.stats['target'].min !== undefined, '有 min 值');
  assert(r.data.stats['target'].max !== undefined, '有 max 值');
}

subtitle('1.3 缺失值统计 (missingStats)');
{
  const dataWithMissing = [
    { a: 1, b: 'x' }, { a: null, b: 'y' }, { a: 3, b: '' }, { a: 4, b: 'z' }
  ];
  const r = api.statistics.missingStats(dataWithMissing);
  assert(r.success === true, 'missingStats 执行成功');
  assert(r.data.hasMissingValues === true, '检测到缺失值');
}

subtitle('1.4 分类变量统计 (categoricalStats)');
{
  const dataWithCat = [
    { a: 1, cat: 'A' }, { a: 2, cat: 'B' }, { a: 3, cat: 'A' }, { a: 4, cat: 'C' }
  ];
  const r = api.statistics.categoricalStats(dataWithCat);
  assert(r.success === true, 'categoricalStats 执行成功');
  assert(r.data.categoricalColumns.includes('cat'), 'cat 被识别为分类列');
}

// ==========================================
// 2. 数据质量测试
// ==========================================
title('2. 数据质量 (Quality)');

subtitle('2.1 异常值检测 (detectOutliers)');
{
  const r = api.quality.detectOutliers(simpleData, 'target');
  assert(r.success === true, 'detectOutliers 执行成功');
  assert(typeof r.data.outlierCount === 'number', 'outlierCount 是数字');
  assert(typeof r.data.outlierPercentage === 'string', 'outlierPercentage 是字符串');
  assert(typeof r.data.outlierIndices !== 'undefined', '有 outlierIndices');
}

// ==========================================
// 3. 特征分析测试
// ==========================================
title('3. 特征分析 (Features)');

subtitle('3.1 特征重要性 (featureImportance)');
{
  const r = api.features.importance(linearData, 'target');
  assert(r.success === true, 'featureImportance 执行成功');
  assert(r.data.featureImportance.length >= 2, '有特征重要性结果');
  assert(r.data.selectedFeatures.length >= 1, '选择了重要特征');
}

subtitle('3.2 排列重要性 (permutationImportance)');
{
  const r = api.features.permutationImportance(simpleData, 'target');
  assert(r.success === true, 'permutationImportance 执行成功');
  assert(Array.isArray(r.data), '结果是数组');
  if (r.data.length > 0) {
    assert(r.data[0].feature !== undefined, '有 feature 字段');
    assert(typeof r.data[0].importance === 'number', '有 importance 值');
  }
}

subtitle('3.3 相关性分析 (correlation)');
{
  const r = api.features.correlation(simpleData, 'target');
  assert(r.success === true, 'correlation 执行成功');
  assert(r.data.correlations.length >= 1, '有相关性结果');
  assert(r.data.correlationMatrix !== undefined, '有相关矩阵');
  assert(r.data.targetColumn === 'target', '目标列正确');
}

subtitle('3.4 特征选择 (selectFeatures)');
{
  const r = api.features.selectFeatures(linearData, 'target');
  assert(r.success === true, 'selectFeatures 执行成功');
  assert(Array.isArray(r.data.selectedFeatures), 'selectedFeatures 是数组');
  assert(r.data.originalFeatures.length >= 2, '有原始特征列表');
}

subtitle('3.5 边际效应分析 (marginalEffect)');
{
  const r = api.features.marginalEffect(simpleData, 'target');
  assert(r.success === true, 'marginalEffect 执行成功');
  assert(r.data.marginalEffects.length >= 1, '有边际效应结果');
  assert(r.data.marginalEffects[0].predictions.length >= 50, '预测点数量 >= 50');
}

// ==========================================
// 4. 分组分析测试
// ==========================================
title('4. 分组分析 (Grouping)');

subtitle('4.1 参数分组分析 (parameterGroup)');
{
  const r = api.grouping.parameterGroup(simpleData, 'target', ['feature1']);
  assert(r.success === true, 'parameterGroup 执行成功');
  assert(Object.keys(r.data).length >= 1, '有分组结果');
}

subtitle('4.2 详细参数分组分析 (detailedParameterGroup)');
{
  const r = api.grouping.detailedParameterGroup(simpleData, 'target', ['feature1']);
  assert(r.success === true, 'detailedParameterGroup 执行成功');
  assert(r.data.analysisResults !== undefined, '有分析结果');
}

// ==========================================
// 5. 数据预处理测试
// ==========================================
title('5. 数据预处理 (Preprocess)');

subtitle('5.1 标准预处理流水线 (standard)');
{
  const r = api.preprocess.standard(linearData, 'target');
  assert(r.success === true, 'standard preprocess 执行成功');
  assert(r.data.originalData.length >= 10, '有原始数据');
  assert(r.data.cleanedData.length >= 1, '有清洗后数据');
  assert(r.data.selectedFeatures.length >= 1, '有选择的特征');
}

subtitle('5.2 特征标准化 (standardize)');
{
  const cols = ['feature1', 'feature2'];
  const r = api.preprocess.standardize(simpleData, cols);
  assert(r.success === true, 'standardize 执行成功');
  assert(r.data.standardizedData.length === simpleData.length, '标准化后数据行数不变');
  assert(r.data.stats['feature1'] !== undefined, '有 feature1 的统计');
}

subtitle('5.3 自定义预处理 (custom)');
{
  const r = api.preprocess.custom(simpleData, {
    targetColumn: 'target',
    removeOutliers: true,
    featureSelection: true,
    standardize: true,
    outlierOptions: { method: 'iqr' }
  });
  assert(r.success === true, 'custom preprocess 执行成功');
  assert(r.data.steps.length >= 1, '有处理步骤记录');
}

subtitle('5.4 预处理配置生成 (generateConfig)');
{
  const r = api.preprocess.generateConfig({ targetColumn: 'test' });
  assert(r.success === true, 'generateConfig 执行成功');
  assert(r.data.targetColumn === 'test', 'targetColumn 被正确设置');
}

// ==========================================
// 6. 机器学习模型测试
// ==========================================
title('6. 机器学习模型 (ML Models)');

// 准备训练数据
const X = simpleData.map(r => [r.feature1, r.feature2, r.feature3]);
const y = simpleData.map(r => r.target);

const X_linear = linearData.map(r => [r.feature1, r.feature2, r.feature3]);
const y_linear = linearData.map(r => r.target);

subtitle('6.1 线性回归 (LinearRegression)');
{
  const model = new LinearRegression();
  model.fit(X_linear, y_linear);
  const preds = model.predict(X_linear);
  assert(model.isTrained === true, '模型已训练');
  assert(preds.length === y_linear.length, '预测数量正确');

  // 评估
  const evaluator = new ModelEvaluator();
  const result = evaluator.evaluate(model, X_linear, y_linear, ['mse', 'r2']);
  assert(parseFloat(result.r2) > 0.9, `R² > 0.9 (actual: ${result.r2})`);
  assert(parseFloat(result.mse) < 1.0, `MSE < 1.0 (actual: ${result.mse})`);

  // 特征重要性
  const importance = model.getFeatureImportance();
  assert(importance.length > 0, '有特征重要性');

  // 序列化
  const state = model.getState();
  assert(state.isTrained === true, '序列化保留训练状态');
  assert(state.params !== undefined, '序列化保留参数');
}

subtitle('6.2 决策树 (DecisionTree)');
{
  const model = new DecisionTree({ maxDepth: 5 });
  model.fit(X, y);
  const preds = model.predict(X);
  assert(model.isTrained === true, '模型已训练');
  assert(preds.length === y.length, '预测数量正确');

  const evaluator = new ModelEvaluator();
  const result = evaluator.evaluate(model, X, y, ['mse', 'r2']);
  assert(parseFloat(result.r2) > 0.9, `决策树 R² > 0.9 (actual: ${result.r2})`);

  // 克隆
  const clone = model.clone();
  assert(clone.isTrained === true, '克隆也保持训练状态');
}

subtitle('6.3 随机森林 (RandomForest)');
{
  const model = new RandomForest({ nEstimators: 10, maxDepth: 10 });
  model.fit(X_linear, y_linear);
  const preds = model.predict(X_linear);
  assert(model.isTrained === true, '模型已训练');
  assert(preds.length === y_linear.length, '预测数量正确');

  const evaluator = new ModelEvaluator();
  const result = evaluator.evaluate(model, X_linear, y_linear, ['mse', 'r2']);
  assert(parseFloat(result.r2) > 0.9, `随机森林 R² > 0.9 (actual: ${result.r2})`);

  // 单棵树预测
  const treePreds = model.getIndividualTreePredictions(X_linear);
  assert(treePreds.length === 10, '10棵树各自有预测');
}

subtitle('6.4 梯度提升 (GradientBoosting)');
{
  const model = new GradientBoosting({ nEstimators: 5, learningRate: 0.1, maxDepth: 3 });
  model.fit(X, y);
  const preds = model.predict(X);
  assert(model.isTrained === true, '模型已训练');
  assert(preds.length === y.length, '预测数量正确');

  // 置信度
  const conf = model.calculateConfidence([5, 6, 7]);
  assert(typeof conf === 'number', '有置信度');
  assert(conf >= 0 && conf <= 1, '置信度在 [0,1] 范围');
}

subtitle('6.5 支持向量回归 (SVR)');
{
  const model = new SupportVectorRegression({ kernel: 'linear', C: 100.0 });
  model.fit(X_linear, y_linear);
  const preds = model.predict(X_linear);
  assert(model.isTrained === true, '模型已训练');
  assert(preds.length === y_linear.length, '预测数量正确');

  const evaluator = new ModelEvaluator();
  const result = evaluator.evaluate(model, X_linear, y_linear, ['mse', 'r2']);
  assert(parseFloat(result.r2) > 0.8, `SVR R² > 0.8 (actual: ${result.r2})`);

  // 不同核函数
  const rbfModel = new SupportVectorRegression({ kernel: 'rbf', gamma: 'auto' });
  rbfModel.fit(X_linear, y_linear);
  assert(rbfModel.isTrained === true, 'RBF核SVR训练成功');
}

// ==========================================
// 7. 模型评估测试
// ==========================================
title('7. 模型评估 (Evaluation)');

subtitle('7.1 模型评估');
{
  const model = new LinearRegression();
  model.fit(X_linear, y_linear);

  const r = api.evaluation.evaluate(model, X_linear, y_linear);
  assert(r.success === true, 'evaluate 执行成功');
  assert(r.data.mse !== undefined, '有 MSE');
  assert(r.data.r2 !== undefined, '有 R²');
  assert(r.data.rmse !== undefined, '有 RMSE');
}

subtitle('7.2 交叉验证');
{
  const model = new LinearRegression();
  const r = api.evaluation.crossValidate(model, X, y, 3);
  assert(r.success === true, 'crossValidate 执行成功');
  if (r.success) {
    assert(r.data.mse !== undefined, 'CV 有 MSE');
    assert(r.data.mse_std !== undefined, 'CV 有 MSE std');
  }
}

subtitle('7.3 多模型对比');
{
  const models = [
    { name: 'LR', model: new LinearRegression() },
    { name: 'DT', model: new DecisionTree({ maxDepth: 5 }) },
  ];
  const r = api.evaluation.compare(models.map(m => m.model), X, y, 3);
  assert(r.success === true, 'compare 执行成功');
}

// ==========================================
// 8. 模型集成测试
// ==========================================
title('8. 模型集成 (Ensemble)');

subtitle('8.1 加权平均集成');
{
  const integrator = new ModelIntegrator({ integrationMethod: 'weightedAverage' });
  integrator.addModel(new LinearRegression(), {}, 0.6);
  integrator.addModel(new DecisionTree({ maxDepth: 5 }), {}, 0.4);
  integrator.fit(X, y);
  const preds = integrator.predict(X);
  assert(integrator.isTrained === true, '集成模型已训练');
  assert(preds.length === y.length, '预测数量正确');

  const info = integrator.getInfo();
  assert(info.totalModels === 2, '集成了2个模型');
}

// ==========================================
// 9. 超参数优化测试
// ==========================================
title('9. 超参数优化 (Optimization)');

subtitle('9.1 网格搜索');
{
  const optimizer = new ParameterOptimizer();
  const model = new DecisionTree({ maxDepth: 3 });
  const paramGrid = {
    maxDepth: [3, 5],
    minSamplesSplit: [2, 5]
  };
  const r = optimizer.gridSearch(model, X, y, paramGrid, 3, 'r2');
  assert(r.bestParams !== undefined, '找到最佳参数');
  assert(r.bestScore !== undefined, '有最佳分数');
  assert(r.results.length >= 4, '搜索了所有组合');
}

subtitle('9.2 优化建议');
{
  const r = api.optimization.suggestions(linearData, 'target');
  assert(r.success === true, '优化建议执行成功');
  assert(r.data.suggestions.length >= 1, '有优化建议');
}

// ==========================================
// 10. 碳排放测试
// ==========================================
title('10. 碳排放核算 (Carbon)');

subtitle('10.1 碳排放计算');
{
  const r = api.carbon.calculate({
    hotmetal_weight: 1,
    coke_weight: 300,
    PC_weight: 160,
    flux_weight: 110
  });
  assert(r.success === true, '碳排放计算执行成功');
  assert(r.data.result.direct_CO2_weight !== undefined, '有直接碳排放结果');
  assert(r.data.result.energy_brought_in_CO2 !== undefined, '有能源带入CO2');
  assert(r.data.result.materials_brought_in_CO2 !== undefined, '有原辅料带入CO2');
  assert(parseFloat(r.data.result.direct_CO2_weight) > 0, '碳排放大于0');
}

// ==========================================
// 11. 多模型预测测试
// ==========================================
title('11. 多模型预测 (Prediction)');

subtitle('11.1 多模型联合预测');
{
  const r = api.prediction.multiModel(simpleData, 'target');
  assert(r.success === true, 'multiModelPrediction 执行成功');
  assert(r.data.models.length >= 1, '有模型预测结果');
  assert(r.data.models[0].name !== undefined, '有模型名称');
}

// ==========================================
// 12. 报告生成测试
// ==========================================
title('12. 报告生成 (Reporting)');

subtitle('12.1 综合分析报告');
{
  const r = api.reporting.generateReport(linearData, 'target');
  assert(r.success === true, 'generateReport 执行成功');
  assert(r.data.title !== undefined, '有报告标题');
  assert(r.data.basicInfo !== undefined, '有基本信息');
  assert(r.data.numericalStats !== undefined, '有数值统计');
  assert(r.data.importanceResult !== undefined, '有特征重要性');
  assert(r.data.summary !== undefined, '有总结');
}

// ==========================================
// 13. API 信息测试
// ==========================================
title('13. API 信息 (Info)');

subtitle('13.1 版本信息');
{
  const r = api.info.getVersion();
  assert(r.success === true, 'getVersion 执行成功');
  assert(r.data.name.includes('冶金'), 'API 名称正确');
  assert(r.data.version === '1.0.0', '版本号正确');
  assert(r.data.totalAlgorithms >= 28, '算法数量 >= 28');
}

subtitle('13.2 分析类型列表');
{
  const r = api.info.getAnalysisTypes();
  assert(r.success === true, 'getAnalysisTypes 执行成功');
}

// ==========================================
// 14. 工具函数测试
// ==========================================
title('14. 工具函数 (Utils)');

subtitle('14.1 创建示例数据');
{
  const data = api.utils.createSampleData(15, 6);
  assert(data.length === 15, '创建了15行');
  assert(data[0].feature1 !== undefined, '有 feature1 列');
  assert(data[0].feature6 !== undefined, '有 feature6 列');
  assert(data[0].target !== undefined, '有 target 列');
}

subtitle('14.2 模型评估工具');
{
  const actual = [10, 12, 14, 16, 18];
  const predicted = [10.1, 11.9, 14.2, 15.8, 18.1];
  const r = api.utils.evaluateModel(actual, predicted);
  assert(r.success === true, 'evaluateModel 执行成功');
  assert(r.data.mse !== undefined, '有 MSE');
  assert(r.data.r2 !== undefined, '有 R²');
  assert(parseFloat(r.data.r2) > 0.99, 'R² 接近 1.0');
}

// ==========================================
// 15. 错误处理测试
// ==========================================
title('15. 错误处理 (Error Handling)');

subtitle('15.1 空数据错误处理');
{
  const r = api.statistics.basicInfo([]);
  assert(r.success === false, '空数据应返回错误');
  assert(r.error !== null, '有错误信息');
}

subtitle('15.2 null 数据错误处理');
{
  const r = api.statistics.basicInfo(null);
  assert(r.success === false, 'null 应返回错误');
  assert(r.error !== null, '有错误信息');
}

subtitle('15.3 模型创建错误处理');
{
  const r = api.models.create('nonExistentModel');
  assert(r.success === false, '不存在的模型应返回错误');
}

// ==========================================
// 总结
// ==========================================
console.log('\n' + '='.repeat(55));
console.log('📊 测试总结');
console.log('='.repeat(55));
console.log(`  通过: ${passed}`);
console.log(`  失败: ${failed}`);
console.log(`  总计: ${passed + failed}`);
console.log(`  通过率: ${(passed / (passed + failed) * 100).toFixed(1)}%`);

if (failures.length > 0) {
  console.log(`\n❌ 失败的测试:`);
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log(`\n✅ 所有测试通过！`);
  process.exit(0);
}
