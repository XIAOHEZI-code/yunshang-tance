// test.js - 单元测试文件

const {
  getBasicInfo,
  getMissingStats,
  getNumericalStats,
  getCategoricalStats,
  detectOutliers,
  getFeatureImportance,
  getCorrelationAnalysis,
  standardizeFeatures,
  calculatePermutationImportance,
  selectFeatures,
  preprocessData,
  analyzeData,
  getAvailableAnalysisTypes
} = require('./analysisApi');

const {
  initDB,
  createTable,
  insertData,
  queryData,
  truncateTable,
  getTableSchema
} = require('./sqlStore');

// 测试数据
const testData = [
  { id: 1, feature1: 1.2, feature2: 2.3, feature3: 3.4, target: 10.5 },
  { id: 2, feature1: 1.5, feature2: 2.6, feature3: 3.7, target: 11.2 },
  { id: 3, feature1: 1.8, feature2: 2.9, feature3: 4.0, target: 11.9 },
  { id: 4, feature1: 2.1, feature2: 3.2, feature3: 4.3, target: 12.6 },
  { id: 5, feature1: 2.4, feature2: 3.5, feature3: 4.6, target: 13.3 },
  { id: 6, feature1: 2.7, feature2: 3.8, feature3: 4.9, target: 14.0 },
  { id: 7, feature1: 3.0, feature2: 4.1, feature3: 5.2, target: 14.7 },
  { id: 8, feature1: 3.3, feature2: 4.4, feature3: 5.5, target: 15.4 },
  { id: 9, feature1: 3.6, feature2: 4.7, feature3: 5.8, target: 16.1 },
  { id: 10, feature1: 3.9, feature2: 5.0, feature3: 6.1, target: 16.8 }
];

// 带缺失值的测试数据
const testDataWithMissing = [
  { id: 1, feature1: 1.2, feature2: 2.3, feature3: 3.4, target: 10.5 },
  { id: 2, feature1: null, feature2: 2.6, feature3: 3.7, target: 11.2 },
  { id: 3, feature1: 1.8, feature2: null, feature3: 4.0, target: 11.9 },
  { id: 4, feature1: 2.1, feature2: 3.2, feature3: null, target: 12.6 },
  { id: 5, feature1: 2.4, feature2: 3.5, feature3: 4.6, target: 13.3 }
];

// 测试结果
const testResults = [];

// 测试函数
function runTest(name, testFn) {
  try {
    const result = testFn();
    testResults.push({ name, status: 'PASS', result });
    console.log(`✓ ${name}`);
  } catch (error) {
    testResults.push({ name, status: 'FAIL', error: error.message });
    console.log(`✗ ${name}: ${error.message}`);
  }
}

