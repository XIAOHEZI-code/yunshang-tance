// 环境检测工具，用于识别设备类型和能力

class EnvDetector {
  constructor() {
    this._detectEnvironment();
  }

  // 统一获取系统信息（使用新 API，一次性缓存，避免重复调用）
  _getSystemInfo() {
    if (this._cachedSysInfo) return this._cachedSysInfo;
    if (typeof wx === 'undefined') {
      this._cachedSysInfo = {
        platform: 'node', screenWidth: 1920, screenHeight: 1080,
        windowWidth: 1920, windowHeight: 1080, pixelRatio: 1,
        version: '', language: 'zh_CN', memorySize: 8192
      };
      return this._cachedSysInfo;
    }

    try {
      // 基础库 2.20.1+ 新 API，分别获取各类信息
      const deviceInfo  = wx.getDeviceInfo  ? wx.getDeviceInfo()  : {};
      const windowInfo  = wx.getWindowInfo  ? wx.getWindowInfo()  : {};
      const appBaseInfo = wx.getAppBaseInfo ? wx.getAppBaseInfo() : {};

      this._cachedSysInfo = {
        platform:    deviceInfo.platform    || 'devtools',
        screenWidth: windowInfo.screenWidth  || windowInfo.windowWidth  || 375,
        screenHeight: windowInfo.screenHeight || windowInfo.windowHeight || 667,
        windowWidth: windowInfo.windowWidth  || 375,
        windowHeight: windowInfo.windowHeight || 667,
        pixelRatio:  windowInfo.pixelRatio   || 2,
        version:     appBaseInfo.version     || '',
        language:    appBaseInfo.language    || 'zh_CN',
        memorySize:  deviceInfo.memorySize   || 0   // MB，0 表示未知
      };
    } catch (e) {
      // 降级兜底，确保不会崩溃
      this._cachedSysInfo = {
        platform: 'devtools', screenWidth: 375, screenHeight: 667,
        windowWidth: 375, windowHeight: 667, pixelRatio: 2,
        version: '', language: 'zh_CN', memorySize: 0
      };
    }
    return this._cachedSysInfo;
  }

  // 检测环境
  _detectEnvironment() {
    const sysInfo = this._getSystemInfo();
    this.platform = sysInfo.platform;
    this.isDesktop = this._isDesktopByInfo(sysInfo);
    this.isMobile = !this.isDesktop;
    this.browserInfo = {
      version:   sysInfo.version,
      userAgent: '',
      language:  sysInfo.language
    };
    this.screenInfo = {
      screenWidth:  sysInfo.screenWidth,
      screenHeight: sysInfo.screenHeight,
      windowWidth:  sysInfo.windowWidth,
      windowHeight: sysInfo.windowHeight,
      pixelRatio:   sysInfo.pixelRatio
    };
    this.deviceCapabilities = this._getDeviceCapabilities(sysInfo);
  }

  // 根据系统信息判断是否桌面端
  _isDesktopByInfo(sysInfo) {
    const { screenWidth, screenHeight, platform } = sysInfo;
    const isLargeScreen = screenWidth >= 768 || screenHeight >= 768;
    const isDesktopPlatform = ['devtools', 'windows', 'mac', 'linux'].includes(platform);
    return isLargeScreen || isDesktopPlatform;
  }

  // 获取设备能力
  _getDeviceCapabilities(sysInfo) {
    const { platform, memorySize } = sysInfo;
    let computeCapability = 'low';
    if (['devtools', 'windows', 'mac', 'linux'].includes(platform)) {
      computeCapability = 'high';
    } else if (memorySize >= 4096) {  // >= 4GB
      computeCapability = 'medium';
    }

    return {
      supportsWorkers: typeof wx !== 'undefined' && typeof wx.createWorker === 'function' && platform !== 'devtools',
      supportsFileSystem: typeof wx !== 'undefined' && typeof wx.getFileSystemManager === 'function',
      supportsDragDrop: typeof wx !== 'undefined' && typeof wx.createSelectorQuery === 'function',
      supportsKeyboard: true,
      supportsMouse: true,
      computeCapability
    };
  }

  // 获取环境信息
  getEnvInfo() {
    return {
      platform: this.platform,
      isDesktop: this.isDesktop,
      isMobile: this.isMobile,
      browserInfo: this.browserInfo,
      screenInfo: this.screenInfo,
      deviceCapabilities: this.deviceCapabilities
    };
  }

  isDevTools() { return this.platform === 'devtools'; }
  isWindows()  { return this.platform === 'windows';  }
  isMacOS()    { return this.platform === 'mac';      }
  isLinux()    { return this.platform === 'linux';    }
  isIOS()      { return this.platform === 'ios';      }
  isAndroid()  { return this.platform === 'android';  }

  // 获取推荐的渲染策略
  getRecommendedRenderStrategy() {
    return this.isDesktop
      ? { chartType: 'canvas', animation: true,  responsive: true, maxDataPoints: 10000 }
      : { chartType: 'canvas', animation: false, responsive: true, maxDataPoints: 1000  };
  }

  // 获取推荐的计算策略
  getRecommendedComputeStrategy() {
    const cap = this.deviceCapabilities.computeCapability;
    if (cap === 'high')   return { useWorker: true,  batchSize: 1000, parallelTasks: 4 };
    if (cap === 'medium') return { useWorker: true,  batchSize: 500,  parallelTasks: 2 };
    return                       { useWorker: false, batchSize: 100,  parallelTasks: 1 };
  }

  // 更新环境信息（清空缓存后重新检测）
  updateEnvInfo() {
    this._cachedSysInfo = null;
    this._detectEnvironment();
    return this.getEnvInfo();
  }
}


// 导出单例实例
const envDetector = new EnvDetector();

module.exports = envDetector;
module.exports.default = envDetector;   // 兼容 require('...').default 写法
module.exports.EnvDetector = EnvDetector;
