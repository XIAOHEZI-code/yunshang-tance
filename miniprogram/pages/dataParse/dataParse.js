// dataParse.js - 冶金高炉数据导入页逻辑

const { readFileFromPath, validateParsedData } = require('../../utils/fileParse');
const { createTableFromParsedData } = require('../../utils/sqlStore');
// 分为两行
// 分为两行
// 统一字体大小
//
// 文件上传配置
const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 4 * 1024 * 1024,
  ALLOWED_EXTENSIONS: ['.csv'],
  ALLOWED_TYPES: ['file']
};

Page({
  data: {
    selectedFile: null,
    selectedFileName: '',
    formattedFileSize: '',
    parsedData: null,
    previewData: [],
    parsing: false,
    saving: false,
    statusMessage: '',
    statusType: '',
    isLoading: false,
    // 导入配置
    tableName: 'analysis_data',
    importMode: 'replace' // 'replace' | 'append'
  },

  onLoad() {
    this.initDragAndDrop();
  },

  onReady() {},
  onShow() {},
  onHide() {},
  onUnload() {
    if (this.statusTimer) clearTimeout(this.statusTimer);
  },
  onPullDownRefresh() {
    wx.stopPullDownRefresh();
  },
  onReachBottom() {},

  onShareAppMessage() {
    return { title: '冶金高炉过程数据分析 - 数据导入', path: '/pages/dataParse/dataParse' };
  },

  // ===== 导入配置事件 =====

  /** 表名输入 */
  onTableNameInput(e) {
    const raw = e.detail.value || '';
    const safe = raw.replace(/[^a-zA-Z0-9_]/g, '');
    this.setData({ tableName: safe || 'analysis_data' });
  },

  /** 导入模式切换 */
  setImportMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode) this.setData({ importMode: mode });
  },

  // ===== 文件操作 =====

  /** 选择文件 */
  chooseFile() {
    const that = this;
    if (!wx.canIUse('chooseMessageFile')) {
      wx.showModal({ title: '提示', content: '请升级微信到最新版本', showCancel: false });
      return;
    }
    this.setData({ isLoading: true });
    that.setStatus('正在打开文件选择器...', 'info');

    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: UPLOAD_CONFIG.ALLOWED_EXTENSIONS,
      success: (res) => {
        const file = res.tempFiles[0];
        if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
          that.setStatus(`文件不能超过 ${UPLOAD_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`, 'error');
          that.setData({ isLoading: false });
          return;
        }
        const fileName = file.name.toLowerCase();
        const isValid = UPLOAD_CONFIG.ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
        if (!isValid) {
          that.setStatus('仅支持 CSV 格式文件', 'error');
          that.setData({ isLoading: false });
          return;
        }
        that.setData({
          selectedFile: file,
          selectedFileName: file.name,
          formattedFileSize: that.formatFileSize(file.size),
          statusMessage: '',
          statusType: '',
          isLoading: false
        });
        that.setStatus(`✅ 文件「${file.name}」选择成功，点击"开始解析"`, 'success');
      },
      fail: (err) => {
        that.setData({ isLoading: false });
        if (!err.errMsg?.includes('cancel')) {
          that.setStatus('文件选择失败: ' + (err.errMsg || '未知错误'), 'error');
        }
      },
      complete: () => {
        that.setData({ isLoading: false });
      }
    });
  },

  /** 清除已选文件 */
  clearFile() {
    this.setData({
      selectedFile: null, selectedFileName: '', formattedFileSize: '',
      parsedData: null, previewData: [], statusMessage: '', statusType: ''
    });
  },

  /** 拖放区域点击 */
  onDragDropAreaClick() {
    this.chooseFile();
  },

  /** 格式化文件大小 */
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // ===== 解析 =====

  async parseFile() {
    const { selectedFile } = this.data;
    if (!selectedFile) {
      wx.showToast({ title: '请先选择文件', icon: 'none', duration: 2000 });
      return;
    }
    const fs = wx.getFileSystemManager();
    try {
      fs.accessSync(selectedFile.path);
    } catch (e) {
      wx.showToast({ title: '文件已过期，请重新选择', icon: 'none', duration: 2000 });
      this.clearFile();
      return;
    }

    this.setData({ parsing: true });
    this.setStatus(`正在解析 ${selectedFile.name}...`, 'info');
    wx.showLoading({ title: '解析中...', mask: true });

    try {
      const parsedData = await readFileFromPath(selectedFile.path);
      wx.hideLoading();

      if (!validateParsedData(parsedData)) throw new Error('文件格式错误：缺少表头或数据行');

      this.setData({ parsedData, previewData: parsedData.data.slice(0, 10), parsing: false });
      this.setStatus(`✅ 解析成功！${parsedData.data.length} 行 × ${parsedData.headers.length} 列`, 'success');
      wx.showToast({ title: '解析成功', icon: 'success', duration: 1500 });

    } catch (error) {
      wx.hideLoading();
      console.error('文件解析失败:', error);
      this.setData({ parsing: false });
      this.setStatus('❌ ' + (error.message || '解析失败'), 'error');
      wx.showToast({ title: '解析失败', icon: 'error', duration: 2000 });
    }
  },

  // ===== 保存 =====

  saveData() {
    const { parsedData, selectedFileName, tableName, importMode } = this.data;
    if (!parsedData) {
      wx.showToast({ title: '请先解析文件', icon: 'none', duration: 2000 });
      return;
    }
    const modeLabel = importMode === 'append' ? '追加' : '覆盖';
    wx.showModal({
      title: '确认保存',
      content: `将${modeLabel} ${parsedData.data.length} 行数据到表 [${tableName}]，是否继续？`,
      success: (res) => {
        if (res.confirm) this.doSaveData(parsedData, selectedFileName);
      }
    });
  },

  doSaveData(parsedData, fileName) {
    this.setData({ saving: true });
    const { tableName, importMode } = this.data;
    const modeLabel = importMode === 'append' ? '追加' : '覆盖';
    this.setStatus(`正在${modeLabel}保存到表 [${tableName}]...`, 'info');
    wx.showLoading({ title: `${modeLabel}中...`, mask: true });

    try {
      const result = createTableFromParsedData(tableName, parsedData, importMode);
      this.saveOperationHistory('upload', fileName, parsedData.data.length);
      this.setData({ saving: false });
      wx.hideLoading();

      const inserted = result.insertedCount?.insertedCount ?? result.insertedCount;
      this.setStatus(`✅ ${modeLabel}成功！${inserted} 行数据已写入 [${tableName}]`, 'success');
      wx.showToast({ title: `${modeLabel}成功`, icon: 'success', duration: 1500 });

      setTimeout(() => {
        wx.navigateTo({ url: '/pages/dataStore/dataStore' });
      }, 1500);

    } catch (error) {
      wx.hideLoading();
      console.error('数据保存失败:', error);
      this.setData({ saving: false });
      this.setStatus('❌ 保存失败: ' + (error.message || '保存失败'), 'error');
      wx.showToast({ title: '保存失败', icon: 'error', duration: 2000 });
    }
  },

  /** 保存操作历史 */
  saveOperationHistory(type, fileName, rowCount) {
    try {
      const activities = wx.getStorageSync('recentActivities') || [];
      activities.unshift({
        id: Date.now(), type, icon: '📥',
        title: `导入了文件（${this.data.importMode === 'append' ? '追加' : '覆盖'}）`,
        desc: `${fileName} → [${this.data.tableName}]（${rowCount} 行）`,
        time: new Date().toLocaleString('zh-CN')
      });
      if (activities.length > 10) activities.pop();
      wx.setStorageSync('recentActivities', activities);
    } catch (e) {
      console.error('保存操作历史失败:', e);
    }
  },

  /** 设置状态提示 */
  setStatus(message, type = 'info') {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.setData({ statusMessage: message, statusType: type });
    if (type !== 'error' && message) {
      this.statusTimer = setTimeout(() => {
        this.setData({ statusMessage: '', statusType: '' });
      }, 5000);
    }
  },

  /** 初始化拖放 */
  initDragAndDrop() {
    const info = wx.getDeviceInfo ? wx.getDeviceInfo() : wx.getSystemInfoSync();
    const isDesktop = ['devtools', 'windows', 'mac'].includes(info.platform);
    if (isDesktop) console.log('桌面端：点击区域选择文件');
  },

  setupDragDropEvents() {},

  handleFileDrop(files) {
    if (files?.length) {
      const file = files[0];
      const isValid = UPLOAD_CONFIG.ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
      if (!isValid) {
        this.setStatus('仅支持 CSV 格式文件', 'error'); return;
      }
      if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
        this.setStatus('文件过大（最大4MB）', 'error'); return;
      }
      this.setData({ selectedFile: file, selectedFileName: file.name, formattedFileSize: this.formatFileSize(file.size) });
      this.setStatus(`文件「${file.name}」拖放成功，点击"开始解析"`, 'success');
    }
  }
});
