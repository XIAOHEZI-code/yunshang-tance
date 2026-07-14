// index.js - 小程序首页逻辑

const { getTableSchema, queryData } = require('../../utils/sqlStore');
const { formatDateTime } = require('../../utils/common');
const envDetector = require('../../utils/env');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 设备类型相关数据
    deviceInfo: {
      isDesktop: false,
      isMobile: true,
      platform: '',
      screenWidth: 0,
      screenHeight: 0,
      layoutMode: 'mobile' // 'mobile' 或 'desktop'
    },
    
    // 数据概览
    dataStats: {
      rowCount: 0, // 数据行数
      columnCount: 0, // 数据列数
      tableCount: 0, // 数据表数量
      lastUpdated: '' // 最后更新时间
    },
    
    // 其他数据
    uploadedFileCount: 0, // 已上传文件数量
    recentActivities: [] // 最近操作记录
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    // 页面加载时的初始化逻辑
    this.detectDeviceAndLayout();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    // 页面渲染完成时的逻辑
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 页面显示时更新数据概览
    this.updateDataStats();
    // 重新检测设备类型（以防设备旋转等情况）
    this.detectDeviceAndLayout();
  },

  /**
   * 检测设备类型和布局模式
   */
  detectDeviceAndLayout() {
    try {
      // 获取环境信息
      const envInfo = envDetector.getEnvInfo();
      const { isDesktop, platform, screenInfo } = envInfo;
      
      // 确定布局模式
      const layoutMode = isDesktop ? 'desktop' : 'mobile';
      
      // 更新设备信息
      this.setData({
        deviceInfo: {
          isDesktop: isDesktop,
          isMobile: !isDesktop,
          platform: platform,
          screenWidth: screenInfo.screenWidth,
          screenHeight: screenInfo.screenHeight,
          layoutMode: layoutMode
        }
      });
      
      console.log('设备检测结果:', {
        isDesktop: isDesktop,
        platform: platform,
        screenWidth: screenInfo.screenWidth,
        screenHeight: screenInfo.screenHeight,
        layoutMode: layoutMode
      });
    } catch (error) {
      console.error('设备检测失败:', error);
      // 设置默认值
      this.setData({
        deviceInfo: {
          isDesktop: false,
          isMobile: true,
          platform: 'unknown',
          screenWidth: 375,
          screenHeight: 667,
          layoutMode: 'mobile'
        }
      });
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    // 页面隐藏时的逻辑
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 页面卸载时的逻辑
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    // 下拉刷新时更新数据概览
    this.updateDataStats();
    wx.stopPullDownRefresh();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    // 上拉触底时的逻辑
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    // 分享逻辑
    return {
      title: '数据分析小程序',
      path: '/pages/index/index'
    };
  },

  /**
   * 更新数据概览
   */
  updateDataStats() {
    try {
      // 检查是否存在analysis_data表
      const tableSchema = getTableSchema('analysis_data');

      if (tableSchema) {
        // 查询数据行数
        queryData('analysis_data', { limit: 1 });

        this.setData({
          dataStats: {
            rowCount: tableSchema.rowCount,
            columnCount: tableSchema.columns.length,
            tableCount: 1,
            lastUpdated: formatDateTime(
              tableSchema.updatedAt,
              'YYYY-MM-DD HH:mm'
            )
          },
          uploadedFileCount: 1 // 模拟已上传文件数量
        });
      } else {
        // 没有数据表
        this.setData({
          dataStats: {
            rowCount: 0,
            columnCount: 0,
            tableCount: 0,
            lastUpdated: ''
          },
          uploadedFileCount: 0
        });
      }

      // 加载最近操作记录
      this.loadRecentActivities();
    } catch (error) {
      console.error('更新数据概览失败:', error);
      // 重置为默认值
      this.setData({
        dataStats: {
          rowCount: 0,
          columnCount: 0,
          tableCount: 0,
          lastUpdated: ''
        },
        uploadedFileCount: 0
      });
    }
  },

  /**
   * 加载最近操作记录
   */
  loadRecentActivities() {
    try {
      // 从本地存储获取最近操作记录
      const activities = wx.getStorageSync('recentActivities') || [];

      if (activities.length === 0) {
        // 模拟最近操作记录
        const mockActivities = [
          {
            id: 1,
            type: 'upload',
            icon: '📁',
            title: '上传了新文件',
            desc: 'data.csv',
            time: formatDateTime(new Date(), 'YYYY-MM-DD HH:mm')
          },
          {
            id: 2,
            type: 'analysis',
            icon: '📈',
            title: '执行了数据分析',
            desc: '特征重要性分析',
            time: formatDateTime(new Date(Date.now() - 3600000), 'YYYY-MM-DD HH:mm')
          },
          {
            id: 3,
            type: 'chart',
            icon: '📋',
            title: '生成了图表',
            desc: '相关性分析图表',
            time: formatDateTime(new Date(Date.now() - 7200000), 'YYYY-MM-DD HH:mm')
          }
        ];

        this.setData({
          recentActivities: mockActivities
        });
      } else {
        this.setData({
          recentActivities: activities
        });
      }
    } catch (error) {
      console.error('加载最近操作记录失败:', error);
      this.setData({
        recentActivities: []
      });
    }
  },

  /**
   * 导航到数据解析页面
   */
  navigateToDataParse() {
    wx.navigateTo({
      url: '/pages/dataParse/dataParse',
      fail(err) {
        console.error('导航到数据解析页面失败:', err);
        wx.showToast({
          title: '导航失败',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 导航到数据管理页面
   */
  navigateToDataStore() {
    wx.navigateTo({
      url: '/pages/dataStore/dataStore',
      fail(err) {
        console.error('导航到数据管理页面失败:', err);
        wx.showToast({
          title: '导航失败',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 导航到数据分析页面
   */
  navigateToAnalysis() {
    wx.navigateTo({
      url: '/pages/analysis/analysis',
      fail(err) {
        console.error('导航到数据分析页面失败:', err);
        wx.showToast({
          title: '导航失败',
          icon: 'error'
        });
      }
    });
  }
});
