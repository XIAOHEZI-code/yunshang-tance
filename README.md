<div align="center">

# ☁️ 云上碳测

**冶金高炉碳排放分析与多模型预测微信小程序**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![WeChat](https://img.shields.io/badge/微信小程序-07C160?logo=wechat&logoColor=white)](https://developers.weixin.qq.com/)
[![ECharts](https://img.shields.io/badge/ECharts-5.x-AA344D?logo=apache-echarts)](https://echarts.apache.org/)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20DevTools-lightgrey)](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
[![Cloud](https://img.shields.io/badge/微信云开发-已接入-07C160)](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)

> 面向冶金行业的工业数据分析平台，支持 CSV 导入、11 种统计分析、5 种机器学习模型训练与碳排放核算，全程运行于微信生态。

</div>

---

## 📖 目录

- [项目简介](#-项目简介)
- [功能特性](#-功能特性)
- [技术架构](#-技术架构)
- [页面结构](#-页面结构)
- [分析模块](#-分析模块)
- [机器学习模型](#-机器学习模型)
- [快速开始](#-快速开始)
- [项目结构](#-项目结构)
- [数据格式](#-数据格式)
- [开发说明](#-开发说明)
- [许可证](#-许可证)

---

## 🌟 项目简介

**云上碳测** 是一款面向冶金高炉过程数据的微信小程序，旨在将工业数据分析能力直接带入移动端。用户只需上传标准 CSV 格式的高炉工艺数据，即可一键完成：

- **探索性数据分析（EDA）**：异常值检测、特征统计、相关性矩阵
- **机器学习预测**：5 种主流回归模型的训练、评估与对比
- **碳排放核算**：基于工艺参数的 CO₂ 排放量自动计算
- **ECharts 可视化**：交互式图表，支持缩放与全屏展示

小程序同时支持**移动端**（手机）与**桌面端**（微信开发者工具 / PC 微信）自适应布局，并通过 **Web Worker** 将计算密集型任务移出主线程，保证界面流畅。

---

## ✨ 功能特性

| 特性 | 描述 |
|------|------|
| 📂 **CSV 解析** | 支持上传本地 CSV 文件，自动推断列类型（数值 / 分类） |
| 🗄️ **本地数据库** | 基于 `sqlStore` 的内存关系型存储，支持跨页面数据共享 |
| ☁️ **云开发集成** | 微信云函数一键部署，支持云端数据备份与同步 |
| 📊 **ECharts 可视化** | 11 种图表类型，支持全屏浮动、手势缩放 |
| 🧵 **Web Worker** | 计算密集任务异步化，主线程不卡顿 |
| 📱 **响应式布局** | 移动端 / 桌面端自适应，支持横竖屏切换 |
| 🌱 **碳排放核算** | 基于高炉物料平衡的 CO₂ 排放量自动核算 |
| 🤖 **多模型对比** | 5 种机器学习模型并行训练，输出 R²、MSE 对比报告 |

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────┐
│                  微信小程序宿主                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │
│  │  首页     │  │ 数据解析  │  │  数据管理       │ │
│  │ index    │  │dataParse │  │  dataStore     │ │
│  └──────────┘  └──────────┘  └────────────────┘ │
│                ┌────────────────────────────────┐│
│                │      分析预测页 analysis        ││
│                │  ┌──────────┬────────────────┐ ││
│                │  │ 配置面板  │  图表 / 结果区  │ ││
│                │  └──────────┴────────────────┘ ││
│                └────────────────────────────────┘│
├─────────────────────────────────────────────────┤
│                   工具层 utils/                   │
│  workerManager │ analysisApi │ sqlStore │ charts  │
│  models/  ←  5种ML模型（独立 JS 实现）            │
├─────────────────────────────────────────────────┤
│              Web Worker  worker/                  │
│       analysisWorker.js  |  parseWorker.js        │
├─────────────────────────────────────────────────┤
│           微信云开发  cloudfunctions/              │
│     dataProcess（数据处理）| backup（备份）        │
└─────────────────────────────────────────────────┘
```

**核心技术选型：**

| 层级 | 技术 |
|------|------|
| 视图层 | WXML + WXSS（glass-easel 组件框架） |
| 逻辑层 | 原生 JavaScript (ES6+)，Babel 转译 |
| 图表 | Apache ECharts 5.x（微信定制版） |
| 存储 | 微信 Storage + 内存 sqlStore |
| 云端 | 微信云开发（云函数 + 云数据库） |
| 构建 | ESLint + Prettier 代码规范 |

---

## 📱 页面结构

### 🏠 首页（index）
- 数据概览卡片（行数、列数、最后更新时间）
- 快捷入口：数据解析 / 数据管理 / 开始分析
- 最近操作历史记录
- 设备自适应检测（移动端 / 桌面端布局切换）

### 📂 数据解析（dataParse）
- 从本地相册或文件系统选取 CSV 文件
- Web Worker 异步解析，支持大文件
- 列类型推断预览（数值列 / 分类列高亮）
- 解析成功后写入 `sqlStore`，全局可用

### 🗄️ 数据管理（dataStore）
- 数据表预览（支持横向滚动）
- 数据统计摘要
- 云端同步与本地备份操作

### 📈 分析预测（analysis）
- 左侧配置面板：分析类型选择、目标列、分组列
- 右侧结果区：摘要卡片 + ECharts 交互图表 + 详细数据表格
- 实时状态透视条（显示当前步骤进度）
- 分析历史记录

---

## 🔬 分析模块

共支持 **12 种分析类型**，涵盖统计、质量、建模、冶金四大类别：

| 类别 | 分析类型 | 说明 |
|------|---------|------|
| 📋 统计 | 基本信息概览 | 数据集维度、列类型分布 |
| 📋 统计 | 数值统计分析 | 均值、标准差、四分位数、极值 |
| ✅ 质量 | 异常值检测 | 3σ 法则识别异常点，散点图可视化 |
| 🔍 分析 | 特征重要性 | 线性相关 + 方差贡献综合评分 |
| 🔍 分析 | 排列重要性 | 基于模型性能下降的排列重要性 |
| 🔍 分析 | 相关性分析 | 皮尔逊相关系数 + 热力矩阵图 |
| 🔍 分析 | 参数分组分析 | 按指定列分组，组内统计汇总 |
| 🤖 建模 | 特征选择 | 方差贡献筛选高价值特征 |
| 🤖 建模 | 数据预处理 | 异常值剔除 + 特征选择流水线 |
| 🤖 建模 | 特征标准化 | Z-score 标准化，输出对比图 |
| 🤖 建模 | 多模型预测 | 5 种模型并行训练，输出 R²/MSE |
| 🌱 冶金 | 碳排放核算 | 高炉物料平衡法 CO₂ 排放量计算 |

---

## 🤖 机器学习模型

所有模型均为**纯 JavaScript 实现**，无需依赖 Python 环境，可在微信小程序沙箱中运行：

| 模型 | 文件 | 特点 |
|------|------|------|
| 线性回归 | `linearRegression.js` | 最小二乘法，速度最快，可解释性强 |
| 决策树 | `decisionTree.js` | 基于信息增益分裂，支持可视化路径 |
| 随机森林 | `randomForest.js` | 多棵决策树集成，抗过拟合 |
| 梯度提升 | `gradientBoosting.js` | GBDT 串行集成，精度更高 |
| 支持向量回归 | `supportVectorRegression.js` | SVR，适合非线性数据 |

**评估指标：** R²（决定系数）、MSE（均方误差）、特征重要性排名

---

## 🚀 快速开始

### 环境要求

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) ≥ 1.06.x
- Node.js ≥ 16（用于 lint 工具）
- 微信云开发已开通（或跳过云功能使用纯本地模式）

### 1. 克隆仓库

```bash
git clone https://github.com/XIAOHEZI-code/yunshang-tance.git
cd yunshang-tance
```

### 2. 安装依赖（可选，仅用于 lint）

```bash
cd miniprogram
npm install
```

### 3. 导入微信开发者工具

1. 打开**微信开发者工具** → **导入项目**
2. 项目目录选择 `miniprogram/`
3. AppID 填写 `wx080a1d0904ef4c43`（或替换为自己的）
4. 点击**确定**即可预览

### 4. 上传数据

在**数据解析**页面点击「上传 CSV」，选择你的高炉过程数据文件，支持格式见下方[数据格式](#-数据格式)说明。

### 5. 开始分析

进入**分析预测**页面，选择分析类型和目标列，点击「开始分析」，结果将以图表和卡片形式呈现。

---

## 📁 项目结构

```
yunshang-tance/
├── README.md                    # 项目说明
├── miniprogram/                 # 小程序源码根目录
│   ├── app.js                   # 小程序入口，云开发初始化
│   ├── app.json                 # 全局配置（页面注册、导航栏）
│   ├── app.wxss                 # 全局样式
│   ├── sitemap.json             # 搜索索引配置
│   │
│   ├── pages/                   # 页面
│   │   ├── index/               # 首页
│   │   ├── dataParse/           # 数据解析
│   │   ├── dataStore/           # 数据管理
│   │   └── analysis/            # 分析预测（核心页）
│   │
│   ├── components/              # 公共组件
│   │   ├── ec-canvas/           # ECharts 微信适配层
│   │   └── responsive-layout/   # 响应式布局组件
│   │
│   ├── utils/                   # 工具库
│   │   ├── workerManager.js     # Web Worker 管理（含降级策略）
│   │   ├── analysisApi.js       # 分析算法 API 聚合层
│   │   ├── sqlStore.js          # 内存关系型数据存储
│   │   ├── fileParse.js         # CSV 解析工具
│   │   ├── chartUtil.js         # ECharts 图表工具
│   │   ├── env.js               # 环境 / 设备检测
│   │   ├── common.js            # 通用工具函数
│   │   ├── models/              # 机器学习模型
│   │   │   ├── linearRegression.js
│   │   │   ├── decisionTree.js
│   │   │   ├── randomForest.js
│   │   │   ├── gradientBoosting.js
│   │   │   ├── supportVectorRegression.js
│   │   │   ├── modelEvaluator.js    # 统一评估器
│   │   │   ├── modelFactory.js      # 模型工厂
│   │   │   ├── modelIntegrator.js   # 多模型集成
│   │   │   └── parameterOptimizer.js# 参数优化
│   │   └── mcp/                 # MCP 协议扩展（可选）
│   │
│   ├── worker/                  # Web Worker 脚本
│   │   ├── analysisWorker.js    # 分析计算 Worker
│   │   └── parseWorker.js       # CSV 解析 Worker
│   │
│   ├── cloudfunctions/          # 微信云函数
│   │   ├── dataProcess/         # 数据处理云函数
│   │   └── backup/              # 数据备份云函数
│   │
│   ├── styles/                  # 全局样式模块
│   │   ├── variables.wxss       # 设计变量（颜色、间距）
│   │   └── components.wxss      # 公共组件样式
│   │
│   ├── images/                  # 图片资源
│   ├── api/                     # 接口封装
│   ├── services/                # 业务服务层
│   ├── package.json
│   └── .gitignore
```

---

## 📊 数据格式

上传的 CSV 文件需满足以下规范：

```csv
CR,HIR,injection rate,blast_volume,blast_temp,O2_enrichment,productivity
480.5,1520.3,145.2,3850,1180,3.2,2.85
492.1,1498.7,138.6,3920,1205,3.8,2.91
...
```

| 要求 | 说明 |
|------|------|
| 编码 | UTF-8 |
| 分隔符 | 英文逗号 `,` |
| 首行 | 必须为列名（英文或中文均可） |
| 数值列 | 超过 80% 的值可转为数字时自动识别为数值列 |
| 文件大小 | 建议 < 5 MB，移动端建议 < 1000 行 |

**常见高炉参数列名参考：**

| 参数 | 英文列名 | 单位 |
|------|---------|------|
| 焦比 | `CR` | kg/t |
| 铁水量 | `HIR` | t/h |
| 喷煤量 | `injection rate` | kg/t |
| 风量 | `blast_volume` | m³/min |
| 风温 | `blast_temp` | °C |
| 富氧率 | `O2_enrichment` | % |
| 利用系数 | `productivity` | t/(m³·d) |

---

## 🛠️ 开发说明

### 代码规范

```bash
# 检查
cd miniprogram && npm run lint

# 自动修复
cd miniprogram && npm run lint:fix
```

### Web Worker 降级策略

`workerManager.js` 实现了三级降级：

```
优先级 1：MCP 服务器（如已配置）
     ↓ 不可用
优先级 2：Web Worker（analysisWorker.js）
     ↓ 平台不支持
优先级 3：主线程直接执行（降级模式）
```

### 桌面端 vs 移动端差异

| 能力 | 桌面端 | 移动端 |
|------|--------|--------|
| 最大数据量 | 5000 行 | 1000 行 |
| 并行任务数 | 4 | 2 |
| Worker 超时 | 60s | 30s |
| 高级分析 | ✅ | ❌ |

### 云函数部署

```bash
# 在微信开发者工具中右键云函数目录
# 选择「上传并部署：云端安装依赖」
cloudfunctions/dataProcess/
cloudfunctions/backup/
```

---

## 🗺️ 路线图

- [ ] 支持 Excel (.xlsx) 格式导入
- [ ] 预测结果导出为图片 / PDF 报告
- [ ] 更多冶金专项模型（高炉热平衡、煤气利用率）
- [ ] 多数据集对比分析
- [ ] 模型参数可视化调优界面

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。

1. Fork 本仓库
2. 创建特性分支 `git checkout -b feat/your-feature`
3. 提交更改 `git commit -m 'feat: add some feature'`
4. 推送分支 `git push origin feat/your-feature`
5. 发起 Pull Request

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

<div align="center">

**云上碳测** · 让工业数据分析触手可及

Made with ❤️ by [XIAOHEZI-code](https://github.com/XIAOHEZI-code)

</div>