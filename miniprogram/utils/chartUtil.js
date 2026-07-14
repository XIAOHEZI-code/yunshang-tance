// chartUtil.js - 图表渲染工具函数
// 优化版：解决参数过多时的渲染问题

/**
 * 计算X轴标签最优显示策略
 * @param {Array} labels - 标签数组
 * @param {number} availableWidth - 可用宽度
 * @param {number} fontSize - 字体大小
 * @returns {Object} - { interval: 采样间隔, rotate: 旋转角度, maxLabelLength: 最大标签长度 }
 */
function calculateLabelStrategy(labels, availableWidth, fontSize = 12) {
  if (!labels || labels.length === 0) {
    return { interval: 1, rotate: 0, maxLabelLength: 10 };
  }

  const labelCount = labels.length;

  // 估算每个标签的平均宽度（中文字符按1.5倍计算）
  const avgLabelLength = labels.reduce((sum, label) =>
    sum + String(label).length, 0) / labelCount;
  const estimatedLabelWidth = avgLabelLength * fontSize * 0.6;

  // 计算需要多少间隔才能不重叠
  const minSpacing = fontSize; // 最小间距
  const totalLabelWidth = labelCount * estimatedLabelWidth;
  const requiredWidth = totalLabelWidth + (labelCount - 1) * minSpacing;

  let interval = 1;
  let rotate = 0;
  let maxLabelLength = 10;

  if (requiredWidth > availableWidth) {
    // 需要采样
    const ratio = requiredWidth / availableWidth;
    interval = Math.ceil(ratio);

    // 如果采样后还是太挤，考虑旋转
    const sampledCount = Math.ceil(labelCount / interval);
    const sampledWidth = sampledCount * estimatedLabelWidth + (sampledCount - 1) * minSpacing;

    if (sampledWidth > availableWidth * 0.8) {
      rotate = 45; // 45度旋转
      maxLabelLength = 8; // 缩短标签长度
    }

    // 如果参数非常多，旋转90度
    if (labelCount > 20 && sampledWidth > availableWidth) {
      rotate = 90;
      maxLabelLength = 6;
    }
  }

  return { interval, rotate, maxLabelLength };
}

/**
 * 数据采样 - 对于大数据集进行降采样以提高性能
 * @param {Array} data - 原始数据
 * @param {number} maxPoints - 最大采样点数
 * @returns {Array} - 采样后的数据
 */
function sampleData(data, maxPoints = 1000) {
  if (!Array.isArray(data) || data.length <= maxPoints) {
    return data;
  }

  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0);
}

/**
 * 智能标签截断 - 避免标签过长导致重叠
 * @param {string} label - 原始标签
 * @param {number} maxLength - 最大长度
 * @returns {string} - 截断后的标签
 */
function truncateLabel(label, maxLength = 10) {
  if (typeof label !== 'string') {
    label = String(label);
  }
  if (label.length <= maxLength) {
    return label;
  }
  return label.substring(0, maxLength) + '...';
}

/**
 * 计算最佳字体大小 - 根据画布尺寸和数据量自动调整字体大小
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 * @param {number} dataCount - 数据点数量
 * @returns {number} - 最佳字体大小
 */
function calculateOptimalFontSize(width, height, dataCount) {
  const minFontSize = 8;
  const maxFontSize = 14;
  const baseFontSize = Math.min(width, height) / 40;
  const dataFactor = Math.max(1, Math.min(3, Math.sqrt(dataCount) / 10));
  const fontSize = Math.max(minFontSize, Math.min(maxFontSize, baseFontSize / dataFactor));
  return Math.round(fontSize);
}

/**
 * 生成对比色 - 确保不同系列之间有足够的区分度
 * @param {number} index - 系列索引
 * @returns {Object} - 颜色对象，包含主色和渐变色
 */
function generateContrastColor(index) {
  const colorPalettes = [
    { main: '#1890ff', light: '#40a9ff', dark: '#096dd9' },
    { main: '#52c41a', light: '#73d13d', dark: '#389e0d' },
    { main: '#faad14', light: '#ffc53d', dark: '#d48806' },
    { main: '#f5222d', light: '#ff4d4f', dark: '#cf1322' },
    { main: '#722ed1', light: '#9254de', dark: '#531dab' },
    { main: '#eb2f96', light: '#fa541c', dark: '#c41d7f' },
    { main: '#13c2c2', light: '#36cfc9', dark: '#08979c' },
    { main: '#fa8c16', light: '#ffa940', dark: '#d46b08' }
  ];
  return colorPalettes[index % colorPalettes.length];
}

/**
 * 重置Canvas状态 - 防止属性泄漏
 * @param {Object} ctx - Canvas上下文
 */
function resetCanvasState(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.globalAlpha = 1;
}

/**
 * 带错误边界的图表绘制包装器
 * @param {Function} drawFunc - 绘制函数
 * @param {string} chartType - 图表类型名称
 * @returns {Function} - 包装后的函数
 */
function withErrorBoundary(drawFunc, chartType) {
  return function(ctx, chartData, options = {}) {
    try {
      return drawFunc(ctx, chartData, options);
    } catch (error) {
      console.error(`${chartType} 绘制失败:`, error);

      // 绘制错误提示
      const { width, height } = chartData;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ff4d4f';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('图表渲染失败', width / 2, height / 2 - 10);
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.fillText(error.message, width / 2, height / 2 + 10);

      return null;
    } finally {
      resetCanvasState(ctx);
    }
  };
}

