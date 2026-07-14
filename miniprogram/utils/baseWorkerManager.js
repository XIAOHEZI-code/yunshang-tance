// baseWorkerManager.js - Web Worker 线程管理基类
// 提供 Worker 初始化、消息路由、错误熔断、超时降级的通用生命周期管理

/**
 * Web Worker 管理基类
 * 提取自 ParseWorkerManager 和 WorkerManager 中的公共样板逻辑
 */
class BaseWorkerManager {
  /**
   * @param {Object} options
   * @param {string}  options.workerScript   - Worker 脚本路径（相对或绝对）
   * @param {number}  [options.taskTimeout]  - 单任务超时时间（ms），默认 3000
   */
  constructor(options = {}) {
    this.workerScript = options.workerScript || '';
    this.taskTimeout = options.taskTimeout || 3000;

    this.worker = null;
    this.callbacks = new Map();  // taskId -> callback(error, data)
    this.taskId = 0;
    this._workerInitFailed = false;
  }

  // ─── 子类必须实现 ───────────────────────────────────────────────────

  /**
   * 返回平台/环境是否支持 Worker。
   * 子类可以覆盖此方法实现细粒度的平台判断。
   * @returns {boolean}
   */
  _isPlatformSupported() {
    if (typeof wx === 'undefined' || typeof wx.createWorker !== 'function') {
      return false;
    }
    try {
      const info = wx.getSystemInfoSync();
      const unsupported = ['devtools', 'windows', 'mac'];
      return !unsupported.includes(info.platform);
    } catch (e) {
      return false;
    }
  }

  // ─── 公共生命周期 ───────────────────────────────────────────────────

  /**
   * 初始化 Worker 线程。
   * 若平台不支持或已初始化失败，返回 false。
   * @returns {boolean}
   */
  initWorker() {
    if (this.worker) return true;
    if (this._workerInitFailed) return false;

    if (!this._isPlatformSupported()) {
      console.log(`[${this.constructor.name}] Worker not supported on this platform`);
      return false;
    }

    if (!this.workerScript) {
      console.warn(`[${this.constructor.name}] No workerScript configured`);
      return false;
    }

    try {
      this.worker = wx.createWorker(this.workerScript);
      this.worker.onMessage((res) => this.handleWorkerMessage(res));
      this.worker.onError((err) => this.handleWorkerError(err));
      console.log(`[${this.constructor.name}] Worker initialized: ${this.workerScript}`);
      return true;
    } catch (error) {
      console.error(`[${this.constructor.name}] Worker init failed:`, error);
      this.worker = null;
      this._workerInitFailed = true;
      return false;
    }
  }

  /**
   * 处理来自 Worker 的消息。
   * 期望消息格式：{ taskId, success, data, error }
   * @param {Object} res
   */
  handleWorkerMessage(res) {
    const { taskId, success, data, error } = res;
    if (taskId && this.callbacks.has(taskId)) {
      const cb = this.callbacks.get(taskId);
      this.callbacks.delete(taskId);
      if (success) {
        cb(null, data);
      } else {
        cb(new Error(error || 'Worker task failed'));
      }
    }
  }

  /**
   * 处理 Worker 错误：清空所有待处理回调，并尝试重启 Worker。
   * @param {Error|string} error
   */
  handleWorkerError(error) {
    console.error(`[${this.constructor.name}] Worker error:`, error);
    this.callbacks.forEach(cb => cb(new Error('Worker thread error')));
    this.callbacks.clear();
    this.destroyWorker();
    this._workerInitFailed = false; // 允许重试
    this.initWorker();
  }

  /**
   * 销毁 Worker 线程。
   */
  destroyWorker() {
    if (this.worker) {
      try {
        this.worker.terminate();
        console.log(`[${this.constructor.name}] Worker terminated`);
      } catch (e) {
        console.error(`[${this.constructor.name}] Worker terminate failed:`, e);
      }
      this.worker = null;
    }
  }

  /**
   * 生成自增任务 ID。
   * @returns {number}
   */
  _generateTaskId() {
    return ++this.taskId;
  }

  /**
   * 向 Worker 发送任务并返回 Promise。
   * 如果 Worker 不可用，自动回退到 fallbackFn。
   *
   * @param {Object}   message            - 发送给 Worker 的消息体（不含 taskId）
   * @param {Function} fallbackFn         - 主线程降级函数，返回同步结果或 Promise
   * @param {number}   [timeout]          - 此次任务的超时毫秒数（覆盖默认值）
   * @returns {Promise}
   */
  _dispatchTask(message, fallbackFn, timeout) {
    return new Promise((resolve, reject) => {
      if (!this.initWorker()) {
        // 直接走主线程降级
        try {
          resolve(fallbackFn());
        } catch (e) {
          reject(e);
        }
        return;
      }

      const taskId = this._generateTaskId();
      let handled = false;

      const timeoutMs = timeout || this.taskTimeout;
      const fallback = () => {
        if (handled) return;
        handled = true;
        this.callbacks.delete(taskId);
        console.warn(`[${this.constructor.name}] Task ${taskId} timeout/error, falling back`);
        try {
          resolve(fallbackFn());
        } catch (e) {
          reject(e);
        }
      };

      const timer = setTimeout(fallback, timeoutMs);

      this.callbacks.set(taskId, (error, data) => {
        if (handled) return;
        handled = true;
        clearTimeout(timer);
        if (error) {
          fallback();
        } else {
          resolve(data);
        }
      });

      try {
        this.worker.postMessage({ ...message, taskId });
      } catch (e) {
        clearTimeout(timer);
        fallback();
      }
    });
  }
}

module.exports = BaseWorkerManager;
module.exports.default = BaseWorkerManager;
