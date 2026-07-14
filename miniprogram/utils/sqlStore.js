// sqlStore.js - SQL结构化本地存储核心函数

// 数据库配置
const DB_CONFIG = {
  PREFIX: 'sql_store_',
  VERSION: '1.0',
  VERSION_KEY: 'sql_store_data_version'
};

/**
 * 获取数据版本戳（用于跨页面变更检测）
 * @returns {number} - 当前版本号
 */
function getDataVersion() {
  try {
    return wx.getStorageSync(DB_CONFIG.VERSION_KEY) || 0;
  } catch (e) {
    return 0;
  }
}

/**
 * 递增数据版本戳（每次数据变更时调用）
 */
function incrementDataVersion() {
  try {
    const v = getDataVersion();
    wx.setStorageSync(DB_CONFIG.VERSION_KEY, v + 1);
  } catch (e) {
    console.error('incrementDataVersion failed:', e);
  }
}

/**
 * 生成表名前缀
 * @param {string} tableName - 表名
 * @returns {string} - 带前缀的表名
 */
function getTableName(tableName) {
  return `${DB_CONFIG.PREFIX}${tableName}`;
}

/**
 * 初始化数据库
 * @returns {boolean} - 是否初始化成功
 */
function initDB() {
  try {
    // 初始化数据库版本
    wx.setStorageSync('sqlStoreVersion', DB_CONFIG.VERSION);
    return true;
  } catch (error) {
    console.error('初始化数据库失败:', error);
    return false;
  }
}

/**
 * 初始化数据库表结构
 * @param {string} tableName - 表名
 * @param {Array} columns - 列定义，格式：[{name: 'id', type: 'number', primaryKey: true}, ...]
 * @returns {Object} - 操作结果
 */
function createTable(tableName, columns) {
  try {
    // 验证列定义
    if (!Array.isArray(columns) || columns.length === 0) {
      return { success: false, error: '列定义不能为空' };
    }

    // 检查是否已存在表
    const existingTable = wx.getStorageSync(getTableName(tableName));
    if (existingTable && existingTable.schema) {
      return { success: false, error: '表已存在' };
    }

    // 检查是否已存在主键
    const primaryKeys = columns.filter((col) => col.primaryKey);
    if (primaryKeys.length === 0) {
      // 如果没有主键，自动添加id列作为主键
      columns.unshift({
        name: 'id',
        type: 'number',
        primaryKey: true
      });
    }

    // 存储表结构
    const tableSchema = {
      name: tableName,
      columns,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: DB_CONFIG.VERSION,
      rowCount: 0
    };

    wx.setStorageSync(getTableName(tableName), {
      schema: tableSchema,
      data: []
    });

    return { success: true };
  } catch (error) {
    console.error('创建表失败:', error);
    return { success: false, error: '创建表失败: ' + error.message };
  }
}

/**
 * 向表中插入数据
 * @param {string} tableName - 表名
 * @param {Array|Object} rows - 要插入的数据，可以是单条或多条
 * @returns {Object} - 操作结果
 */
function insertData(tableName, rows) {
  try {
    const tableData = wx.getStorageSync(getTableName(tableName));
    if (!tableData || !tableData.schema || !Array.isArray(tableData.data)) {
      return { success: false, error: '表不存在或结构错误' };
    }

    const rowsToInsert = Array.isArray(rows) ? rows : [rows];
    const insertedRows = [];

    // 获取主键列
    const primaryKeyCol = tableData.schema.columns.find(
      (col) => col.primaryKey
    );

    for (const row of rowsToInsert) {
      // 验证数据结构
      const validatedRow = {};
      tableData.schema.columns.forEach((col) => {
        const value = row[col.name];

        // 类型转换和验证
        switch (col.type) {
          case 'number':
            if (typeof value === 'number') {
              validatedRow[col.name] = value;
            } else {
              const num = parseFloat(value);
              // 如果转换失败，保留原值作为字符串，而不是强制转换为 0
              validatedRow[col.name] = isNaN(num) ? String(value || '') : num;
            }
            break;
          case 'string':
            validatedRow[col.name] = String(value || '');
            break;
          case 'boolean':
            validatedRow[col.name] = Boolean(value);
            break;
          case 'date':
            validatedRow[col.name] =
              value instanceof Date ? value : new Date(value);
            break;
          default:
            validatedRow[col.name] = value;
        }
      });

      // 生成主键
      if (primaryKeyCol && !validatedRow[primaryKeyCol.name]) {
        const maxId = tableData.data.reduce((max, item) => {
          const val = item[primaryKeyCol.name] || 0;
          return val > max ? val : max;
        }, 0);
        validatedRow[primaryKeyCol.name] = maxId + 1;
      }

      insertedRows.push(validatedRow);
    }

    // 插入数据
    tableData.data = [...tableData.data, ...insertedRows];
    tableData.schema.rowCount = tableData.data.length;
    tableData.schema.updatedAt = new Date().toISOString();

    wx.setStorageSync(getTableName(tableName), tableData);

    incrementDataVersion();

    return { success: true, insertedCount: insertedRows.length };
  } catch (error) {
    console.error('插入数据失败:', error);
    return { success: false, error: '插入数据失败: ' + error.message };
  }
}

