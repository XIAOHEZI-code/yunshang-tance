// dataStore.js - 数据管理页面逻辑

const {
  getTableSchema,
  queryData,
  truncateTable
} = require('../../utils/sqlStore');
const { formatDateTime } = require('../../utils/common');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    tableSchema: null, // 数据表结构
    tableData: [], // 数据表数据
    loading: false // 是否正在加载
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    // 页面加载时加载数据
    this.loadTableData();
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
    // 页面显示时重新加载数据
    this.loadTableData();
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
    // 下拉刷新时重新加载数据
    this.loadTableData();
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
      title: '数据管理 - 数据分析小程序',
      path: '/pages/dataStore/dataStore'
    };
  },

  /**
   * 加载数据表数据
   */
  loadTableData() {
    try {
      // 获取表结构
      const tableSchema = getTableSchema('analysis_data');

      if (tableSchema) {
        // 格式化日期
        tableSchema.createdAt = formatDateTime(
          tableSchema.createdAt,
          'YYYY-MM-DD HH:mm:ss'
        );
        tableSchema.updatedAt = formatDateTime(
          tableSchema.updatedAt,
          'YYYY-MM-DD HH:mm:ss'
        );

        // 查询前20行数据用于预览
        const queryResult = queryData('analysis_data', { limit: 20 });
        const tableData = queryResult.success ? queryResult.data : [];

        this.setData({
          tableSchema,
          tableData
        });
      } else {
        // 没有数据表
        this.setData({
          tableSchema: null,
          tableData: []
        });
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      this.setData({
        tableSchema: null,
        tableData: []
      });
      wx.showToast({
        title: '加载数据失败',
        icon: 'error'
      });
    }
  },

  /**
   * 刷新数据
   */
  refreshData() {
    wx.showToast({
      title: '刷新中...',
      icon: 'loading',
      duration: 1000
    });

    this.loadTableData();

    setTimeout(() => {
      wx.showToast({
        title: '数据已刷新',
        icon: 'success'
      });
    }, 1000);
  },

  /**
   * 显示清空数据确认提示
   */
  showClearConfirm() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有数据吗？此操作不可恢复。',
      showCancel: true,
      confirmText: '确定清空',
      cancelText: '取消',
      confirmColor: '#f5222d',
      success: (res) => {
        if (res.confirm) {
          this.clearData();
        }
      },
      fail: (err) => {
        console.error('显示确认框失败:', err);
      }
    });
  },

  /**
   * 清空数据
   */
  clearData() {
    try {
      truncateTable('analysis_data');

      // 清除缓存
      wx.clearStorageSync();

      this.setData({
        tableSchema: null,
        tableData: []
      });

      wx.showToast({
        title: '数据已清空',
        icon: 'success'
      });
    } catch (error) {
      console.error('清空数据失败:', error);
      wx.showToast({
        title: '清空数据失败',
        icon: 'error'
      });
    }
  },

  /**
   * 导航到数据解析页面
   */
  navigateToDataParse() {
    wx.navigateTo({
      url: '/pages/dataParse/dataParse',
      fail: (err) => {
        console.error('导航到数据解析页面失败:', err);
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
      fail: (err) => {
        console.error('导航到数据分析页面失败:', err);
        wx.showToast({
          title: '导航失败',
          icon: 'error'
        });
      }
    });
  }
});
