// fileParse.js - CSV/XLSX文件解析核心函数
// 遵循微信小程序文件系统 API 规范
// https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.html

// 导入Worker线程管理器
const parseWorkerManager = require('./parseWorkerManager').default;

/**
 * 英文表头到中文的映射字典 - 工业/冶金领域常见字段
 */
const FIELD_MAPPING = {
  // 基本信息
  'id': '编号',
  'index': '索引',
  
  // 冶金相关
  'oxygen enrichment': '富氧率',
  'oxygen_enrichment': '富氧率',
  'enrichment': '富氧率',
  
  'injection position': '喷吹位置',
  'injection_position': '喷吹位置',
  'position': '位置',
  
  'injection rate': '喷吹速率',
  'injection_rate': '喷吹速率',
  'rate': '速率',
  
  'hottmattem': '铁水温度',
  'hot metal temp': '铁水温度',
  'temperature': '温度',
  'temp': '温度',
  
  'HIR': '铁水比',
  'BF': '高炉',
  'blast furnace': '高炉',
  
  'productivity': '生产率',
  'yield': '产量',
  
  'carbon emission': '碳排放',
  'carbon_emission': '碳排放',
  'emission': '排放',
  
  // 通用参数
  'time': '时间',
  'date': '日期',
  'value': '值',
  'parameter': '参数',
  'feature': '特征',
  'target': '目标',
  'result': '结果',
  'score': '得分',
  'importance': '重要性',
  'correlation': '相关性',
  'error': '误差',
  'accuracy': '准确率',
  'precision': '精确率',
  'recall': '召回率',
  'f1': 'F1值',
  'loss': '损失值'
};

/**
 * 获取字段的中文名称
 * @param {string} fieldName - 英文字段名
 * @returns {string} - 中文字段名或原始字段名
 */
function getChineseFieldName(fieldName) {
  const normalizedFieldName = fieldName.toLowerCase().trim();
  return FIELD_MAPPING[normalizedFieldName] || fieldName;
}

/**
 * 为解析结果添加中文表头映射
 * @param {Object} parsedData - 原始解析结果
 * @returns {Object} - 带有中文表头映射的解析结果
 */
function addChineseFieldMapping(parsedData) {
  const chineseHeaders = parsedData.headers.map(header => getChineseFieldName(header));
  
  return {
    ...parsedData,
    chineseHeaders,
    fieldMapping: parsedData.headers.reduce((mapping, header, index) => {
      mapping[header] = chineseHeaders[index];
      return mapping;
    }, {})
  };
}

/**
 * 解析CSV文件内容 - 支持基本 CSV 格式
 * @param {string} csvContent - CSV文件内容
 * @returns {Object} - 解析结果，包含表头和数据
 */
function parseCSV(csvContent) {
  try {
    // 检查是否为XLSX文件（ZIP格式）
    if (csvContent.startsWith('PK')) {
      throw new Error('检测到 XLSX 格式文件，请先将文件转换为 CSV 格式后上传');
    }

    // 检查文件内容是否为空
    if (!csvContent || csvContent.trim().length === 0) {
      throw new Error('CSV 文件内容为空');
    }

    // 处理换行符，支持不同操作系统 (Windows: \r\n, Unix: \n, Mac: \r)
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() !== '');

    if (lines.length === 0) {
      throw new Error('CSV 文件内容为空或只包含空白字符');
    }

    // 提取表头（第一行）
    const headers = lines[0].split(',').map((header) => header.trim());

    if (headers.length === 0 || headers.every(h => h === '')) {
      throw new Error('CSV 文件缺少有效的表头');
    }

    // 解析数据行
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // 跳过空行

      // 使用字符串形式的正则表达式来避免语法错误
      const csvSplitRegex = new RegExp(',(?=(?:(?:[^"]*"){2})*[^"]*$)');
      const values = line.split(csvSplitRegex).map((value) => {
        let trimmed = value.trim();
        // 去除包裹的引号
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          trimmed = trimmed.slice(1, -1).replace(/""/g, '"');
        }
        // 尝试转换为数字
        const num = parseFloat(trimmed);
        return isNaN(num) ? trimmed : num;
      });

      // 创建行对象
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] !== undefined ? values[index] : '';
      });
      data.push(row);
    }

    // 验证解析结果
    if (data.length === 0) {
      console.warn('CSV 文件没有数据行，只有表头');
    }

    // 添加中文表头映射
    const result = {
      headers,
      data,
      meta: {
        rowCount: data.length,
        columnCount: headers.length,
        fileType: 'csv'
      }
    };
    
    return addChineseFieldMapping(result);
  } catch (error) {
    console.error('CSV解析错误:', error);
    throw new Error('CSV 文件解析失败: ' + error.message);
  }
}