/**
 * 初始化Canvas上下文
 * @param {string} canvasId - Canvas组件的ID
 * @param {Object} options - 配置选项
 * @returns {Object} - Canvas上下文和尺寸信息
 */
function initCanvas(canvasId) {
  const query = wx.createSelectorQuery();

  return new Promise((resolve, reject) => {
    query
      .select(`#${canvasId}`)
      .fields({
        node: true,
        size: true
      })
      .exec((res) => {
        if (!res || res.length === 0 || !res[0]) {
          reject(new Error('Canvas not found'));
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2;

        // 设置Canvas尺寸，考虑设备像素比
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        // ✅ 清空画布，防止重复渲染叠加
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        resolve({
          canvas,
          ctx,
          width: res[0].width,
          height: res[0].height,
          dpr
        });
      });
  });
}

/**
 * 绘制折线图
 * @param {Object} ctx - Canvas上下文
 * @param {Object} chartData - 图表数据
 * @param {Object} options - 配置选项
 */
const drawLineChart = withErrorBoundary(function(
  ctx,
  chartData,
  options = {}
) {
  const {
    width,
    height,
    xAxisData,
    series,
    title = '折线图',
    xAxisName = 'X轴',
    yAxisName = 'Y轴'
  } = {
    ...chartData,
    ...options
  };

  // 大数据集采样优化
  const sampledSeries = series.map((s) => ({
    ...s,
    data: sampleData(s.data, 1000)
  }));

  // 如果采样了数据，同时采样xAxisData
  let sampledXAxisData = xAxisData;
  if (series[0] && series[0].data.length > 1000) {
    const step = Math.ceil(series[0].data.length / 1000);
    sampledXAxisData = xAxisData.filter((_, i) => i % step === 0);
  }

  // 设置默认值
  const padding = { top: 50, right: 40, bottom: 80, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 绘制图表背景
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);

  // 绘制标题
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#262626';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 28);

  // 计算数据范围
  let minY = Infinity;
  let maxY = -Infinity;
  series.forEach((s) => {
    s.data.forEach((val) => {
      minY = Math.min(minY, val);
      maxY = Math.max(maxY, val);
    });
  });

  // 添加一些边距
  const yRange = maxY - minY;
  minY -= yRange * 0.1;
  maxY += yRange * 0.1;

  // 绘制坐标轴
  ctx.strokeStyle = '#d9d9d9';
  ctx.lineWidth = 1.5;

  // Y轴
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.stroke();

  // X轴
  ctx.beginPath();
  ctx.moveTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // 绘制Y轴标签
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = padding.top + (chartHeight / yTicks) * i;
    const value = maxY - (i / yTicks) * (maxY - minY);

    ctx.fillText(value.toFixed(2), padding.left - 10, y);

    // 绘制网格线（虚线）
    ctx.strokeStyle = '#e8e8e8';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 计算标签显示策略
  const labelStrategy = calculateLabelStrategy(xAxisData, chartWidth, 12);
  const { interval: labelInterval, rotate: labelRotate, maxLabelLength } = labelStrategy;

  // 根据旋转角度调整底部padding
  if (labelRotate > 0) {
    padding.bottom = Math.max(padding.bottom, 100);
  }

  // 绘制X轴标签（带智能采样和旋转）
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#666';

  xAxisData.forEach((label, index) => {
    // 根据采样间隔决定是否显示标签
    if (index % labelInterval !== 0) return;

    const x = padding.left + (chartWidth / (xAxisData.length - 1)) * index;
    const truncatedLabel = truncateLabel(label, maxLabelLength);

    ctx.save();
    ctx.translate(x, height - padding.bottom + 15);

    if (labelRotate > 0) {
      ctx.rotate((labelRotate * Math.PI) / 180);
      ctx.textAlign = labelRotate === 90 ? 'left' : 'right';
    } else {
      ctx.textAlign = 'center';
    }

    ctx.textBaseline = 'top';
    ctx.fillText(truncatedLabel, 0, 0);
    ctx.restore();
  });

  // 绘制X轴名称
  ctx.fillText(xAxisName, width / 2, height - 10);

  // 绘制Y轴名称（旋转）
  ctx.save();
  ctx.translate(15, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yAxisName, 0, 0);
  ctx.restore();

  // 绘制数据线
  const colors = [
    { main: '#1890ff', light: '#40a9ff' },
    { main: '#52c41a', light: '#73d13d' },
    { main: '#faad14', light: '#ffc53d' },
    { main: '#f5222d', light: '#ff4d4f' },
    { main: '#722ed1', light: '#9254de' }
  ];

  sampledSeries.forEach((s, sIndex) => {
    const colorPair = colors[sIndex % colors.length];
    const color = s.color || colorPair.main;

    // 绘制线条阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    s.data.forEach((value, index) => {
      const x =
        padding.left + (chartWidth / (sampledXAxisData.length - 1)) * index;
      const y =
        padding.top +
        chartHeight -
        ((value - minY) / (maxY - minY)) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    ctx.shadowColor = 'transparent';

    // 绘制数据点（带阴影）
    s.data.forEach((value, index) => {
      const x =
        padding.left + (chartWidth / (sampledXAxisData.length - 1)) * index;
      const y =
        padding.top +
        chartHeight -
        ((value - minY) / (maxY - minY)) * chartHeight;

      // 数据点外圈
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      // 数据点内圈
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 绘制图例
    ctx.fillStyle = color;
    ctx.fillRect(width - padding.right + 10, padding.top + sIndex * 20, 10, 10);
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      s.name || `系列${sIndex + 1}`,
      width - padding.right + 25,
      padding.top + sIndex * 20 + 8
    );
  });
}, '折线图');

/**
 * 绘制柱状图
 * @param {Object} ctx - Canvas上下文
 * @param {Object} chartData - 图表数据
 * @param {Object} options - 配置选项
 */
const drawBarChart = withErrorBoundary(function(
  ctx,
  chartData,
  options = {}
) {
  const {
    width,
    height,
    xAxisData,
    series,
    title = '柱状图',
    xAxisName = 'X轴',
    yAxisName = 'Y轴'
  } = {
    ...chartData,
    ...options
  };

  // 计算最佳字体大小
  const dataCount = xAxisData.length;
  const fontSize = calculateOptimalFontSize(width, height, dataCount);
  const labelFontSize = Math.max(8, fontSize - 2);

  // 设置默认值，根据数据量动态调整边距
  const padding = {
    top: 50,
    right: 60, // 增加右边距以容纳更多图例
    bottom: Math.max(80, 60 + labelFontSize * 2), // 根据字体大小调整底部边距
    left: 70
  };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 绘制图表背景
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);

  // 绘制标题
  ctx.font = `bold ${fontSize + 4}px sans-serif`;
  ctx.fillStyle = '#262626';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 28);

  // 计算数据范围
  let maxY = -Infinity;
  series.forEach((s) => {
    s.data.forEach((val) => {
      maxY = Math.max(maxY, val);
    });
  });

  // 添加一些边距
  maxY += maxY * 0.1;

  // 绘制坐标轴
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;

  // Y轴
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.stroke();

  // X轴
  ctx.beginPath();
  ctx.moveTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // 绘制Y轴标签
  ctx.font = `${labelFontSize}px sans-serif`;
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = padding.top + (chartHeight / yTicks) * i;
    const value = maxY - (i / yTicks) * maxY;

    ctx.fillText(value.toFixed(2), padding.left - 10, y);

    // 绘制网格线
    ctx.strokeStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // 计算标签显示策略
  const labelStrategy = calculateLabelStrategy(xAxisData, chartWidth, labelFontSize);
  const { interval: labelInterval, rotate: labelRotate, maxLabelLength } = labelStrategy;

  // 根据数据量动态调整底部padding以容纳旋转的标签
  if (labelRotate > 0) {
    padding.bottom = Math.max(padding.bottom, 100);
  }

  // 计算柱子宽度和间距，确保当数据点多时不会挤在一起
  const maxBarWidth = 40; // 最大柱子宽度
  const minBarWidth = 4; // 最小柱子宽度（保证可见）
  const minBarSpacing = 2; // 最小柱子间距
  const availableWidth = chartWidth;
  const totalBars = xAxisData.length * series.length;

  // 当参数过多时，使用固定最小宽度，允许图表超出可视区域（配合滚动查看）
  let calculatedBarWidth = Math.max(
    minBarWidth,
    Math.min(
      maxBarWidth,
      (availableWidth - (xAxisData.length - 1) * minBarSpacing) / totalBars
    )
  );

  // 如果计算出的柱子太窄，使用固定最小宽度
  if (calculatedBarWidth < minBarWidth) {
    calculatedBarWidth = minBarWidth;
  }

  const barSpacing = Math.max(
    minBarSpacing,
    (availableWidth - totalBars * calculatedBarWidth) / (xAxisData.length + 1)
  );

  // 绘制X轴标签（带智能采样和旋转）
  ctx.font = `${labelFontSize}px sans-serif`;
  ctx.fillStyle = '#666';

  xAxisData.forEach((label, index) => {
    // 根据采样间隔决定是否显示标签
    if (index % labelInterval !== 0) return;

    const x = padding.left + barSpacing + (index * (calculatedBarWidth * series.length + barSpacing));
    const centerX = x + (calculatedBarWidth * series.length) / 2;

    // 截断过长的标签
    const truncatedLabel = truncateLabel(label, maxLabelLength);

    ctx.save();
    ctx.translate(centerX, height - padding.bottom + 15);

    if (labelRotate > 0) {
      ctx.rotate((labelRotate * Math.PI) / 180);
      ctx.textAlign = labelRotate === 90 ? 'left' : 'right';
    } else {
      ctx.textAlign = 'center';
    }

    ctx.textBaseline = 'top';
    ctx.fillText(truncatedLabel, 0, 0);
    ctx.restore();
  });

  // 绘制柱子
  xAxisData.forEach((label, index) => {
    const x = padding.left + barSpacing + (index * (calculatedBarWidth * series.length + barSpacing));

    // 绘制每个系列的柱子
    series.forEach((s, sIndex) => {
      const colorPair = generateContrastColor(sIndex);
      const color = s.color || colorPair.main;
      const value = s.data[index] || 0;

      const xStart = x + sIndex * calculatedBarWidth;
      const barHeight = (value / maxY) * chartHeight;
      const yStart = height - padding.bottom - barHeight;

      // 创建渐变
      const gradient = ctx.createLinearGradient(
        xStart,
        yStart,
        xStart,
        yStart + barHeight
      );
      gradient.addColorStop(0, colorPair.light);
      gradient.addColorStop(1, colorPair.dark);

      // 绘制柱子阴影
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;

      // 绘制柱子
      ctx.fillStyle = gradient;
      ctx.fillRect(xStart, yStart, calculatedBarWidth - 1, barHeight);

      ctx.shadowColor = 'transparent';

      // 只有当柱子高度足够时才绘制顶部数值
      if (barHeight > 20 && calculatedBarWidth > 15) {
        ctx.fillStyle = '#333';
        ctx.font = `${Math.max(8, labelFontSize - 2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(value.toFixed(0), xStart + (calculatedBarWidth - 1) / 2, yStart - 5);
      }
    });
  });

  // 绘制X轴名称
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillText(xAxisName, width / 2, height - 10);

  // 绘制Y轴名称（旋转）
  ctx.save();
  ctx.translate(15, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillText(yAxisName, 0, 0);
  ctx.restore();

  // 绘制图例，确保不会重叠
  series.forEach((s, sIndex) => {
    const colorPair = generateContrastColor(sIndex);
    const color = s.color || colorPair.main;
    const legendY = padding.top + sIndex * (fontSize + 8);

    // 确保图例不会超出画布
    if (legendY < height - padding.bottom) {
      ctx.fillStyle = color;
      ctx.fillRect(width - padding.right + 10, legendY, 10, 10);
      ctx.fillStyle = '#333';
      ctx.font = `${labelFontSize}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(
        s.name || `系列${sIndex + 1}`,
        width - padding.right + 25,
        legendY + 8
      );
    }
  });
}, '柱状图');

/**
 * 绘制饼图
 * @param {Object} ctx - Canvas上下文
 * @param {Object} chartData - 图表数据
 * @param {Object} options - 配置选项
 */
const drawPieChart = withErrorBoundary(function(
  ctx,
  chartData,
  options = {}
) {
  const {
    width,
    height,
    series,
    title = '饼图'
  } = {
    ...chartData,
    ...options
  };

  // 设置默认值
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 3;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 绘制标题
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 25);

  // 计算总数值
  const total = series.reduce((sum, item) => sum + item.value, 0);

  // 绘制饼图
  let startAngle = -Math.PI / 2; // 从顶部开始
  const colors = [
    '#1890ff',
    '#52c41a',
    '#faad14',
    '#f5222d',
    '#722ed1',
    '#eb2f96',
    '#fa8c16',
    '#a0d911'
  ];

  series.forEach((item, index) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const color = item.color || colors[index % colors.length];

    // 绘制扇形
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // 绘制边框
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 计算标签位置
    const labelAngle = startAngle + sliceAngle / 2;
    const labelRadius = radius + 30;
    const labelX = centerX + Math.cos(labelAngle) * labelRadius;
    const labelY = centerY + Math.sin(labelAngle) * labelRadius;

    // 绘制标签文本
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = labelX > centerX ? 'left' : 'right';
    ctx.fillText(
      `${item.name}: ${item.value} (${((item.value / total) * 100).toFixed(1)}%)`,
      labelX,
      labelY
    );

    // 更新起始角度
    startAngle += sliceAngle;
  });

  // 绘制中心文本
  ctx.fillStyle = '#333';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`总计: ${total}`, centerX, centerY);
}, '饼图');

