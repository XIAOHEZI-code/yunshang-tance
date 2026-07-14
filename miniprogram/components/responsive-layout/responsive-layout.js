// 响应式布局组件逻辑
import envDetector from '../../utils/env.js';

Component({
  options: {
    multipleSlots: true // 启用多插槽
  },

  properties: {
    // 是否使用网格布局
    useGrid: {
      type: Boolean,
      value: false
    },

    // 自定义容器样式
    containerStyle: {
      type: String,
      value: ''
    },

    // 自定义桌面端布局样式
    desktopLayoutStyle: {
      type: String,
      value: ''
    },

    // 自定义移动端布局样式
    mobileLayoutStyle: {
      type: String,
      value: ''
    },

    // 自定义网格样式
    gridStyle: {
      type: String,
      value: ''
    },

    // 强制使用桌面端布局
    forceDesktop: {
      type: Boolean,
      value: false
    },

    // 强制使用移动端布局
    forceMobile: {
      type: Boolean,
      value: false
    }
  },

  data: {
    isDesktop: false,
    envInfo: null
  },

  lifetimes: {
    // 组件创建时
    created() {
      this.initEnv();
    },

    // 组件挂载时
    attached() {
      this.updateLayout();
      // 监听窗口大小变化
      this.listenToResize();
    },

    // 组件卸载时
    detached() {
      // 移除事件监听器
      if (this.resizeListener) {
        wx.offWindowResize(this.resizeListener);
      }
    }
  },

  observers: {
    // 监听属性变化，重新计算布局
    'forceDesktop, forceMobile'() {
      this.updateLayout();
    }
  },

  methods: {
    // 初始化环境信息
    initEnv() {
      this.setData({
        envInfo: envDetector.getEnvInfo()
      });
    },

    // 更新布局
    updateLayout() {
      const { forceDesktop, forceMobile } = this.properties;
      let isDesktop = false;

      if (forceDesktop) {
        isDesktop = true;
      } else if (forceMobile) {
        isDesktop = false;
      } else {
        isDesktop = envDetector.isDesktop;
      }

      this.setData({
        isDesktop
      });

      // 触发布局更新事件
      this.triggerEvent('layoutChange', {
        isDesktop,
        envInfo: envDetector.getEnvInfo()
      });
    },

    // 监听窗口大小变化
    listenToResize() {
      this.resizeListener = wx.onWindowResize(() => {
        // 窗口大小变化时，更新环境信息
        envDetector.updateEnvInfo();
        this.initEnv();
        this.updateLayout();
      });
    },

    // 获取当前布局信息
    getLayoutInfo() {
      return {
        isDesktop: this.data.isDesktop,
        envInfo: this.data.envInfo,
        recommendedRenderStrategy: envDetector.getRecommendedRenderStrategy(),
        recommendedComputeStrategy: envDetector.getRecommendedComputeStrategy()
      };
    },

    // 强制更新布局
    forceUpdate() {
      this.updateLayout();
    },

    // 获取推荐的渲染策略
    getRecommendedRenderStrategy() {
      return envDetector.getRecommendedRenderStrategy();
    },

    // 获取推荐的计算策略
    getRecommendedComputeStrategy() {
      return envDetector.getRecommendedComputeStrategy();
    }
  }
});
