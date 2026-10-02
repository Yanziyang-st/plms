/* ==========================================================================
   PLMS 数据层 —— localStorage 持久化 + 种子数据
   ========================================================================== */
(function (global) {
  'use strict';

  const KEY = 'plms_db_v1';
  const SESSION_KEY = 'plms_session_v1';

  /* 安全存储：localStorage 不可用时（file:// 或被禁用）降级为内存存储 */
  const _mem = {};
  const storage = (function () {
    try {
      const t = '__plms_test__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return window.localStorage;
    } catch (e) {
      return {
        getItem: (k) => (k in _mem ? _mem[k] : null),
        setItem: (k, v) => { _mem[k] = String(v); },
        removeItem: (k) => { delete _mem[k]; },
      };
    }
  })();

  /* -------------------- 工具 -------------------- */
  let _seq = 0;
  const uid = (p) => `${p || 'id'}_${Date.now().toString(36)}${(_seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = () => new Date().toISOString();
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const daysAhead = (n) => new Date(Date.now() + n * 864e5).toISOString();
  const dateOnly = (d) => (d ? d.slice(0, 10) : '');
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* -------------------- 种子数据 -------------------- */
  function seed() {
    const users = [
      { id: 'u1', name: '张伟', username: 'zhangwei', role: '管理员', dept: '研发一部', email: 'zhangwei@demo.com', color: '#13a884' },
      { id: 'u2', name: '李娜', username: 'lina', role: '产品经理', dept: '产品部', email: 'lina@demo.com', color: '#f472b6' },
      { id: 'u3', name: '王强', username: 'wangqiang', role: '开发工程师', dept: '研发一部', email: 'wangqiang@demo.com', color: '#23d3a9' },
      { id: 'u4', name: '赵敏', username: 'zhaomin', role: '测试工程师', dept: '测试部', email: 'zhaomin@demo.com', color: '#ffb020' },
      { id: 'u5', name: '陈晨', username: 'chenchen', role: '开发工程师', dept: '研发二部', email: 'chenchen@demo.com', color: '#8b7cf6' },
      { id: 'u6', name: '刘洋', username: 'liuyang', role: 'UI 设计师', dept: '设计部', email: 'liuyang@demo.com', color: '#46dfd0' },
      { id: 'u7', name: '孙丽', username: 'sunli', role: '项目经理', dept: '项目部', email: 'sunli@demo.com', color: '#38bdf8' },
      { id: 'u8', name: '周涛', username: 'zhoutao', role: '运维工程师', dept: '运维部', email: 'zhoutao@demo.com', color: '#ff7a6b' },
    ];

    const products = [
      { id: 'p1', name: '智慧协同办公平台', identifier: 'OA', color: '#23d3a9', desc: '面向中型企业的协同办公与流程审批一体化平台。', owner: 'u2', status: '开发中', members: ['u2', 'u3', 'u5', 'u6', 'u4'], createdAt: daysAgo(120) },
      { id: 'p2', name: '数据分析中台', identifier: 'DATA', color: '#38bdf8', desc: '统一数据采集、加工、服务化的企业级数据中台。', owner: 'u7', status: '规划中', members: ['u7', 'u3', 'u8'], createdAt: daysAgo(60) },
      { id: 'p3', name: '移动端 App', identifier: 'APP', color: '#8b7cf6', desc: 'iOS / Android 双端协同办公客户端。', owner: 'u2', status: '已发布', members: ['u2', 'u6', 'u4', 'u5'], createdAt: daysAgo(200) },
    ];

    const reqTitles = [
      '支持多级流程审批与抄送', '工作台自定义仪表盘部件', '移动端消息推送与免打扰',
      '组织架构与人员同步接口', '文档在线预览与协同编辑', '单点登录 SSO 集成',
      '数据导出 Excel / PDF', '操作日志与审计追溯', '待办中心统一聚合',
      '全文检索能力建设', '第三方 Webhook 事件订阅', '浅色 / 深色主题切换',
    ];
    const requirements = reqTitles.map((t, i) => ({
      id: 'r' + (i + 1),
      productId: i < 6 ? 'p1' : i < 9 ? 'p2' : 'p3',
      code: `${i < 6 ? 'OA' : i < 9 ? 'DATA' : 'APP'}-REQ-${String(i + 1).padStart(3, '0')}`,
      title: t,
      type: i % 5 === 0 ? '工单' : '需求',
      priority: ['高', '中', '低', '高', '中'][i % 5],
      status: ['待评审', '已排期', '开发中', '已完成', '开发中', '待评审', '已排期', '已完成', '开发中', '待评审', '已排期', '已完成'][i],
      assignee: ['u3', 'u5', 'u3', 'u5', 'u3', 'u4', 'u8', 'u3', 'u5', 'u3', 'u4', 'u6'][i],
      points: [5, 3, 8, 5, 13, 3, 2, 8, 5, 3, 5, 2][i],
      source: ['客户反馈', '产品规划', '内部需求', '客户反馈', '产品规划'][i % 5],
      createdAt: daysAgo(90 - i * 5),
    }));

    const projects = [
      { id: 'proj1', name: '协同办公平台 V2.0', identifier: 'OAV2', type: 'Scrum', status: '进行中', owner: 'u7', members: ['u7', 'u2', 'u3', 'u5', 'u4', 'u6'], productId: 'p1', startDate: dateOnly(daysAgo(45)), endDate: dateOnly(daysAhead(45)), progress: 62, color: '#23d3a9', desc: '重构工作台与流程引擎，交付 V2.0 版本。' },
      { id: 'proj2', name: '数据中台一期', identifier: 'DATA1', type: 'Kanban', status: '进行中', owner: 'u8', members: ['u8', 'u3', 'u7'], productId: 'p2', startDate: dateOnly(daysAgo(20)), endDate: dateOnly(daysAhead(70)), progress: 28, color: '#38bdf8', desc: '完成数据采集与治理基础能力建设。' },
      { id: 'proj3', name: 'App 3.6 迭代', identifier: 'APP36', type: 'Scrum', status: '已完成', owner: 'u7', members: ['u7', 'u5', 'u4', 'u6'], productId: 'p3', startDate: dateOnly(daysAgo(90)), endDate: dateOnly(daysAgo(20)), progress: 100, color: '#8b7cf6', desc: '移动端性能优化与新交互上线。' },
    ];

    const sprints = [
      { id: 's1', projectId: 'proj1', name: 'Sprint 6 · 流程引擎', goal: '完成多级审批引擎与抄送能力', startDate: dateOnly(daysAgo(14)), endDate: dateOnly(daysAhead(7)), status: '进行中' },
      { id: 's2', projectId: 'proj1', name: 'Sprint 5 · 工作台重构', goal: '完成新工作台仪表盘', startDate: dateOnly(daysAgo(42)), endDate: dateOnly(daysAgo(15)), status: '已完成' },
      { id: 's3', projectId: 'proj2', name: '迭代 1 · 采集', goal: '打通 3 类数据源采集', startDate: dateOnly(daysAgo(18)), endDate: dateOnly(daysAhead(12)), status: '进行中' },
    ];

    const itemTitles = [
      '设计审批流程引擎数据模型', '实现流程节点条件分支', '工作台仪表盘部件开发',
      '移动端推送通道接入', '组织架构同步定时任务', '文档预览服务选型与对接',
      '编写流程引擎单元测试', '修复审批历史记录乱序问题', 'SSO 登录回调异常处理',
      '数据源采集插件开发', '数据质量校验规则配置', '仪表盘部件拖拽排序',
      '完善接口文档与示例', '性能压测与优化', '缺陷：导出超时',
    ];
    const statuses = ['待处理', '进行中', '待测试', '已完成', '已完成', '待处理', '进行中', '待测试'];
    const workItems = itemTitles.map((t, i) => ({
      id: 'w' + (i + 1),
      projectId: i < 8 ? 'proj1' : i < 12 ? 'proj2' : 'proj1',
      sprintId: i < 8 ? 's1' : i < 12 ? 's3' : 's1',
      title: t,
      code: `${i < 8 ? 'OAV2' : i < 12 ? 'DATA1' : 'APP36'}-${100 + i}`,
      type: i === 14 ? '缺陷' : i % 4 === 0 ? '需求' : '任务',
      priority: ['高', '中', '紧急', '低', '中'][i % 5],
      status: statuses[i % statuses.length],
      assignee: ['u3', 'u1', 'u6', 'u1', 'u5', 'u1', 'u4', 'u5', 'u3', 'u1', 'u8', 'u3', 'u5', 'u3', 'u3'][i],
      points: [5, 8, 3, 5, 2, 8, 3, 2, 5, 13, 5, 3, 2, 5, 2][i],
      startDate: dateOnly(daysAgo(12 - (i % 10))),
      endDate: dateOnly(daysAhead(8 - (i % 8))),
      createdAt: daysAgo(20 - i),
    }));

    const testLibraries = [
      { id: 'tl1', name: '协同办公平台测试库', desc: 'OA 平台功能与接口用例', owner: 'u4', productId: 'p1' },
      { id: 'tl2', name: '数据中台测试库', desc: '数据采集与治理用例', owner: 'u4', productId: 'p2' },
    ];
    const caseTitles = [
      '多级审批节点顺序流转', '审批抄送通知下发', '仪表盘部件新增与保存', '移动端推送到达率',
      'SSO 登录成功跳转', 'SSO 票据过期处理', '数据源连接测试', '数据质量校验告警',
      '文档在线预览加载', '导出 Excel 数据完整', '全文检索结果排序', '主题切换状态保持',
    ];
    const testCases = caseTitles.map((t, i) => ({
      id: 'tc' + (i + 1),
      libraryId: i < 10 ? 'tl1' : 'tl2',
      code: `${i < 10 ? 'OA' : 'DATA'}-TC-${String(i + 1).padStart(3, '0')}`,
      title: t,
      module: ['流程引擎', '通知中心', '工作台', '移动端', '认证', '认证', '数据采集', '数据质量', '文档中心', '报表', '检索', '主题'][i],
      priority: ['高', '中', '高', '中', '高', '低', '中', '高', '中', '高', '低', '低'][i],
      type: i % 3 === 0 ? '接口' : '功能',
      precondition: '用户已登录且拥有对应权限',
      steps: ['进入目标页面', '按照用例描述执行操作', '观察系统响应与结果'],
      expected: '系统按预期返回结果，数据一致且无异常。',
      maintainer: 'u4',
      lastResult: ['通过', '通过', '失败', '通过', '通过', '阻塞', '通过', '通过', '未执行', '通过', '未执行', '通过'][i],
      updatedAt: daysAgo(i + 1),
    }));
    const testPlans = [
      { id: 'tp1', name: 'V2.0 迭代回归测试', libraryId: 'tl1', projectId: 'proj1', startDate: dateOnly(daysAgo(6)), endDate: dateOnly(daysAhead(6)), status: '进行中', caseIds: ['tc1', 'tc2', 'tc3', 'tc4', 'tc5'], owner: 'u4' },
      { id: 'tp2', name: '数据中台冒烟测试', libraryId: 'tl2', projectId: 'proj2', startDate: dateOnly(daysAgo(3)), endDate: dateOnly(daysAhead(3)), status: '进行中', caseIds: ['tc7', 'tc8'], owner: 'u4' },
    ];

    const wikiSpaces = [
      { id: 'sp1', name: '产品知识库', icon: '📘', color: '#4f46e5', desc: '产品需求、原型、竞品与业务规则沉淀。', owner: 'u2', members: ['u2', 'u3', 'u5', 'u7'] },
      { id: 'sp2', name: '研发规范中心', icon: '🛠️', color: '#10b981', desc: '编码规范、架构设计、部署运维文档。', owner: 'u3', members: ['u3', 'u5', 'u8'] },
      { id: 'sp3', name: '测试知识库', icon: '🧪', color: '#f59e0b', desc: '测试策略、用例规范与环境说明。', owner: 'u4', members: ['u4', 'u3'] },
    ];
    const wikiPages = [
      { id: 'pg1', spaceId: 'sp1', title: '产品概述', parentId: null, author: 'u2', content: '# 产品概述\n\n本产品面向中型企业提供一体化的**协同办公**与流程审批能力。\n\n## 核心价值\n\n- 审批流程自动化，减少人工环节\n- 统一待办，提升响应效率\n- 数据可视化，支撑管理决策\n\n> 目标客户：100 - 2000 人规模的企业组织。', updatedAt: daysAgo(3) },
      { id: 'pg2', spaceId: 'sp1', title: '需求管理规范', parentId: null, author: 'u2', content: '# 需求管理规范\n\n## 需求来源\n\n1. 客户反馈工单\n2. 产品规划\n3. 内部改进需求\n\n## 优先级定义\n\n| 级别 | 说明 | 响应时长 |\n| --- | --- | --- |\n| 高 | 阻塞核心流程 | 1 个迭代内 |\n| 中 | 影响体验 | 2 个迭代内 |\n| 低 | 体验优化 | 排期视资源 |', updatedAt: daysAgo(6) },
      { id: 'pg3', spaceId: 'sp1', title: '竞品分析', parentId: 'pg1', author: 'u2', content: '# 竞品分析\n\n对主流协同办公产品在流程引擎与集成能力上的对比分析。\n\n- 流程引擎灵活性\n- 开放集成能力\n- 移动端体验', updatedAt: daysAgo(9) },
      { id: 'pg4', spaceId: 'sp2', title: '前端编码规范', parentId: null, author: 'u3', content: '# 前端编码规范\n\n## 命名\n\n组件使用 `PascalCase`，变量使用 `camelCase`。\n\n```js\nfunction fetchWorkItems(projectId) {\n  return api.get(`/projects/${projectId}/items`);\n}\n```\n\n## 提交规范\n\n- `feat`: 新功能\n- `fix`: 缺陷修复\n- `docs`: 文档', updatedAt: daysAgo(2) },
      { id: 'pg5', spaceId: 'sp2', title: '后端架构设计', parentId: null, author: 'u5', content: '# 后端架构设计\n\n采用分层架构：接入层 / 应用层 / 领域层 / 基础设施层。\n\n## 关键技术选型\n\n- 服务框架：Spring Boot\n- 持久层：MyBatis-Plus\n- 服务发现：Nacos', updatedAt: daysAgo(5) },
      { id: 'pg6', spaceId: 'sp3', title: '测试环境说明', parentId: null, author: 'u4', content: '# 测试环境说明\n\n| 环境 | 地址 | 说明 |\n| --- | --- | --- |\n| 集成 | test-int.demo.com | 每日构建 |\n| 预发 | pre.demo.com | 发布前回归 |', updatedAt: daysAgo(4) },
    ];

    const topics = [
      { id: 't1', title: 'V2.0 发布节奏与灰度策略讨论', author: 'u7', tags: ['发布', '决策'], content: 'V2.0 计划于下月中旬发布，需要确定灰度比例与回滚方案。欢迎大家提出建议。', createdAt: daysAgo(1), comments: [
        { id: 'c1', author: 'u3', content: '建议先灰度 5% 内部用户，观察 3 天无异常再扩到 30%。', createdAt: daysAgo(1) },
        { id: 'c2', author: 'u4', content: '测试侧已完成回归，可以支持发布，建议补充线上监控告警。', createdAt: daysAgo(1) },
      ] },
      { id: 't2', title: '工作台仪表盘交互方案征集', author: 'u2', tags: ['产品', '设计'], content: '仪表盘部件是否支持自由拖拽？大家更倾向固定布局还是可配置布局？', createdAt: daysAgo(3), comments: [
        { id: 'c3', author: 'u6', content: '推荐可配置 + 预设模板，兼顾新手上手与老用户定制。', createdAt: daysAgo(3) },
      ] },
      { id: 't3', title: '接口性能压测结果同步', author: 'u3', tags: ['技术', '性能'], content: '核心接口在 500 并发下 P99 为 210ms，满足预期，瓶颈主要在列表查询。', createdAt: daysAgo(5), comments: [] },
    ];

    const automations = [
      { id: 'a1', name: '新任务自动设置优先级', enabled: true, trigger: '工作项创建时', scope: '项目 · 协同办公平台 V2.0', condition: '工作项类型 = 任务', actions: ['将优先级设置为「中」'], runs: 42, lastRun: daysAgo(0) },
      { id: 'a2', name: '缺陷创建通知负责人', enabled: true, trigger: '工作项创建时', scope: '全部项目', condition: '工作项类型 = 缺陷', actions: ['通知工作项负责人', '添加标签「待处理」'], runs: 17, lastRun: daysAgo(1) },
      { id: 'a3', name: '测试失败自动创建缺陷', enabled: true, trigger: '用例执行失败时', scope: '测试 · 协同办公平台测试库', condition: '执行结果 = 失败', actions: ['创建缺陷工作项', '指派给用例维护人'], runs: 6, lastRun: daysAgo(2) },
      { id: 'a4', name: '迭代结束归档未完成项', enabled: false, trigger: '迭代状态变更时', scope: '项目 · 协同办公平台 V2.0', condition: '迭代状态 = 已完成', actions: ['将未完成工作项移至下一迭代'], runs: 3, lastRun: daysAgo(15) },
    ];

    const agents = [
      { id: 'ag1', name: '需求分析师', emoji: '🧭', color: '#23d3a9', role: '需求', desc: '具备需求拆解、优先级评估、验收标准编写能力，可将原始需求转化为结构化用户故事。', skills: ['需求拆解', '用户故事', '优先级评估', '验收标准'] },
      { id: 'ag2', name: '架构设计师', emoji: '🏗️', color: '#13a884', role: '设计', desc: '基于业务需求输出技术选型、领域模型与接口设计建议，识别架构风险。', skills: ['技术选型', '领域建模', '接口设计', '风险评估'] },
      { id: 'ag3', name: '开发工程师', emoji: '💻', color: '#38bdf8', role: '开发', desc: '生成代码骨架、单元测试与重构建议，协助定位缺陷根因。', skills: ['代码生成', '单元测试', '缺陷定位', '代码审查'] },
      { id: 'ag4', name: '测试工程师', emoji: '🧪', color: '#ffb020', role: '测试', desc: '根据需求自动生成测试用例、边界值分析与测试报告。', skills: ['用例生成', '边界分析', '测试报告', '缺陷复现'] },
      { id: 'ag5', name: '项目经理', emoji: '📊', color: '#8b7cf6', role: '管理', desc: '跟踪迭代进展、识别风险、生成站会纪要与周报。', skills: ['进度跟踪', '风险预警', '站会纪要', '周报生成'] },
      { id: 'ag6', name: '技术文档工程师', emoji: '📝', color: '#f472b6', role: '协作', desc: '将讨论与代码沉淀为规范文档，维护知识库结构。', skills: ['文档撰写', '知识沉淀', '术语统一', '结构梳理'] },
    ];

    const activities = [
      { id: 'ac1', userId: 'u3', action: '完成了工作项', target: 'OAV2-101 设计审批流程引擎数据模型', time: daysAgo(0) },
      { id: 'ac2', userId: 'u4', action: '提交了测试结果', target: 'OA-TC-001 多级审批节点顺序流转 · 通过', time: daysAgo(0) },
      { id: 'ac3', userId: 'u5', action: '更新了工作项状态', target: 'OAV2-102 实现流程节点条件分支 → 待测试', time: daysAgo(1) },
      { id: 'ac4', userId: 'u2', action: '创建了需求', target: 'OA-REQ-001 支持多级流程审批与抄送', time: daysAgo(1) },
      { id: 'ac5', userId: 'u7', action: '发起了话题', target: 'V2.0 发布节奏与灰度策略讨论', time: daysAgo(1) },
      { id: 'ac6', userId: 'u6', action: '评论了工作项', target: 'OAV2-103 工作台仪表盘部件开发', time: daysAgo(2) },
    ];

    return { users, products, requirements, projects, sprints, workItems, testLibraries, testCases, testPlans, wikiSpaces, wikiPages, topics, automations, agents, activities, meta: { version: 1, createdAt: now() } };
  }

  /* -------------------- 存储 -------------------- */
  let _db = null;
  function load() {
    try {
      const raw = storage.getItem(KEY);
      if (raw) { _db = JSON.parse(raw); return _db; }
    } catch (e) { /* ignore */ }
    _db = seed();
    save();
    return _db;
  }
  function save() {
    try { storage.setItem(KEY, JSON.stringify(_db)); } catch (e) { console.warn('保存失败', e); }
  }
  function reset() { _db = seed(); save(); return _db; }
  const data = () => ( _db || load() );

  /* -------------------- 通用 CRUD -------------------- */
  const TABLES = ['users', 'products', 'requirements', 'projects', 'sprints', 'workItems', 'testLibraries', 'testCases', 'testPlans', 'wikiSpaces', 'wikiPages', 'topics', 'automations', 'agents', 'activities'];

  function list(table, filter) {
    const arr = data()[table] || [];
    if (!filter) return clone(arr);
    return clone(arr.filter(filter));
  }
  function find(table, id) {
    const r = (data()[table] || []).find((x) => x.id === id);
    return r ? clone(r) : null;
  }
  function insert(table, record) {
    if (!TABLES.includes(table)) throw new Error('未知表: ' + table);
    const rec = Object.assign({}, record);
    if (!rec.id) rec.id = uid(table.slice(0, 2));
    if (!rec.createdAt && table !== 'meta') rec.createdAt = now();
    data()[table].unshift(rec);
    save();
    return clone(rec);
  }
  function update(table, id, patch) {
    const arr = data()[table] || [];
    const idx = arr.findIndex((x) => x.id === id);
    if (idx < 0) return null;
    arr[idx] = Object.assign({}, arr[idx], patch, { id, updatedAt: now() });
    save();
    return clone(arr[idx]);
  }
  function remove(table, id) {
    const arr = data()[table] || [];
    const idx = arr.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    arr.splice(idx, 1);
    save();
    return true;
  }

  /* -------------------- 业务辅助 -------------------- */
  function logActivity(userId, action, target) {
    data().activities.unshift({ id: uid('ac'), userId, action, target, time: now() });
    if (data().activities.length > 80) data().activities.length = 80;
    save();
  }
  const userById = (id) => (data().users.find((u) => u.id === id) || { id, name: '未知', color: '#8b93a7' });
  const productById = (id) => data().products.find((p) => p.id === id);
  const projectById = (id) => data().projects.find((p) => p.id === id);
  const initials = (name) => (name || '?').slice(-2);

  function statusKind(s) {
    const map = {
      '待处理': 'gray', '待评审': 'orange', '已排期': 'indigo', '进行中': 'blue', '开发中': 'blue',
      '待测试': 'purple', '已完成': 'green', '已发布': 'green', '规划中': 'gray', '通过': 'green',
      '失败': 'red', '阻塞': 'orange', '未执行': 'gray', '进行中': 'blue',
    };
    return map[s] || 'gray';
  }
  function priorityKind(p) { return { '紧急': 'red', '高': 'red', '中': 'orange', '低': 'gray' }[p] || 'gray'; }
  function priorityOrder(p) { return { '紧急': 0, '高': 1, '中': 2, '低': 3 }[p] ?? 9; }

  /* -------------------- 会话 -------------------- */
  function getSession() {
    try { const r = storage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  }
  function setSession(userId) { storage.setItem(SESSION_KEY, JSON.stringify({ userId, at: now() })); }
  function clearSession() { storage.removeItem(SESSION_KEY); }

  global.DB = { load, save, reset, data, list, find, insert, update, remove, logActivity, userById, productById, projectById, initials, statusKind, priorityKind, priorityOrder, getSession, setSession, clearSession, uid, dateOnly, daysAgo, daysAhead, seed };
})(window);