/**
 * Parse ZIP central directory to find file entries
 * @param {ArrayBuffer} buffer - ZIP file buffer
 * @returns {Array} - Array of file entry info
 */
function parseZIPCentralDirectory(buffer) {
  const view = new DataView(buffer);
  const buf = new Uint8Array(buffer);

  // Find End of Central Directory (EOCD) signature: 0x06054b50
  let eocdOffset = -1;
  const maxSearch = Math.min(buffer.byteLength, 65535 + 22);
  const searchStart = Math.max(0, buffer.byteLength - maxSearch);

  for (let i = buffer.byteLength - 22; i >= searchStart; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) throw new Error('Cannot find ZIP central directory');

  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const centralDirSize = view.getUint32(eocdOffset + 12, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);

  const entries = [];
  let offset = centralDirOffset;

  for (let i = 0; i < totalEntries; i++) {
    // Check central directory file header signature 0x02014b50
    const sig = view.getUint32(offset, true);
    if (sig !== 0x02014b50) break;

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraFieldLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    // Read file name (UTF-8)
    let fileName = '';
    for (let j = 0; j < fileNameLength; j++) {
      fileName += String.fromCharCode(buf[offset + 46 + j]);
    }

    // Get local header to find actual data offset
    const localSig = view.getUint32(localHeaderOffset, true);
    if (localSig === 0x04034b50) {
      const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;

      entries.push({
        name: fileName,
        offset: dataOffset,
        compressedSize,
        uncompressedSize,
        compressionMethod
      });
    }

    offset += 46 + fileNameLength + extraFieldLength + commentLength;
  }

  return entries;
}

/**
 * Minimal Inflate decompression for DEFLATE format
 * Handles the common case of fixed Huffman codes (BTYPE=01)
 * @param {Uint8Array} data - Compressed data
 * @param {number} expectedSize - Expected uncompressed size
 * @returns {Uint8Array} - Decompressed data
 */
function inflateDeflate(data, expectedSize) {
  const output = new Uint8Array(expectedSize);
  let outPos = 0;
  let bitPos = 0;
  let bitBuf = 0;
  let bitCount = 0;

  function readBits(n) {
    while (bitCount < n) {
      if (bitPos >= data.length) throw new Error('Unexpected end of deflate data');
      bitBuf |= data[bitPos++] << bitCount;
      bitCount += 8;
    }
    const val = bitBuf & ((1 << n) - 1);
    bitBuf >>= n;
    bitCount -= n;
    return val;
  }

  // Fixed Huffman code tables (RFC 1951 section 3.2.6)
  function decodeLiteralLength() {
    // Try reading 7 bits first
    const bits7 = readBits(7);
    if (bits7 <= 23) return bits7 + 256; // 0-23 → 256-279

    // Read one more bit to make 8 bits
    const bit8 = readBits(1);
    const bits8 = bits7 | (bit8 << 7);

    if (bits8 >= 192 && bits8 <= 199) return bits8 - 192 + 280; // 192-199 → 280-287
    if (bits8 >= 48 && bits8 <= 191) return bits8 - 48; // 48-191 → 0-143

    // Read one more bit to make 9 bits
    const bit9 = readBits(1);
    const bits9 = bits8 | (bit9 << 8);

    if (bits9 >= 400 && bits9 <= 511) return bits9 - 256; // 400-511 → 144-255

    throw new Error('Invalid literal/length code: ' + bits9);
  }

  const lengthExtraBits = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const lengthBase = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const distExtraBits = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const distBase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];

  let lastBlock = false;

  while (!lastBlock) {
    lastBlock = readBits(1) === 1;
    const blockType = readBits(2);

    if (blockType === 0) {
      // No compression
      bitCount = 0; // Align to byte boundary
      bitBuf = 0;
      const len = data[bitPos] | (data[bitPos + 1] << 8);
      bitPos += 4; // Skip LEN and NLEN
      for (let i = 0; i < len; i++) {
        output[outPos++] = data[bitPos++];
      }
    } else if (blockType === 1) {
      // Fixed Huffman codes
      while (true) {
        const code = decodeLiteralLength();
        if (code < 256) {
          // Literal byte
          output[outPos++] = code;
        } else if (code === 256) {
          // End of block
          break;
        } else {
          // Length-distance pair
          const lengthIndex = code - 257;
          const extraLen = lengthIndex < 29 ? lengthExtraBits[lengthIndex] : 0;
          const extraLenBits = extraLen > 0 ? readBits(extraLen) : 0;
          const length = (lengthIndex < 29 ? lengthBase[lengthIndex] : 0) + extraLenBits;

          // Distance (5 bits fixed)
          const distCode = readBits(5);
          const extraDist = distExtraBits[distCode];
          const extraDistBits = extraDist > 0 ? readBits(extraDist) : 0;
          const distance = distBase[distCode] + extraDistBits;

          // Copy from previous output
          const copyStart = outPos - distance;
          for (let i = 0; i < length; i++) {
            output[outPos++] = output[copyStart + i];
          }
        }
      }
    } else if (blockType === 2) {
      // Dynamic Huffman codes - more complex, throw if encountered
      throw new Error('XLSX file uses dynamic Huffman codes which are not yet supported. Please re-save the file as CSV or with standard compression.');
    } else {
      throw new Error('Invalid block type: ' + blockType);
    }
  }

  return output.slice(0, outPos);
}