/**
 * 绘制直方图
 * @param {Object} ctx - Canvas上下文
 * @param {Object} chartData - 图表数据
 * @param {Object} options - 配置选项
 */
const drawHistogram = withErrorBoundary(function(
  ctx,
  chartData,
  options = {}
) {
  const {
    width,
    height,
    data,
    bins = 10,
    title = '直方图',
    xAxisName = '数值',
    yAxisName = '频数'
  } = {
    ...chartData,
    ...options
  };

  // 设置默认值
  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 绘制标题
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 25);

  // 计算数据范围
  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const binWidth = (maxValue - minValue) / bins;

  // 计算直方图数据
  const histogramData = Array(bins).fill(0);
  data.forEach((value) => {
    const binIndex = Math.min(
      Math.floor((value - minValue) / binWidth),
      bins - 1
    );
    histogramData[binIndex]++;
  });

  // 计算Y轴范围
  const maxFrequency = Math.max(...histogramData);

  // 绘制坐标轴
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;

  // Y轴
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.stroke();

  // X轴
  ctx.beginPath();
  ctx.moveTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // 绘制Y轴标签
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = padding.top + (chartHeight / yTicks) * i;
    const value = maxFrequency - (i / yTicks) * maxFrequency;

    ctx.fillText(value.toString(), padding.left - 10, y);

    // 绘制网格线
    ctx.strokeStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // 绘制X轴标签
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const barWidth = chartWidth / bins;

  for (let i = 0; i < bins; i++) {
    const x = padding.left + barWidth * i + barWidth / 2;
    const binStart = minValue + i * binWidth;
    const binEnd = binStart + binWidth;
    const label = `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`;

    ctx.fillText(label, x, height - padding.bottom + 10);
  }

  // 绘制X轴名称
  ctx.fillText(xAxisName, width / 2, height - 10);

  // 绘制Y轴名称（旋转）
  ctx.save();
  ctx.translate(15, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yAxisName, 0, 0);
  ctx.restore();

  // 绘制柱子
  ctx.fillStyle = '#1890ff';

  histogramData.forEach((frequency, index) => {
    const barHeight = (frequency / maxFrequency) * chartHeight;
    const x = padding.left + barWidth * index;
    const y = height - padding.bottom - barHeight;

    ctx.fillRect(x, y, barWidth - 2, barHeight);

    // 绘制柱子顶部数值
    ctx.fillStyle = '#333';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(frequency.toString(), x + (barWidth - 2) / 2, y - 5);

    ctx.fillStyle = '#1890ff';
  });
}, '直方图');