/**
 * 查询表中的数据
 * @param {string} tableName - 表名
 * @param {Object} options - 查询选项
 * @param {Array} options.columns - 要查询的列，默认为所有列
 * @param {Object} options.where - 查询条件，格式：{column: value} 或 {column: {operator: '>', value: 10}}
 * @param {Array} options.orderBy - 排序规则，格式：[{column: 'name', direction: 'asc'}]
 * @param {number} options.limit - 限制返回行数
 * @param {number} options.offset - 偏移量
 * @returns {Object} - 查询结果
 */
function queryData(tableName, options = {}) {
  try {
    const tableData = wx.getStorageSync(getTableName(tableName));
    if (!tableData || !tableData.schema || !Array.isArray(tableData.data)) {
      return { success: false, error: '表不存在或结构错误' };
    }

    let result = [...tableData.data];
    const { columns, where, orderBy, limit, offset } = options;

    // 应用查询条件
    if (where) {
      result = result.filter((row) => {
        return Object.entries(where).every(([col, condition]) => {
          // 支持简单条件和复杂条件
          if (typeof condition === 'object' && condition !== null) {
            const { operator, value } = condition;
            const rowValue = row[col];

            switch (operator) {
              case '=':
                return rowValue === value;
              case '!=':
                return rowValue !== value;
              case '>':
                return rowValue > value;
              case '<':
                return rowValue < value;
              case '>=':
                return rowValue >= value;
              case '<=':
                return rowValue <= value;
              case 'like':
                return String(rowValue).includes(String(value));
              default:
                return true;
            }
          } else {
            // 简单相等条件
            return row[col] === condition;
          }
        });
      });
    }

    // 应用排序
    if (orderBy && Array.isArray(orderBy)) {
      result.sort((a, b) => {
        for (const sort of orderBy) {
          const { column, direction = 'asc' } = sort;
          let comparison = 0;

          if (a[column] < b[column]) comparison = -1;
          if (a[column] > b[column]) comparison = 1;

          if (comparison !== 0) {
            return direction === 'desc' ? -comparison : comparison;
          }
        }
        return 0;
      });
    }

    // 应用偏移量和限制
    if (offset) {
      result = result.slice(offset);
    }
    if (limit) {
      result = result.slice(0, limit);
    }

    // 选择列
    if (columns && Array.isArray(columns) && columns.length > 0) {
      result = result.map((row) => {
        const newRow = {};
        columns.forEach((col) => {
          if (col in row) {
            newRow[col] = row[col];
          }
        });
        return newRow;
      });
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('查询数据失败:', error);
    return { success: false, error: '查询数据失败: ' + error.message };
  }
}

/**
 * 清空表中的所有数据
 * @param {string} tableName - 表名
 * @returns {Object} - 操作结果
 */
function clearTable(tableName) {
  try {
    const tableData = wx.getStorageSync(getTableName(tableName));
    if (!tableData || !tableData.schema) {
      return { success: false, error: '表不存在' };
    }

    // 清空数据
    tableData.data = [];
    tableData.schema.rowCount = 0;
    tableData.schema.updatedAt = new Date().toISOString();

    wx.setStorageSync(getTableName(tableName), tableData);

    incrementDataVersion();

    return { success: true };
  } catch (error) {
    console.error('清空表失败:', error);
    return { success: false, error: '清空表失败: ' + error.message };
  }
}

/**
 * 更新表中的数据
 * @param {string} tableName - 表名
 * @param {Object} updates - 要更新的数据，格式：{column: value}
 * @param {Object} where - 更新条件，格式同查询条件
 * @returns {Object} - 操作结果
 */
function updateData(tableName, updates, where) {
  try {
    const tableData = wx.getStorageSync(getTableName(tableName));
    if (!tableData || !tableData.schema || !Array.isArray(tableData.data)) {
      return { success: false, error: '表不存在或结构错误' };
    }

    let updatedCount = 0;

    // 更新数据
    tableData.data = tableData.data.map((row) => {
      // 检查是否匹配条件
      const match = Object.entries(where).every(([col, condition]) => {
        if (typeof condition === 'object' && condition !== null) {
          const { operator, value } = condition;
          const rowValue = row[col];

          switch (operator) {
            case '=':
              return rowValue === value;
            case '!=':
              return rowValue !== value;
            case '>':
              return rowValue > value;
            case '<':
              return rowValue < value;
            case '>=':
              return rowValue >= value;
            case '<=':
              return rowValue <= value;
            case 'like':
              return String(rowValue).includes(String(value));
            default:
              return true;
          }
        } else {
          return row[col] === condition;
        }
      });

      if (match) {
        updatedCount++;
        return { ...row, ...updates };
      }

      return row;
    });

    // 更新表信息
    tableData.schema.updatedAt = new Date().toISOString();
    wx.setStorageSync(getTableName(tableName), tableData);

    incrementDataVersion();

    return { success: true, updatedCount };
  } catch (error) {
    console.error('更新数据失败:', error);
    return { success: false, error: '更新数据失败: ' + error.message };
  }
}

/**
 * 删除表中的数据
 * @param {string} tableName - 表名
 * @param {Object} where - 删除条件，格式同查询条件
 * @returns {Object} - 操作结果
 */
function deleteData(tableName, where) {
  try {
    const tableData = wx.getStorageSync(getTableName(tableName));
    if (!tableData || !tableData.schema || !Array.isArray(tableData.data)) {
      return { success: false, error: '表不存在或结构错误' };
    }

    const initialLength = tableData.data.length;

    // 删除匹配的数据
    tableData.data = tableData.data.filter((row) => {
      // 检查是否匹配条件
      return !Object.entries(where).every(([col, condition]) => {
        if (typeof condition === 'object' && condition !== null) {
          const { operator, value } = condition;
          const rowValue = row[col];

          switch (operator) {
            case '=':
              return rowValue === value;
            case '!=':
              return rowValue !== value;
            case '>':
              return rowValue > value;
            case '<':
              return rowValue < value;
            case '>=':
              return rowValue >= value;
            case '<=':
              return rowValue <= value;
            case 'like':
              return String(rowValue).includes(String(value));
            default:
              return true;
          }
        } else {
          return row[col] === condition;
        }
      });
    });

    // 更新表信息
    tableData.schema.rowCount = tableData.data.length;
    tableData.schema.updatedAt = new Date().toISOString();
    wx.setStorageSync(getTableName(tableName), tableData);

    const deletedCount = initialLength - tableData.data.length;
    incrementDataVersion();
    return { success: true, deletedCount };
  } catch (error) {
    console.error('删除数据失败:', error);
    return { success: false, error: '删除数据失败: ' + error.message };
  }
}

/**
 * 清空表中的所有数据
 * @param {string} tableName - 表名
 * @returns {boolean} - 是否清空成功
 */
function truncateTable(tableName) {
  try {
    const tableData = wx.getStorageSync(getTableName(tableName));
    if (!tableData || !tableData.schema) {
      throw new Error('表不存在');
    }

    // 清空数据
    tableData.data = [];
    tableData.schema.rowCount = 0;
    tableData.schema.updatedAt = new Date().toISOString();

    wx.setStorageSync(getTableName(tableName), tableData);

    incrementDataVersion();

    return true;
  } catch (error) {
    console.error('清空表失败:', error);
    throw new Error('清空表失败: ' + error.message);
  }
}

/**
 * 列出所有表名
 * @returns {Array} - 表名列表
 */
function listTables() {
  try {
    const info = wx.getStorageInfoSync();
    const keys = info.keys || [];
    return keys
      .filter(key => key.startsWith(DB_CONFIG.PREFIX))
      .map(key => key.replace(DB_CONFIG.PREFIX, ''));
  } catch (error) {
    console.error('列出表失败:', error);
    return [];
  }
}

/**
 * 删除表
 * @param {string} tableName - 表名
 * @returns {boolean} - 是否删除成功
 */
function dropTable(tableName) {
  try {
    wx.removeStorageSync(getTableName(tableName));
    return true;
  } catch (error) {
    console.error('删除表失败:', error);
    throw new Error('删除表失败: ' + error.message);
  }
}

/**
 * 获取表结构信息
 * @param {string} tableName - 表名
 * @returns {Object|null} - 表结构信息
 */
function getTableSchema(tableName) {
  try {
    const tableData = wx.getStorageSync(getTableName(tableName));
    return tableData ? tableData.schema : null;
  } catch (error) {
    console.error('获取表结构失败:', error);
    return null;
  }
}

/**
 * 从 CSV 解析结果创建表并插入数据
 * @param {string} tableName - 表名
 * @param {Object} parsedData - 解析后的数据，格式：{headers: [], data: []}
 * @param {string} [mode='replace'] - 导入模式：'replace'（覆盖） | 'append'（追加）
 * @returns {Object} - 操作结果
 */
function createTableFromParsedData(tableName, parsedData, mode = 'replace') {
  try {
    // 验证解析数据
    if (
      !parsedData ||
      !Array.isArray(parsedData.headers) ||
      !Array.isArray(parsedData.data)
    ) {
      throw new Error('解析数据格式错误');
    }

    // --- 追加模式：表已存在则直接追加数据 ---
    if (mode === 'append') {
      const existingTable = wx.getStorageSync(getTableName(tableName));
      if (existingTable && existingTable.schema) {
        const insertResult = insertData(tableName, parsedData.data);
        if (!insertResult.success) throw new Error('追加数据失败: ' + insertResult.error);
        return {
          tableName,
          columns: existingTable.schema.columns,
          insertedCount: insertResult.insertedCount,
          tableSchema: getTableSchema(tableName),
          success: true,
          mode: 'append'
        };
      }
      // 表不存在则自动转为创建replace模式
    }

    // --- 覆盖模式：删废旧表重建 ---
    // 强制删除旧表，确保schema可以正确更新
    try {
      dropTable(tableName);
    } catch (e) {
      // 忽略表不存在的错误
      // console.log('表不存在，跳过删除:', e.message); // 保持原有的注释，但移除console.log
    }

    // 根据解析结果生成列定义
    const columns = parsedData.headers.map((header) => {
      // 尝试推断列类型
      let type = 'string';

      // 从数据中推断类型，检查多行数据以提高准确性
      let nonEmptyCount = 0;
      let hasNumber = false;
      let hasBoolean = false;
      let hasDate = false;
      let hasString = false;

      for (const row of parsedData.data) {
        if (
          row[header] !== undefined &&
          row[header] !== null &&
          row[header] !== ''
        ) {
          nonEmptyCount++;

          if (typeof row[header] === 'number') {
            hasNumber = true;
          } else if (typeof row[header] === 'boolean') {
            hasBoolean = true;
          } else {
            // 尝试转换为数字
            const num = parseFloat(row[header]);
            if (!isNaN(num) && !isNaN(parseFloat(row[header]))) {
              hasNumber = true;
            } else {
              // 尝试转换为日期
              const date = new Date(row[header]);
              if (!isNaN(date.getTime())) {
                hasDate = true;
              } else {
                hasString = true;
              }
            }
          }

          // 检查了足够的数据后提前退出
          if (nonEmptyCount >= 10) {
            break;
          }
        }
      }

      // 确定最终类型
      if (hasBoolean) {
        type = 'boolean';
      } else if (hasNumber && !hasString) {
        type = 'number';
      } else if (hasDate && !hasString) {
        type = 'date';
      } else {
        type = 'string';
      }

      return {
        name: header,
        type,
        primaryKey:
          header.toLowerCase() === 'id' || header.toLowerCase() === 'index'
      };
    });

    // 创建表
    const createResult = createTable(tableName, columns);
    if (!createResult.success) {
      throw new Error('创建表失败: ' + createResult.error);
    }

    // 插入数据
    const insertResult = insertData(tableName, parsedData.data);
    if (!insertResult.success) {
      throw new Error('插入数据失败: ' + insertResult.error);
    }

    return {
      tableName,
      columns,
      insertedCount: insertResult.insertedCount,
      tableSchema: getTableSchema(tableName),
      success: true
    };
  } catch (error) {
    console.error('从解析数据创建表失败:', error);
    throw new Error('从解析数据创建表失败: ' + error.message);
  }
}

module.exports = {
  initDB,
  createTable,
  insertData,
  queryData,
  clearTable,
  updateData,
  deleteData,
  truncateTable,
  dropTable,
  getTableSchema,
  listTables,
  createTableFromParsedData,
  getDataVersion,
  incrementDataVersion
};
