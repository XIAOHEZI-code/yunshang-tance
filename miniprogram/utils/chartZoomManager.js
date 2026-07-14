/**
 * ChartZoomManager - 图表缩放管理类
 * 职责：管理图表的悬浮、缩放、还原等交互功能
 */
class ChartZoomManager {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.chartContainerId - 原图表容器ID
   * @param {Object} options.chartInstance - 原图表实例
   * @param {Object} options.page - 必填：小程序 page 实例
   * @param {string} options.maskId - 可选：遮罩层的 WXML 数据绑定标识
   * @param {Function} options.onShowFloating - 可选：自定义显示悬浮层回调
   * @param {Function} options.onHideFloating - 可选：自定义隐藏悬浮层回调
   * @param {number} options.minScale - 最小缩放比例，默认0.8
   * @param {number} options.maxScale - 最大缩放比例，默认3.0
   */
  constructor(options) {
    // 参数校验
    if (!options.page) {
      throw new Error('page is required');
    }

    if (options.minScale !== undefined && options.minScale <= 0) {
      throw new Error('minScale must be greater than 0');
    }

    if (
      options.maxScale !== undefined &&
      options.minScale !== undefined &&
      options.maxScale < options.minScale
    ) {
      throw new Error('maxScale must be greater than or equal to minScale');
    }

    this.options = {
      minScale: 0.8,
      maxScale: 3.0,
      ...options
    };

    this.chartContainerId = this.options.chartContainerId;
    this.chartInstance = this.options.chartInstance;
    this.page = this.options.page;
    this.maskId = this.options.maskId; // 新增：遮罩层的 WXML 数据绑定标识
    this.onShowFloating = this.options.onShowFloating;
    this.onHideFloating = this.options.onHideFloating;
    this.minScale = this.options.minScale;
    this.maxScale = this.options.maxScale;

    // 状态变量
    this.isFloating = false; // 是否处于悬浮状态
    this.currentScale = 1; // 当前缩放比例
    this.lastScale = 1; // 上一次缩放比例
    this.touchStartDistance = 0; // 双指开始距离
    this.lastTouchTime = 0; // 上次触摸时间（用于节流）
    this.originalState = null; // 原图表初始状态
    this.floatingChartId = `floating-${this.chartContainerId}`; // 悬浮层图表ID

    // 双指缩放相关变量
    this.focalPoint = null; // 双指中点
    this.elementCenter = null; // 元素中心
    this.focalOffset = null; // 双指中点与元素中心的偏移
    this.currentTranslate = { x: 0, y: 0 }; // 当前平移量

    // Canvas 清晰度优化相关变量
    this.originalCanvasPixelWidth = null;
    this.originalCanvasPixelHeight = null;
    this._clarityScheduled = false;

    // 初始化
    this.init();
  }

  /**
   * 初始化
   */
  init() {
    try {
      // 保存原图表初始状态
      this.saveOriginalState();

      // 保存原始 canvas 尺寸
      this.saveOriginalCanvasSize();

      // 绑定事件
      this.bindEvents();

      console.log('ChartZoomManager initialized successfully');
    } catch (error) {
      console.error('ChartZoomManager initialization failed:', error);
    }
  }

  /**
   * 保存原始 canvas 尺寸
   */
  saveOriginalCanvasSize() {
    try {
      if (this.chartInstance && this.chartInstance.canvas) {
        const canvas = this.chartInstance.canvas;
        this.originalCanvasPixelWidth = canvas.width;
        this.originalCanvasPixelHeight = canvas.height;
        console.log(
          'Original canvas size saved:',
          this.originalCanvasPixelWidth,
          this.originalCanvasPixelHeight
        );
      }
    } catch (error) {
      console.error('Failed to save original canvas size:', error);
    }
  }

  /**
   * 保存原图表初始状态
   */
  saveOriginalState() {
    try {
      const query = wx.createSelectorQuery();
      query
        .select(`#${this.chartContainerId}`)
        .fields({ size: true, rect: true })
        .exec((res) => {
          if (res && res[0]) {
            this.originalState = {
              width: res[0].width,
              height: res[0].height,
              top: res[0].top,
              left: res[0].left
            };
            console.log('Original chart state saved:', this.originalState);
          }
        });
    } catch (error) {
      console.error('Failed to save original chart state:', error);
    }
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 事件绑定将在页面逻辑中处理
  }

  /**
   * 处理图表点击事件，触发悬浮
   */
  handleChartClick() {
    if (this.isFloating) return;

    try {
      // 获取原图表位置信息
      const query = wx.createSelectorQuery();
      query
        .select(`#${this.chartContainerId}`)
        .fields({ rect: true })
        .exec((res) => {
          if (res && res[0]) {
            const rect = res[0];

            // 显示悬浮层
            this.showFloatingLayer(rect);

            // 隐藏原图表
            this.hideOriginalChart();
          }
        });
    } catch (error) {
      console.error('Failed to handle chart click:', error);
    }
  }