/**
 * 绘制散点图
 * @param {Object} ctx - Canvas上下文
 * @param {Object} chartData - 图表数据
 * @param {Object} options - 配置选项
 */
const drawScatterChart = withErrorBoundary(function(
  ctx,
  chartData,
  options = {}
) {
  const {
    width,
    height,
    series,
    title = '散点图',
    xAxisName = 'X轴',
    yAxisName = 'Y轴'
  } = {
    ...chartData,
    ...options
  };

  // 大数据集采样优化 - 散点图限制点数
  const sampledSeries = series.map((s) => ({
    ...s,
    data: sampleData(s.data, 2000) // 散点图允许更多点
  }));

  // 设置默认值
  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 绘制标题
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 25);

  // 计算数据范围
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  sampledSeries.forEach((s) => {
    s.data.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });

  // 添加一些边距
  const xRange = maxX - minX;
  const yRange = maxY - minY;
  minX -= xRange * 0.1;
  maxX += xRange * 0.1;
  minY -= yRange * 0.1;
  maxY += yRange * 0.1;

  // 绘制坐标轴
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;

  // Y轴
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.stroke();

  // X轴
  ctx.beginPath();
  ctx.moveTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // 绘制Y轴标签
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = padding.top + (chartHeight / yTicks) * i;
    const value = maxY - (i / yTicks) * (maxY - minY);

    ctx.fillText(value.toFixed(2), padding.left - 10, y);

    // 绘制网格线
    ctx.strokeStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // 绘制X轴标签
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const xTicks = 5;
  for (let i = 0; i <= xTicks; i++) {
    const x = padding.left + (chartWidth / xTicks) * i;
    const value = minX + (i / xTicks) * (maxX - minX);
    ctx.fillText(value.toFixed(2), x, height - padding.bottom + 10);
  }

  // 绘制X轴名称
  ctx.fillText(xAxisName, width / 2, height - 10);

  // 绘制Y轴名称（旋转）
  ctx.save();
  ctx.translate(15, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yAxisName, 0, 0);
  ctx.restore();

  // 绘制散点
  const colors = [
    { main: '#1890ff', light: '#40a9ff' },
    { main: '#52c41a', light: '#73d13d' },
    { main: '#faad14', light: '#ffc53d' },
    { main: '#f5222d', light: '#ff4d4f' },
    { main: '#722ed1', light: '#9254de' }
  ];
  const pointSize = 5;

  sampledSeries.forEach((s, sIndex) => {
    const colorPair = colors[sIndex % colors.length];
    const color = s.color || colorPair.main;

    s.data.forEach(([x, y]) => {
      const chartX = padding.left + ((x - minX) / (maxX - minX)) * chartWidth;
      const chartY =
        padding.top + chartHeight - ((y - minY) / (maxY - minY)) * chartHeight;

      // 绘制散点阴影
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 4;

      // 外圆
      ctx.fillStyle = colorPair.light || color;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(chartX, chartY, pointSize + 2, 0, Math.PI * 2);
      ctx.fill();

      // 内圆
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(chartX, chartY, pointSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = 'transparent';
    });

    // 绘制图例
    ctx.fillStyle = color;
    ctx.fillRect(width - padding.right + 10, padding.top + sIndex * 20, 10, 10);
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      s.name || `系列${sIndex + 1}`,
      width - padding.right + 25,
      padding.top + sIndex * 20 + 8
    );
  });
}, '散点图');

