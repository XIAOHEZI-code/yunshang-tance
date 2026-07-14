// common.js - 通用工具函数

/**
 * 格式化日期时间
 * @param {Date|string} date - 日期对象或日期字符串
 * @param {string} format - 格式化字符串，默认 'YYYY-MM-DD HH:mm:ss'
 * @returns {string} - 格式化后的日期时间字符串
 */
function formatDateTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 格式化数字，添加千分位分隔符
 * @param {number|string} num - 要格式化的数字
 * @param {number} decimalPlaces - 保留的小数位数，默认 2
 * @returns {string} - 格式化后的数字字符串
 */
function formatNumber(num, decimalPlaces = 2) {
  const n = parseFloat(num);

  if (isNaN(n)) {
    return '0.00';
  }

  // 保留指定小数位数
  const fixedNum = n.toFixed(decimalPlaces);

  // 添加千分位分隔符
  const parts = fixedNum.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return parts.join('.');
}

/**
 * 显示提示框
 * @param {string} title - 提示标题
 * @param {string} content - 提示内容
 * @param {string} type - 提示类型：success, error, info, warning
 * @param {Object} options - 其他选项，如duration, showCancel等
 */
function showToast(title, content = '', type = 'success', options = {}) {
  if (content) {
    // 显示模态对话框
    wx.showModal({
      title,
      content,
      showCancel: options.showCancel || false,
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      success(res) {
        if (res.confirm && options.onConfirm) {
          options.onConfirm();
        } else if (res.cancel && options.onCancel) {
          options.onCancel();
        }
      },
      fail(err) {
        console.error('显示模态框失败:', err);
      }
    });
  } else {
    // 显示Toast提示
    wx.showToast({
      title,
      icon:
        type === 'success' ?
          'success' :
          type === 'error' ?
            'error' :
            type === 'loading' ?
              'loading' :
              'none',
      duration: options.duration || 2000,
      mask: options.mask || false
    });
  }
}

/**
 * 显示加载提示
 * @param {string} title - 加载提示文字，默认 '加载中...'
 */
function showLoading(title = '加载中...') {
  wx.showLoading({
    title,
    mask: true
  });
}

/**
 * 隐藏加载提示
 */
function hideLoading() {
  wx.hideLoading();
}

/**
 * 验证文件是否为CSV或XLSX格式
 * @param {string} fileName - 文件名
 * @returns {boolean} - 是否为有效格式
 */
function isValidFileType(fileName) {
  const lowerFileName = fileName.toLowerCase();
  return lowerFileName.endsWith('.csv') || lowerFileName.endsWith('.xlsx');
}

/**
 * 验证数值是否为有效数字
 * @param {any} value - 要验证的值
 * @returns {boolean} - 是否为有效数字
 */
function isValidNumber(value) {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * 深拷贝对象
 * @param {Object} obj - 要拷贝的对象
 * @returns {Object} - 拷贝后的对象
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item));
  }

  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

/**
 * 生成唯一ID
 * @returns {string} - 唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 防抖函数
 * @param {Function} func - 要执行的函数
 * @param {number} delay - 延迟时间，单位毫秒
 * @returns {Function} - 防抖处理后的函数
 */