  /**
   * 显示悬浮层
   * @param {Object} rect - 原图表位置信息
   */
  showFloatingLayer(rect) {
    try {
      if (this.page) {
        // 先显示遮罩层
        if (this.maskId) {
          this.page.setData({
            [this.maskId]: true
          });
        }

        // 禁用页面滚动（可选）
        this.disablePageScroll();

        // 通过 page.setData 控制悬浮层的显示
        this.page.setData({
          isChartFloating: true,
          isChartHidden: true
        });
      }

      // 调用自定义回调
      if (this.onShowFloating) {
        this.onShowFloating(rect);
      }

      this.isFloating = true;
      console.log('Floating layer shown');
    } catch (error) {
      console.error('Failed to show floating layer:', error);
    }
  }

  /**
   * 禁用页面滚动（可选）
   */
  disablePageScroll() {
    try {
      // 在小程序中，禁用页面滚动的方法是给页面根节点添加样式
      // 这里通过 page.setData 来控制
      if (this.page) {
        this.page.setData({
          pageScrollDisabled: true
        });
      }
    } catch (error) {
      console.error('Failed to disable page scroll:', error);
    }
  }

  /**
   * 隐藏原图表
   */
  hideOriginalChart() {
    try {
      if (this.page) {
        this.page.setData({
          isChartHidden: true
        });
      }
      console.log('Original chart hidden');
    } catch (error) {
      console.error('Failed to hide original chart:', error);
    }
  }