/**
 * 保存图表为图片
 * @param {string} canvasId - Canvas ID
 * @param {Object} canvas - Canvas 节点对象
 * @returns {Promise} 保存结果
 */
function saveChartAsImage(canvasId, canvas) {
  return new Promise((resolve, reject) => {
    if (!canvas) {
      reject(new Error('Canvas 节点不存在'));
      return;
    }

    // 生成临时图片路径
    wx.canvasToTempFilePath({
      canvas: canvas,
      success: (res) => {
        const tempFilePath = res.tempFilePath;

        // 保存到相册
        wx.saveImageToPhotosAlbum({
          filePath: tempFilePath,
          success: () => {
            resolve({ success: true, message: '图表已保存到相册' });
          },
          fail: (err) => {
            // 检查是否是权限问题
            if (err.errMsg.includes('auth')) {
              // 引导用户授权
              wx.showModal({
                title: '需要相册权限',
                content: '保存图片需要您授权访问相册，请在设置中开启权限',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting({
                      success: (settingRes) => {
                        if (settingRes.authSetting['scope.writePhotosAlbum']) {
                          // 用户授权后重新保存
                          wx.saveImageToPhotosAlbum({
                            filePath: tempFilePath,
                            success: () => {
                              resolve({
                                success: true,
                                message: '图表已保存到相册'
                              });
                            },
                            fail: (retryErr) => {
                              reject(new Error('保存失败: ' + retryErr.errMsg));
                            }
                          });
                        } else {
                          reject(new Error('未获得相册权限'));
                        }
                      }
                    });
                  } else {
                    reject(new Error('用户取消授权'));
                  }
                }
              });
            } else {
              reject(new Error('保存失败: ' + err.errMsg));
            }
          }
        });
      },
      fail: (err) => {
        reject(new Error('生成图片失败: ' + err.errMsg));
      }
    });
  });
}

