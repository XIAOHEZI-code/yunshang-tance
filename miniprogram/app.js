// app.js
const cloudService = require('./services/cloudService.js');

App({
  onLaunch() {
    // 初始化云开发环境
    cloudService.initCloud();

    // 只保留最近 10 条启动日志，防止数据无限增长导致 Storage timeout
    const logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs.slice(0, 10));

    // 登录（开发工具环境跳过，避免 Linux DevTools 上 wx.login 网络超时）
    try {
      const accountInfo = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
      const envVersion = accountInfo?.miniProgram?.envVersion;
      // 只在正式版/体验版发起登录，开发工具里跳过（避免 timeout）
      if (envVersion === 'release' || envVersion === 'trial') {
        wx.login({
          success: () => {
            // 发送 res.code 到后台换取 openId, sessionKey, unionId
          },
          fail: (err) => {
            console.warn('wx.login 失败，不影响功能:', err);
          }
        });
      } else {
        // 开发工具（devtools）：wx.login 可能因网络问题 timeout，跳过
        console.log('[Dev] 跳过 wx.login（开发环境）');
      }
    } catch (e) {
      console.warn('登录初始化失败:', e);
    }
  },
  globalData: {
    userInfo: null
  }
});