/**
 * Extract cell data from XLSX sheet XML
 * @param {string} xml - Sheet XML content
 * @param {Array} sharedStrings - Shared strings array
 * @returns {Object} - { headers, data }
 */
function parseSheetXML(xml, sharedStrings) {
  // Find all row elements
  const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
  const rows = [];
  let rowMatch;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rowMatch[1];
    const cells = [];

    // Find all cell elements (c r="A1" t="s"><v>0</v></c>)
    const cellRegex = /<c[^>]*?(?:t="([^"]*)")?[^>]*>[\s\S]*?(?:<v>([^<]*)<\/v>)?[\s\S]*?<\/c>/g;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const cellType = cellMatch[1] || 'n'; // s=string, n=number, default number
      const cellValue = cellMatch[2] || '';

      if (cellType === 's' && sharedStrings) {
        const idx = parseInt(cellValue, 10);
        cells.push(sharedStrings[idx] || '');
      } else {
        const num = parseFloat(cellValue);
        cells.push(isNaN(num) ? cellValue : num);
      }
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) {
    throw new Error('No data found in XLSX file');
  }

  // First row is headers
  const headers = rows[0].map((cell, i) => {
    const val = String(cell || '').trim();
    return val || `Column${i + 1}`;
  });

  // Remaining rows are data
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const row = {};
    headers.forEach((header, j) => {
      row[header] = rows[i][j] !== undefined ? rows[i][j] : '';
    });
    data.push(row);
  }

  return { headers, data };
}

/**
 * 解析XLSX文件内容 - 自包含ZIP/XML解析器
 * 支持STORED和DEFLATE压缩的ZIP条目
 * @param {ArrayBuffer} arrayBuffer - XLSX文件的ArrayBuffer
 * @returns {Object} - 解析结果，包含表头和数据
 */
function parseXLSX(arrayBuffer) {
  try {
    // Parse ZIP structure
    const entries = parseZIPCentralDirectory(arrayBuffer);

    // Find key files
    let sharedStringsEntry = null;
    let sheetEntry = null;

    for (const entry of entries) {
      const name = entry.name.toLowerCase();
      if (name === 'xl/sharedstrings.xml' || name === '/xl/sharedstrings.xml') {
        sharedStringsEntry = entry;
      } else if (name === 'xl/worksheets/sheet1.xml' || name === '/xl/worksheets/sheet1.xml') {
        sheetEntry = entry;
      }
    }

    if (!sheetEntry) {
      throw new Error('Cannot find worksheet data in XLSX file');
    }

    const buf = new Uint8Array(arrayBuffer);

    // Helper to read entry data
    function readEntry(entry) {
      let data;

      if (entry.compressionMethod === 0) {
        // STORED (no compression)
        data = buf.slice(entry.offset, entry.offset + entry.compressedSize);
      } else if (entry.compressionMethod === 8) {
        // DEFLATE compressed
        const compressed = buf.slice(entry.offset, entry.offset + entry.compressedSize);
        try {
          data = inflateDeflate(compressed, entry.uncompressedSize);
        } catch (inflateErr) {
          throw new Error('XLSX decompression failed. Please convert the file to CSV format. Error: ' + inflateErr.message);
        }
      } else {
        throw new Error('Unsupported compression method: ' + entry.compressionMethod);
      }

      // Convert Uint8Array to string (UTF-8)
      let str = '';
      for (let i = 0; i < data.length; i++) {
        str += String.fromCharCode(data[i]);
      }
      return str;
    }

    // Parse shared strings if available
    let sharedStrings = [];
    if (sharedStringsEntry) {
      const ssXml = readEntry(sharedStringsEntry);
      const siRegex = /<si[^>]*>([\s\S]*?)<\/si>/g;
      let siMatch;
      while ((siMatch = siRegex.exec(ssXml)) !== null) {
        const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
        let text = '';
        let tMatch;
        while ((tMatch = tRegex.exec(siMatch[1])) !== null) {
          text += tMatch[1];
        }
        sharedStrings.push(text);
      }
    }

    // Parse worksheet
    const sheetXml = readEntry(sheetEntry);
    const result = parseSheetXML(sheetXml, sharedStrings);

    return {
      ...result,
      meta: {
        rowCount: result.data.length,
        columnCount: result.headers.length,
        fileType: 'xlsx'
      }
    };
  } catch (error) {
    console.error('XLSX解析错误:', error);
    throw new Error('XLSX文件解析失败: ' + error.message);
  }
}