/**
 * 绘制排列重要性图表
 * @param {Object} ctx - Canvas上下文
 * @param {Object} chartData - 图表数据
 * @param {Object} options - 配置选项
 */
const drawPermutationImportanceChart = withErrorBoundary(function(
  ctx,
  chartData,
  options = {}
) {
  const {
    width,
    height,
    permutationImportances,
    title = '排列重要性分析'
  } = {
    ...chartData,
    ...options
  };

  if (!permutationImportances || permutationImportances.length === 0) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#999';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂无数据可显示', width / 2, height / 2);
    return;
  }

  // 设置默认值
  const padding = { top: 50, right: 40, bottom: 80, left: 100 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 绘制图表背景
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);

  // 绘制标题
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#262626';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 28);

  // 计算数据范围
  let maxImportance = -Infinity;
  permutationImportances.forEach((item) => {
    maxImportance = Math.max(maxImportance, item.importance);
  });

  // 添加一些边距，并确保非零以防止 NaN
  maxImportance = Math.max(maxImportance, 1e-6);
  maxImportance += maxImportance * 0.1;

  // 绘制坐标轴
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;

  // Y轴
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.stroke();

  // X轴
  ctx.beginPath();
  ctx.moveTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // 绘制X轴标签
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const xTicks = 5;
  for (let i = 0; i <= xTicks; i++) {
    const x = padding.left + (chartWidth / xTicks) * i;
    const value = (i / xTicks) * maxImportance;

    ctx.fillText(value.toFixed(4), x, height - padding.bottom + 15);

    // 绘制网格线
    ctx.strokeStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
  }

  // 绘制Y轴标签
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  permutationImportances.forEach((item, index) => {
    const y = padding.top + (chartHeight / permutationImportances.length) * (index + 0.5);
    ctx.fillText(item.feature, padding.left - 10, y);
  });

  // 绘制X轴名称
  ctx.textAlign = 'center';
  ctx.fillText('排列重要性', width / 2, height - 10);

  // 绘制Y轴名称（旋转）
  ctx.save();
  ctx.translate(40, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('特征', 0, 0);
  ctx.restore();

  // 绘制柱状图
  const barWidth = chartWidth * 0.8;

  permutationImportances.forEach((item, index) => {
    const y = padding.top + (chartHeight / permutationImportances.length) * index;
    const barHeight = chartHeight / permutationImportances.length * 0.6;
    const barX = padding.left;
    const barLength = (item.importance / maxImportance) * barWidth;

    // 创建渐变
    const gradient = ctx.createLinearGradient(
      barX,
      y,
      barX + barLength,
      y
    );
    gradient.addColorStop(0, '#1890ff');
    gradient.addColorStop(1, '#096dd9');

    // 绘制柱子
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, y + (chartHeight / permutationImportances.length - barHeight) / 2, barLength, barHeight);

    // 绘制柱子顶部数值
    ctx.fillStyle = '#333';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.importance.toFixed(4), barX + barLength + 5, y + (chartHeight / permutationImportances.length) / 2);
  });
}, '排列重要性图表');

/**
 * 绘制特征选择结果图表
 * @param {Object} ctx - Canvas上下文
 * @param {Object} chartData - 图表数据
 * @param {Object} options - 配置选项
 */
const drawFeatureSelectionChart = withErrorBoundary(function(
  ctx,
  chartData,
  options = {}
) {
  const {
    width,
    height,
    featureScores,
    selectedFeatures,
    title = '特征选择结果'
  } = {
    ...chartData,
    ...options
  };

  if (!featureScores || featureScores.length === 0) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#999';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂无数据可显示', width / 2, height / 2);
    return;
  }

  // 设置默认值
  const padding = { top: 50, right: 40, bottom: 80, left: 100 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 绘制图表背景
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);

  // 绘制标题
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#262626';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 28);

  // 计算数据范围
  let maxScore = -Infinity;
  featureScores.forEach((item) => {
    maxScore = Math.max(maxScore, item.importance);
  });

  // 添加一些边距，并确保非零以防止 NaN
  maxScore = Math.max(maxScore, 1e-6);
  maxScore += maxScore * 0.1;

  // 绘制坐标轴
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;

  // Y轴
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.stroke();

  // X轴
  ctx.beginPath();
  ctx.moveTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // 绘制X轴标签
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const xTicks = 5;
  for (let i = 0; i <= xTicks; i++) {
    const x = padding.left + (chartWidth / xTicks) * i;
    const value = (i / xTicks) * maxScore;

    ctx.fillText(value.toFixed(4), x, height - padding.bottom + 15);

    // 绘制网格线
    ctx.strokeStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
  }

  // 绘制Y轴标签
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  featureScores.forEach((item, index) => {
    const y = padding.top + (chartHeight / featureScores.length) * (index + 0.5);
    ctx.fillText(item.feature, padding.left - 10, y);
  });

  // 绘制X轴名称
  ctx.textAlign = 'center';
  ctx.fillText('特征得分', width / 2, height - 10);

  // 绘制Y轴名称（旋转）
  ctx.save();
  ctx.translate(40, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('特征', 0, 0);
  ctx.restore();

  // 绘制柱状图
  const barWidth = chartWidth * 0.8;

  featureScores.forEach((item, index) => {
    const y = padding.top + (chartHeight / featureScores.length) * index;
    const barHeight = chartHeight / featureScores.length * 0.6;
    const barX = padding.left;
    const barLength = (item.importance / maxScore) * barWidth;

    // 创建渐变
    const isSelected = selectedFeatures.includes(item.feature);
    const gradient = ctx.createLinearGradient(
      barX,
      y,
      barX + barLength,
      y
    );
    gradient.addColorStop(0, isSelected ? '#52c41a' : '#1890ff');
    gradient.addColorStop(1, isSelected ? '#389e0d' : '#096dd9');

    // 绘制柱子
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, y + (chartHeight / featureScores.length - barHeight) / 2, barLength, barHeight);

    // 绘制选中标记
    if (isSelected) {
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✓', barX + barLength - 15, y + (chartHeight / featureScores.length) / 2);
    }
  });

  // 绘制图例
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1890ff';
  ctx.fillRect(width - padding.right + 10, padding.top + 10, 10, 10);
  ctx.fillStyle = '#333';
  ctx.fillText('未选中特征', width - padding.right + 25, padding.top + 18);

  ctx.fillStyle = '#52c41a';
  ctx.fillRect(width - padding.right + 10, padding.top + 30, 10, 10);
  ctx.fillStyle = '#333';
  ctx.fillText('选中特征', width - padding.right + 25, padding.top + 38);
}, '特征选择结果图表');