function debounce(func, delay = 300) {
  let timeoutId;

  return function(...args) {
    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * 节流函数
 * @param {Function} func - 要执行的函数
 * @param {number} limit - 限制时间，单位毫秒
 * @returns {Function} - 节流处理后的函数
 */
function throttle(func, limit = 300) {
  let inThrottle;

  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * 计算数组的总和
 * @param {Array} arr - 数值数组
 * @returns {number} - 总和
 */
function sum(arr) {
  if (!Array.isArray(arr)) {
    return 0;
  }

  return arr.reduce((acc, val) => acc + (isValidNumber(val) ? val : 0), 0);
}

/**
 * 计算数组的平均值
 * @param {Array} arr - 数值数组
 * @param {number} decimalPlaces - 保留的小数位数，默认 2
 * @returns {number} - 平均值
 */
function average(arr, decimalPlaces = 2) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return 0;
  }

  const validNumbers = arr.filter(isValidNumber);

  if (validNumbers.length === 0) {
    return 0;
  }

  const avg = sum(validNumbers) / validNumbers.length;
  return parseFloat(avg.toFixed(decimalPlaces));
}

/**
 * 数组去重
 * @param {Array} arr - 要去重的数组
 * @param {string} key - 如果是对象数组，根据哪个键去重
 * @returns {Array} - 去重后的数组
 */
function uniqueArray(arr, key = '') {
  if (!Array.isArray(arr)) {
    return [];
  }

  if (key) {
    // 对象数组去重
    const seen = new Set();
    return arr.filter((item) => {
      const value = item[key];
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  } else {
    // 普通数组去重
    return [...new Set(arr)];
  }
}

/**
 * 将对象转换为URL查询字符串
 * @param {Object} obj - 要转换的对象
 * @returns {string} - URL查询字符串
 */
function objectToQueryString(obj) {
  if (!obj || typeof obj !== 'object') {
    return '';
  }

  const params = [];

  for (const key in obj) {
    if (
      Object.hasOwn(obj, key) &&
      obj[key] !== undefined &&
      obj[key] !== null
    ) {
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`);
    }
  }

  return params.length > 0 ? `?${params.join('&')}` : '';
}

/**
 * 将URL查询字符串转换为对象
 * @param {string} queryString - URL查询字符串
 * @returns {Object} - 转换后的对象
 */
function queryStringToObject(queryString) {
  if (!queryString || typeof queryString !== 'string') {
    return {};
  }

  // 移除开头的问号
  const qs = queryString.startsWith('?') ? queryString.slice(1) : queryString;

  return qs.split('&').reduce((obj, pair) => {
    const [key, value] = pair.split('=');
    if (key) {
      obj[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
    return obj;
  }, {});
}

/**
 * 获取当前页面路径
 * @returns {string} - 当前页面路径
 */
function getCurrentPagePath() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  return currentPage ? currentPage.route : '';
}

/**
 * 跳转到指定页面
 * @param {string} url - 页面路径
 * @param {Object} params - 页面参数
 * @param {boolean} redirect - 是否使用重定向，默认 false
 */
function navigateTo(url, params = {}, redirect = false) {
  let fullUrl = url;

  // 添加参数
  if (Object.keys(params).length > 0) {
    const queryString = objectToQueryString(params);
    fullUrl += queryString;
  }

  if (redirect) {
    wx.redirectTo({
      url: fullUrl,
      fail(err) {
        console.error('页面重定向失败:', err);
      }
    });
  } else {
    wx.navigateTo({
      url: fullUrl,
      fail(err) {
        console.error('页面跳转失败:', err);
      }
    });
  }
}

/**
 * 返回上一页
 * @param {number} delta - 返回的页数，默认 1
 */
function navigateBack(delta = 1) {
  wx.navigateBack({
    delta
  });
}

/**
 * 跳转到首页
 */
function navigateToHome() {
  wx.switchTab({
    url: '/pages/index/index',
    fail(err) {
      console.error('跳转到首页失败:', err);
    }
  });
}

/**
 * 获取系统信息
 * @returns {Object} - 系统信息
 */
function getSystemInfo() {
  try {
    // 使用新版 API 替代废弃的 getSystemInfoSync
    const deviceInfo  = wx.getDeviceInfo  ? wx.getDeviceInfo()  : {};
    const windowInfo  = wx.getWindowInfo  ? wx.getWindowInfo()  : {};
    return {
      platform:     deviceInfo.platform     || 'devtools',
      windowWidth:  windowInfo.windowWidth  || 375,
      windowHeight: windowInfo.windowHeight || 667,
      screenWidth:  windowInfo.screenWidth  || 375,
      screenHeight: windowInfo.screenHeight || 667,
      pixelRatio:   windowInfo.pixelRatio   || 2
    };
  } catch (error) {
    console.error('获取系统信息失败:', error);
    return { windowWidth: 375, windowHeight: 667, pixelRatio: 2 };
  }
}

/**
 * 获取屏幕宽度
 * @returns {number} - 屏幕宽度，单位px
 */
function getScreenWidth() {
  const systemInfo = getSystemInfo();
  return systemInfo.windowWidth || 375;
}

/**
 * 获取屏幕高度
 * @returns {number} - 屏幕高度，单位px
 */
function getScreenHeight() {
  const systemInfo = getSystemInfo();
  return systemInfo.windowHeight || 667;
}

/**
 * 将rpx转换为px
 * @param {number} rpx - rpx值
 * @returns {number} - px值
 */
function rpxToPx(rpx) {
  const screenWidth = getScreenWidth();
  return (rpx * screenWidth) / 750;
}

/**
 * 将px转换为rpx
 * @param {number} px - px值
 * @returns {number} - rpx值
 */
function pxToRpx(px) {
  const screenWidth = getScreenWidth();
  return (px * 750) / screenWidth;
}

/**
 * 安全序列化对象，处理循环引用和非序列化数据
 * @param {Object} obj - 要序列化的对象
 * @returns {Object} - 安全的可序列化对象
 */
function safeSerialize(obj) {
  const cache = new Set();
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return; // Circular reference found, discard key
        }
        cache.add(value);
      }
      return value;
    })
  );
}

// 兼容 CommonJS require() 写法
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatDateTime, formatNumber, showToast, showLoading, hideLoading,
    isValidFileType, isValidNumber, deepClone, generateId,
    debounce, throttle, sum, average, uniqueArray,
    objectToQueryString, queryStringToObject,
    getCurrentPagePath, navigateTo, navigateBack, navigateToHome,
    getSystemInfo, getScreenWidth, getScreenHeight,
    rpxToPx, pxToRpx, safeSerialize
  };
}