/**
 * 检测文件类型（根据文件内容）
 * @param {string} binaryData - 二进制文件数据
 * @returns {string} - 文件类型：'csv'或'xlsx'
 */
function detectFileType(binaryData) {
  // 1. 检测XLSX文件（ZIP格式，以PK开头）
  if (binaryData.startsWith('PK')) {
    return 'xlsx';
  }

  // 2. 检测CSV文件的特征
  if (typeof binaryData === 'string') {
    // CSV是纯文本格式，不包含特殊二进制字符
    // 检查是否包含基本的CSV结构特征
    const hasCommas = binaryData.includes(',');

    // 3. 验证CSV的基本结构
    if (hasCommas) {
      // 检查至少有一行数据（表头+数据行或只有表头）
      const lines = binaryData
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '');
      if (lines.length >= 1) {
        // 检查每行的字段数是否一致（简单验证）
        const firstLineFields = lines[0].split(',').length;
        const consistentStructure = lines.every((line) => {
          const fields = line.split(',').length;
          // 允许最后一行字段数不一致（可能是不完整的行）
          return fields === firstLineFields || line === lines[lines.length - 1];
        });

        if (consistentStructure) {
          return 'csv';
        }
      }
    }
  }

  // 4. 默认返回csv，让parseCSV函数进一步验证
  return 'csv';
}

/**
 * 从文件路径读取并解析文件 - 微信文件系统标准调用方式
 * @param {string} tempFilePath - 临时文件路径
 * @returns {Promise<Object>} - 解析后的文件数据
 */