/**
 * 绘制数据预处理结果图表
 * @param {Object} ctx - Canvas上下文
 * @param {Object} chartData - 图表数据
 * @param {Object} options - 配置选项
 */
const drawPreprocessResultChart = withErrorBoundary(function(
  ctx,
  chartData,
  options = {}
) {
  const {
    width,
    height,
    preprocessResult,
    title = '数据预处理结果'
  } = {
    ...chartData,
    ...options
  };

  if (!preprocessResult) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#999';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂无数据可显示', width / 2, height / 2);
    return;
  }

  // 设置默认值
  const padding = { top: 50, right: 40, bottom: 80, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 绘制图表背景
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);

  // 绘制标题
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#262626';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 28);

  // 绘制数据维度变化
  const categories = ['原始数据', '移除异常值后', '特征选择后'];
  const sampleCounts = [
    preprocessResult.originalData.length,
    preprocessResult.cleanedData.length,
    preprocessResult.cleanedData.length
  ];
  const featureCounts = [
    preprocessResult.originalData[0] ? Object.keys(preprocessResult.originalData[0]).length - 1 : 0,
    preprocessResult.cleanedData[0] ? Object.keys(preprocessResult.cleanedData[0]).length - 1 : 0,
    preprocessResult.selectedFeatures.length
  ];

  // 计算最大值
  const maxSampleCount = Math.max(...sampleCounts);
  const maxFeatureCount = Math.max(...featureCounts);

  // 绘制柱状图
  const barWidth = (chartWidth / categories.length) * 0.35;

  categories.forEach((category, index) => {
    const x = padding.left + (chartWidth / categories.length) * (index + 0.5);

    // 绘制样本数量柱形
    const sampleHeight = (sampleCounts[index] / maxSampleCount) * (chartHeight * 0.4);
    const sampleY = padding.top + chartHeight * 0.1 + (chartHeight * 0.4 - sampleHeight);

    const sampleGradient = ctx.createLinearGradient(
      x - barWidth - 10,
      sampleY,
      x - barWidth - 10,
      sampleY + sampleHeight
    );
    sampleGradient.addColorStop(0, '#1890ff');
    sampleGradient.addColorStop(1, '#096dd9');

    ctx.fillStyle = sampleGradient;
    ctx.fillRect(x - barWidth - 10, sampleY, barWidth, sampleHeight);

    // 绘制特征数量柱形
    const featureHeight = (featureCounts[index] / maxFeatureCount) * (chartHeight * 0.4);
    const featureY = padding.top + chartHeight * 0.6 + (chartHeight * 0.4 - featureHeight);

    const featureGradient = ctx.createLinearGradient(
      x + 10,
      featureY,
      x + 10,
      featureY + featureHeight
    );
    featureGradient.addColorStop(0, '#52c41a');
    featureGradient.addColorStop(1, '#389e0d');

    ctx.fillStyle = featureGradient;
    ctx.fillRect(x + 10, featureY, barWidth, featureHeight);

    // 绘制类别标签
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(category, x, height - padding.bottom + 20);

    // 绘制数值标签
    ctx.fillText(sampleCounts[index].toString(), x - barWidth - 10 + barWidth / 2, sampleY - 10);
    ctx.fillText(featureCounts[index].toString(), x + 10 + barWidth / 2, featureY - 10);
  });

  // 绘制标签
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.fillText('样本数量', width / 2, padding.top + chartHeight * 0.3);
  ctx.fillText('特征数量', width / 2, padding.top + chartHeight * 0.8);

  // 绘制图例
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1890ff';
  ctx.fillRect(width - padding.right + 10, padding.top + 10, 10, 10);
  ctx.fillStyle = '#333';
  ctx.fillText('样本数量', width - padding.right + 25, padding.top + 18);

  ctx.fillStyle = '#52c41a';
  ctx.fillRect(width - padding.right + 10, padding.top + 30, 10, 10);
  ctx.fillStyle = '#333';
  ctx.fillText('特征数量', width - padding.right + 25, padding.top + 38);
}, '数据预处理结果图表');

/**
 * 绘制水平条形图
 * @param {Object} ctx - Canvas上下文
 * @param {Object} chartData - 图表数据
 * @param {Object} options - 配置选项
 */