// 运行所有测试
function runAllTests() {
  console.log('开始运行单元测试...');
  console.log('=' * 50);

  // 测试基本信息
  runTest('getBasicInfo', () => {
    const result = getBasicInfo(testData);
    if (result.shape.rows !== 10 || result.shape.columns !== 5) {
      throw new Error('基本信息测试失败');
    }
    return result;
  });

  // 测试缺失值统计
  runTest('getMissingStats', () => {
    const result = getMissingStats(testDataWithMissing);
    if (!result.hasMissingValues) {
      throw new Error('缺失值统计测试失败');
    }
    return result;
  });

  // 测试数值统计
  runTest('getNumericalStats', () => {
    const result = getNumericalStats(testData);
    if (!result.stats.feature1 || !result.stats.target) {
      throw new Error('数值统计测试失败');
    }
    return result;
  });

  // 测试分类统计
  runTest('getCategoricalStats', () => {
    const dataWithCategory = testData.map(row => ({
      ...row,
      category: row.id % 2 === 0 ? 'even' : 'odd'
    }));
    const result = getCategoricalStats(dataWithCategory);
    if (!result.stats.category) {
      throw new Error('分类统计测试失败');
    }
    return result;
  });

  // 测试异常值检测
  runTest('detectOutliers', () => {
    const result = detectOutliers(testData, 'target');
    if (!result.outlierIndices) {
      throw new Error('异常值检测测试失败');
    }
    return result;
  });

  // 测试特征重要性
  runTest('getFeatureImportance', () => {
    const result = getFeatureImportance(testData, 'target');
    if (!result.featureImportance || result.featureImportance.length === 0) {
      throw new Error('特征重要性测试失败');
    }
    return result;
  });

  // 测试相关性分析
  runTest('getCorrelationAnalysis', () => {
    const result = getCorrelationAnalysis(testData, 'target');
    if (!result.correlations || result.correlations.length === 0) {
      throw new Error('相关性分析测试失败');
    }
    return result;
  });

  // 测试特征标准化
  runTest('standardizeFeatures', () => {
    const result = standardizeFeatures(testData, ['feature1', 'feature2', 'feature3']);
    if (!result.standardizedData || result.standardizedData.length === 0) {
      throw new Error('特征标准化测试失败');
    }
    return result;
  });

  // 测试排列重要性
  runTest('calculatePermutationImportance', () => {
    const result = calculatePermutationImportance(testData, 'target', 5);
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error('排列重要性测试失败');
    }
    return result;
  });

  // 测试特征选择
  runTest('selectFeatures', () => {
    const result = selectFeatures(testData, 'target', 'importance');
    if (!result.selectedFeatures || result.selectedFeatures.length === 0) {
      throw new Error('特征选择测试失败');
    }
    return result;
  });

  // 测试数据预处理
  runTest('preprocessData', () => {
    const result = preprocessData(testData, 'target');
    if (!result.cleanedData || !result.selectedFeatures) {
      throw new Error('数据预处理测试失败');
    }
    return result;
  });

  // 测试分析接口
  runTest('analyzeData', () => {
    const result = analyzeData(testData, 'basicInfo');
    if (!result.shape) {
      throw new Error('分析接口测试失败');
    }
    return result;
  });

  // 测试获取分析类型
  runTest('getAvailableAnalysisTypes', () => {
    const result = getAvailableAnalysisTypes();
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error('获取分析类型测试失败');
    }
    return result;
  });

  // 测试数据库操作
  runTest('Database Operations', () => {
    // 初始化数据库
    initDB();

    // 创建表
    const createResult = createTable('test_table', [
      { name: 'id', type: 'number', primaryKey: true },
      { name: 'name', type: 'string' },
      { name: 'value', type: 'number' }
    ]);

    if (!createResult.success) {
      throw new Error('创建表失败');
    }

    // 插入数据
    const insertResult = insertData('test_table', [
      { id: 1, name: 'test1', value: 10 },
      { id: 2, name: 'test2', value: 20 }
    ]);

    if (!insertResult.success) {
      throw new Error('插入数据失败');
    }

    // 查询数据
    const queryResult = queryData('test_table');
    if (!queryResult.success || !Array.isArray(queryResult.data)) {
      throw new Error('查询数据失败');
    }

    // 获取表结构
    const schema = getTableSchema('test_table');
    if (!schema) {
      throw new Error('获取表结构失败');
    }

    // 清空表
    truncateTable('test_table');

    return { createResult, insertResult, queryResult, schema };
  });

  console.log('=' * 50);
  console.log('测试完成!');
  console.log('\n测试结果:');

  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;

  console.log(`通过: ${passed}`);
  console.log(`失败: ${failed}`);
  console.log(`总测试数: ${testResults.length}`);

  if (failed > 0) {
    console.log('\n失败的测试:');
    testResults
      .filter(r => r.status === 'FAIL')
      .forEach(r => console.log(`- ${r.name}: ${r.error}`));
  }

  return testResults;
}

// 导出测试函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testData,
    testDataWithMissing
  };
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  runAllTests();
}