function readFileFromPath(tempFilePath) {
  return new Promise((resolve, reject) => {
    const fsManager = wx.getFileSystemManager();

    try {
      // 先获取文件信息，检查文件大小
      fsManager.stat({
        path: tempFilePath,
        success: (statRes) => {
          const fileSize = statRes.size;

          // 检查文件大小（4MB限制，使用Worker线程后可以处理更大的文件）
          const MAX_SIZE = 4 * 1024 * 1024;
          if (fileSize > MAX_SIZE) {
            reject(new Error(`文件过大，最大支持 ${MAX_SIZE / (1024 * 1024)}MB 的文件`));
            return;
          }

          // 先以二进制方式读取文件，用于检测真实文件类型
          fsManager.readFile({
            filePath: tempFilePath,
            encoding: 'binary',
            success: (binaryRes) => {
              try {
                  // 使用Worker线程检测文件类型
                parseWorkerManager.detectFileType(binaryRes.data)
                  .then(({ fileType }) => {
                    if (fileType === 'csv') {
                      // CSV文件需要用UTF-8编码重新读取
                      fsManager.readFile({
                        filePath: tempFilePath,
                        encoding: 'utf-8',
                        success: (utf8Res) => {
                          try {
                            // 使用Worker线程解析CSV文件
                            parseWorkerManager.parseCSV(utf8Res.data)
                              .then((result) => {
                                // 添加中文表头映射
                                const resultWithMapping = addChineseFieldMapping(result);
                                parseWorkerManager.destroyWorker(); // 解析完毕，销毁Worker释放单例线程
                                resolve(resultWithMapping);
                              })
                              .catch((error) => {
                                console.error('Worker CSV解析错误:', error);
                                parseWorkerManager.destroyWorker();
                                reject(new Error('CSV文件解析失败: ' + error.message));
                              });
                          } catch (error) {
                            console.error('CSV解析错误:', error);
                            parseWorkerManager.destroyWorker();
                            reject(new Error('CSV文件解析失败: ' + error.message));
                          }
                        },
                        fail: (csvErr) => {
                          console.error('CSV文件读取失败:', csvErr);
                          parseWorkerManager.destroyWorker();
                          // 区分不同类型的错误
                          let errorMsg = 'CSV文件读取失败';
                          if (csvErr.errMsg && csvErr.errMsg.includes('not exist')) {
                            errorMsg = '文件不存在或已过期，请重新选择文件';
                          } else if (csvErr.errMsg && csvErr.errMsg.includes('permission')) {
                            errorMsg = '文件读取权限不足';
                          } else {
                            errorMsg = 'CSV文件读取失败: ' + (csvErr.errMsg || '未知错误');
                          }
                          reject(new Error(errorMsg));
                        }
                      });
                    } else if (fileType === 'xlsx') {
                      parseWorkerManager.destroyWorker(); // 检测完成，无需 Worker
                      // XLSX文件处理
                      // 将二进制数据转换为ArrayBuffer
                      const arrayBuffer = new ArrayBuffer(binaryRes.data.length);
                      const uint8Array = new Uint8Array(arrayBuffer);
                      for (let i = 0; i < binaryRes.data.length; i++) {
                        uint8Array[i] = binaryRes.data.charCodeAt(i);
                      }

                      try {
                        const result = parseXLSX(arrayBuffer);
                        resolve(result);
                      } catch (error) {
                        console.error('XLSX解析错误:', error);
                        reject(new Error('XLSX文件解析失败: ' + error.message));
                      }
                    } else {
                      parseWorkerManager.destroyWorker();
                      reject(new Error('不支持的文件格式，请上传 CSV 或 XLSX 文件'));
                    }
                  })
                  .catch((error) => {
                    console.error('文件类型检测错误:', error);
                    parseWorkerManager.destroyWorker();
                    reject(new Error('文件类型检测失败: ' + error.message));
                  });
              } catch (error) {
                console.error('文件类型检测错误:', error);
                parseWorkerManager.destroyWorker();
                reject(new Error('文件类型检测失败: ' + error.message));
              }
            },
            fail: (error) => {
              console.error('文件读取失败:', error);
              // 详细的错误信息
              let errorMsg = '文件读取失败';
              if (error.errMsg) {
                if (error.errMsg.includes('not exist')) {
                  errorMsg = '文件不存在或已过期，请重新选择文件';
                } else if (error.errMsg.includes('permission denied')) {
                  errorMsg = '文件读取权限不足';
                } else if (error.errMsg.includes('too large')) {
                  errorMsg = '文件过大，无法读取';
                } else {
                  errorMsg = '文件读取失败: ' + error.errMsg;
                }
              }
              reject(new Error(errorMsg));
            }
          });
        },
        fail: (statError) => {
          console.error('获取文件信息失败:', statError);
          reject(new Error('获取文件信息失败: ' + (statError.errMsg || '未知错误')));
        }
      });
    } catch (error) {
      console.error('读取文件失败:', error);
      reject(new Error('读取文件失败: ' + error.message));
    }
  });
}

/**
 * 验证解析后的数据结构是否符合要求
 * @param {Object} parsedData - 解析后的数据
 * @returns {boolean} - 是否验证通过
 */
function validateParsedData(parsedData) {
  // 基础结构验证
  if (!parsedData || typeof parsedData !== 'object') {
    console.error('验证失败: 解析结果为空或非对象');
    return false;
  }

  // 验证 headers 是否为数组
  if (!Array.isArray(parsedData.headers)) {
    console.error('验证失败: headers 不是数组');
    return false;
  }

  // 验证 data 是否为数组
  if (!Array.isArray(parsedData.data)) {
    console.error('验证失败: data 不是数组');
    return false;
  }

  // 验证 headers 是否为空
  if (parsedData.headers.length === 0) {
    console.error('验证失败: headers 为空');
    return false;
  }

  // 验证每个 header 是否为有效字符串
  const validHeaders = parsedData.headers.filter(h => h && typeof h === 'string' && h.trim() !== '');
  if (validHeaders.length === 0) {
    console.error('验证失败: 没有有效的 header 字段');
    return false;
  }

  // 检查数据行是否与表头匹配
  for (let i = 0; i < parsedData.data.length; i++) {
    const row = parsedData.data[i];
    if (typeof row !== 'object' || row === null) {
      console.error(`验证失败: 第 ${i + 1} 行数据格式错误`);
      return false;
    }
  }

  console.log('数据验证通过:', {
    headers: parsedData.headers.length,
    rows: parsedData.data.length
  });

  return true;
}

module.exports = {
  parseCSV,
  parseXLSX,
  readFileFromPath,
  validateParsedData
};