const drawHorizontalBarChart = withErrorBoundary(function(
  ctx,
  chartData,
  options = {}
) {
  const {
    width,
    height,
    xAxisData,
    series,
    title = '水平条形图',
    xAxisName = '数值',
    yAxisName = '类别'
  } = {
    ...chartData,
    ...options
  };

  // 计算最佳字体大小
  const dataCount = xAxisData.length;
  const fontSize = calculateOptimalFontSize(width, height, dataCount);
  const labelFontSize = Math.max(8, fontSize - 2);

  // 设置默认值，根据数据量动态调整边距
  const padding = {
    top: 50,
    right: 60, // 增加右边距以容纳更多图例
    bottom: 40,
    left: Math.max(120, 80 + labelFontSize * 4) // 根据标签长度调整左边距
  };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 绘制图表背景
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);

  // 绘制标题
  ctx.font = `bold ${fontSize + 4}px sans-serif`;
  ctx.fillStyle = '#262626';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 28);

  // 计算数据范围
  let maxY = -Infinity;
  series.forEach((s) => {
    s.data.forEach((val) => {
      maxY = Math.max(maxY, val);
    });
  });

  // 添加一些边距
  maxY += maxY * 0.1;

  // 绘制坐标轴
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;

  // Y轴
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.stroke();

  // X轴
  ctx.beginPath();
  ctx.moveTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // 绘制X轴标签
  ctx.font = `${labelFontSize}px sans-serif`;
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const xTicks = 5;
  for (let i = 0; i <= xTicks; i++) {
    const x = padding.left + (chartWidth / xTicks) * i;
    const value = (i / xTicks) * maxY;

    ctx.fillText(value.toFixed(2), x, height - padding.bottom + 15);

    // 绘制网格线
    ctx.strokeStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
  }

  // 计算柱子高度和间距
  const maxBarHeight = 40; // 最大柱子高度
  const minBarHeight = 8; // 最小柱子高度
  const minBarSpacing = 2; // 最小柱子间距
  
  let calculatedBarHeight = Math.max(
    minBarHeight,
    Math.min(
      maxBarHeight,
      (chartHeight - (dataCount - 1) * minBarSpacing) / dataCount
    )
  );

  const barSpacing = Math.max(
    minBarSpacing,
    (chartHeight - dataCount * calculatedBarHeight) / (dataCount + 1)
  );

  // 绘制Y轴标签和柱子
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  xAxisData.forEach((label, index) => {
    const y = padding.top + barSpacing + (index * (calculatedBarHeight + barSpacing));
    const centerY = y + calculatedBarHeight / 2;

    // 绘制Y轴标签
    const truncatedLabel = truncateLabel(label, 20); // 水平标签可以更长
    ctx.fillText(truncatedLabel, padding.left - 10, centerY);

    // 绘制每个系列的柱子
    series.forEach((s, sIndex) => {
      const colorPair = generateContrastColor(sIndex);
      const color = s.color || colorPair.main;
      const value = s.data[index] || 0;

      const barLength = (value / maxY) * chartWidth;
      const xStart = padding.left;

      // 创建渐变
      const gradient = ctx.createLinearGradient(
        xStart,
        y,
        xStart + barLength,
        y
      );
      gradient.addColorStop(0, colorPair.light);
      gradient.addColorStop(1, colorPair.dark);

      // 绘制柱子阴影
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;

      // 绘制柱子
      ctx.fillStyle = gradient;
      ctx.fillRect(xStart, y, barLength, calculatedBarHeight - 1);

      ctx.shadowColor = 'transparent';

      // 只有当柱子长度足够时才绘制右侧数值
      if (barLength > 30) {
        ctx.fillStyle = '#333';
        ctx.font = `${Math.max(8, labelFontSize - 2)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(value.toFixed(2), xStart + barLength + 5, centerY);
        ctx.textAlign = 'right';
      }
    });
  });

  // 绘制X轴名称
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(xAxisName, width / 2, height - 10);

  // 绘制Y轴名称（旋转）
  ctx.save();
  ctx.translate(40, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillText(yAxisName, 0, 0);
  ctx.restore();

  // 绘制图例，确保不会重叠
  series.forEach((s, sIndex) => {
    const colorPair = generateContrastColor(sIndex);
    const color = s.color || colorPair.main;
    const legendY = padding.top + sIndex * (fontSize + 8);

    // 确保图例不会超出画布
    if (legendY < height - padding.bottom) {
      ctx.fillStyle = color;
      ctx.fillRect(width - padding.right + 10, legendY, 10, 10);
      ctx.fillStyle = '#333';
      ctx.font = `${labelFontSize}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(
        s.name || `系列${sIndex + 1}`,
        width - padding.right + 25,
        legendY + 8
      );
    }
  });
}, '水平条形图');

/**
 * 绘制默认图表
 * @param {Object} ctx - Canvas上下文
 * @param {Object} chartData - 图表数据
 */
function drawDefaultChart(ctx, chartData) {
  const { width, height } = chartData;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#999';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('暂无数据可显示', width / 2, height / 2);
}

// 兼容 CommonJS require() 写法（微信小程序部分环境不完全转译 ESM）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initCanvas,
    drawLineChart,
    drawBarChart,
    drawPieChart,
    drawHistogram,
    drawScatterChart,
    drawHorizontalBarChart,
    drawPermutationImportanceChart,
    drawFeatureSelectionChart,
    drawPreprocessResultChart,
    drawDefaultChart,
    saveChartAsImage
  };
}