  /**
   * 处理触摸开始事件
   * @param {Object} e - 触摸事件对象
   */
  handleTouchStart(e) {
    if (!this.isFloating) return;

    // 只有双指触摸才进行缩放
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      // 保存双指开始距离和上一次缩放比例
      this.touchStartDistance = this.getDistance(touch1, touch2);
      this.lastScale = this.currentScale;

      // 保存双指中点（缩放焦点）
      this.focalPoint = {
        x: (touch1.pageX + touch2.pageX) / 2,
        y: (touch1.pageY + touch2.pageY) / 2
      };

      // 计算浮层元素的中心
      this.calculateElementCenter();
    }
  }

  /**
   * 计算浮层元素的中心
   */
  calculateElementCenter() {
    try {
      const query = wx.createSelectorQuery();
      query
        .select('.floating-chart-content')
        .fields({ rect: true })
        .exec((res) => {
          if (res && res[0]) {
            const rect = res[0];
            this.elementCenter = {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2
            };

            // 计算并保存双指中点与元素中心的偏移
            if (this.focalPoint) {
              this.focalOffset = {
                x: this.focalPoint.x - this.elementCenter.x,
                y: this.focalPoint.y - this.elementCenter.y
              };
            }
          }
        });
    } catch (error) {
      console.error('Failed to calculate element center:', error);
    }
  }

  /**
   * 处理触摸移动事件（带节流）
   * @param {Object} e - 触摸事件对象
   */
  handleTouchMove(e) {
    if (!this.isFloating) return;

    // 只有双指触摸才进行缩放
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = this.getDistance(touch1, touch2);

      // 计算缩放比例
      if (this.touchStartDistance > 0 && this.focalOffset) {
        const scaleRatio = currentDistance / this.touchStartDistance;
        let newScale = this.lastScale * scaleRatio;

        // 限制缩放范围
        newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));

        // 更新缩放比例
        this.currentScale = newScale;

        // 计算平移量，使缩放以双指中点为中心
        const translateX = (1 - newScale) * this.focalOffset.x;
        const translateY = (1 - newScale) * this.focalOffset.y;
        this.currentTranslate = { x: translateX, y: translateY };

        // 应用变换
        this.applyTransform();

        // 优化canvas清晰度（使用节流）
        if (!this._clarityScheduled && this.currentScale > 1.5) {
          this._clarityScheduled = true;
          setTimeout(() => {
            this._clarityScheduled = false;
            this.optimizeCanvasClarity();
          }, 200);
        }
      }
    }
  }

  /**
   * 处理触摸结束事件
   */
  handleTouchEnd() {
    // 保存当前缩放比例，以便下次触摸开始时使用
    this.lastScale = this.currentScale;

    // 清理触摸状态
    this.touchStartDistance = 0;
    this.focalPoint = null;
    this.elementCenter = null;
    this.focalOffset = null;

    // 在触摸结束时应用一次完整的 canvas 清晰度优化
    if (this.currentScale > 1.5) {
      this.optimizeCanvasClarity();
    }
  }

  /**
   * 计算两点之间的距离
   * @param {Object} touch1 - 第一个触摸点
   * @param {Object} touch2 - 第二个触摸点
   * @returns {number} 距离
   */
  getDistance(touch1, touch2) {
    const dx = touch1.pageX - touch2.pageX;
    const dy = touch1.pageY - touch2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 应用变换（缩放和平移）
   */
  applyTransform() {
    try {
      if (!this.page) return;

      // 计算变换样式
      const translateX = this.currentTranslate.x;
      const translateY = this.currentTranslate.y;
      const scale = this.currentScale;

      // 构建变换字符串
      const transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

      // 通过 page.setData 更新样式
      this.page.setData({
        floatingChartTransform: transform
      });

      console.log('Transform applied:', transform);
    } catch (error) {
      console.error('Failed to apply transform:', error);
    }
  }

  /**
   * 优化canvas清晰度
   */
  optimizeCanvasClarity() {
    try {
      if (
        this.chartInstance &&
        this.chartInstance.canvas &&
        this.currentScale > 1.5
      ) {
        const canvas = this.chartInstance.canvas;

        // 使用原始保存的 canvas 像素尺寸，避免每次都重新计算
        if (this.originalCanvasPixelWidth && this.originalCanvasPixelHeight) {
          // 根据当前缩放比例调整 canvas 尺寸
          const newWidth = Math.round(
            this.originalCanvasPixelWidth * this.currentScale
          );
          const newHeight = Math.round(
            this.originalCanvasPixelHeight * this.currentScale
          );

          canvas.width = newWidth;
          canvas.height = newHeight;

          console.log('Canvas clarity optimized:', {
            width: newWidth,
            height: newHeight
          });

          // 重新渲染图表
          if (this.chartInstance.render) {
            this.chartInstance.render();
          }
        }
      }
    } catch (error) {
      console.error('Failed to optimize canvas clarity:', error);
    }
  }

  /**
   * 关闭悬浮层，还原到原位置
   */
  closeFloatingLayer() {
    if (!this.isFloating) return;

    try {
      // 复位 transform 样式
      if (this.page) {
        this.page.setData({
          floatingChartTransform: 'none'
        });
      }

      // 恢复 canvas 原始像素尺寸
      this.restoreCanvasSize();

      // 隐藏悬浮层
      this.hideFloatingLayer();

      // 显示原图表
      this.showOriginalChart();

      // 隐藏遮罩层
      if (this.maskId && this.page) {
        this.page.setData({
          [this.maskId]: false
        });
      }

      // 恢复页面滚动（可选）
      this.restorePageScroll();

      // 重置状态
      this.isFloating = false;
      this.currentScale = 1;
      this.lastScale = 1;
      this.currentTranslate = { x: 0, y: 0 };
      this._clarityScheduled = false;

      console.log('Floating layer closed and chart restored');
    } catch (error) {
      console.error('Failed to close floating layer:', error);
    }
  }

  /**
   * 恢复页面滚动（可选）
   */
  restorePageScroll() {
    try {
      // 在小程序中，恢复页面滚动的方法是移除页面根节点的样式
      // 这里通过 page.setData 来控制
      if (this.page) {
        this.page.setData({
          pageScrollDisabled: false
        });
      }
    } catch (error) {
      console.error('Failed to restore page scroll:', error);
    }
  }

  /**
   * 恢复 canvas 原始像素尺寸
   */
  restoreCanvasSize() {
    try {
      if (this.chartInstance && this.chartInstance.canvas) {
        const canvas = this.chartInstance.canvas;

        // 恢复原始 canvas 尺寸
        if (this.originalCanvasPixelWidth && this.originalCanvasPixelHeight) {
          canvas.width = this.originalCanvasPixelWidth;
          canvas.height = this.originalCanvasPixelHeight;

          console.log('Canvas size restored:', {
            width: this.originalCanvasPixelWidth,
            height: this.originalCanvasPixelHeight
          });

          // 重新渲染图表
          if (this.chartInstance.render) {
            this.chartInstance.render();
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore canvas size:', error);
    }
  }

  /**
   * 隐藏悬浮层
   */
  hideFloatingLayer() {
    try {
      if (this.page) {
        // 通过 page.setData 控制悬浮层的隐藏
        this.page.setData({
          isChartFloating: false,
          isChartHidden: false
        });
      }

      // 调用自定义回调
      if (this.onHideFloating) {
        this.onHideFloating();
      }

      console.log('Floating layer hidden');
    } catch (error) {
      console.error('Failed to hide floating layer:', error);
    }
  }

  /**
   * 显示原图表
   */
  showOriginalChart() {
    try {
      if (this.page) {
        // 通过 page.setData 控制原图表的显示
        this.page.setData({
          isChartHidden: false
        });
      }
      console.log('Original chart shown');
    } catch (error) {
      console.error('Failed to show original chart:', error);
    }
  }

  /**
   * 销毁实例，清理资源
   */
  destroy() {
    try {
      // 确保关闭悬浮层
      if (this.isFloating) {
        this.closeFloatingLayer();
      }

      // 清理状态
      this.isFloating = false;
      this.currentScale = 1;
      this.lastScale = 1;
      this.touchStartDistance = 0;
      this.originalState = null;
      this.focalPoint = null;
      this.elementCenter = null;
      this.focalOffset = null;
      this.currentTranslate = { x: 0, y: 0 };
      this._clarityScheduled = false;

      // 清空对 page 和 chartInstance 的引用，避免内存泄漏
      this.page = null;
      this.chartInstance = null;
      this.maskId = null; // 新增：清空 maskId 相关引用
      this.onShowFloating = null;
      this.onHideFloating = null;

      console.log('ChartZoomManager destroyed successfully');
    } catch (error) {
      console.error('Failed to destroy ChartZoomManager:', error);
    }
  }
}

// 导出
module.exports = { ChartZoomManager };
module.exports.default = ChartZoomManager;
