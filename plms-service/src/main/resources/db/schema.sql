-- ============================================================================
-- PLMS 软件生命周期管理系统 · 数据库结构
-- 幂等脚本：全部使用 CREATE TABLE IF NOT EXISTS，可重复执行
-- ============================================================================

-- 用户 -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_user (
  id          VARCHAR(32)  NOT NULL COMMENT '主键',
  name        VARCHAR(30)  NOT NULL COMMENT '姓名',
  username    VARCHAR(40)  NOT NULL COMMENT '登录账号',
  password    VARCHAR(100) NOT NULL COMMENT '密码摘要',
  role        VARCHAR(30)  NOT NULL DEFAULT '开发工程师' COMMENT '角色',
  dept        VARCHAR(30)  NOT NULL DEFAULT '未分配' COMMENT '部门',
  email       VARCHAR(60)  NOT NULL DEFAULT '' COMMENT '邮箱',
  color       VARCHAR(20)  NOT NULL DEFAULT '#23d3a9' COMMENT '头像底色',
  enabled     TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用（停用后禁止登录）',
  created_at  DATETIME     NULL,
  updated_at  DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户';

-- 产品 -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_product (
  id          VARCHAR(32)  NOT NULL,
  name        VARCHAR(60)  NOT NULL COMMENT '产品名称',
  identifier  VARCHAR(6)   NOT NULL COMMENT '产品标识符',
  color       VARCHAR(20)  NOT NULL DEFAULT '#23d3a9',
  description VARCHAR(300) NOT NULL DEFAULT '' COMMENT '产品描述',
  owner       VARCHAR(32)  NULL COMMENT '负责人',
  status      VARCHAR(20)  NOT NULL DEFAULT '规划中',
  created_at  DATETIME     NULL,
  updated_at  DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_identifier (identifier),
  KEY idx_product_owner (owner)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品';

-- 需求 / 工单 ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_requirement (
  id          VARCHAR(32)  NOT NULL,
  product_id  VARCHAR(32)  NOT NULL COMMENT '所属产品',
  code        VARCHAR(40)  NOT NULL COMMENT '业务编号',
  title       VARCHAR(120) NOT NULL,
  type        VARCHAR(10)  NOT NULL DEFAULT '需求' COMMENT '需求/工单',
  priority    VARCHAR(10)  NOT NULL DEFAULT '中',
  status      VARCHAR(10)  NOT NULL DEFAULT '待评审',
  assignee    VARCHAR(32)  NULL,
  points      INT          NOT NULL DEFAULT 3 COMMENT '故事点',
  source      VARCHAR(20)  NOT NULL DEFAULT '内部需求',
  description VARCHAR(1000) NOT NULL DEFAULT '',
  created_at  DATETIME     NULL,
  updated_at  DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_requirement_code (code),
  KEY idx_requirement_product (product_id),
  KEY idx_requirement_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='需求/工单';

-- 项目 -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_project (
  id          VARCHAR(32)  NOT NULL,
  name        VARCHAR(60)  NOT NULL,
  identifier  VARCHAR(8)   NOT NULL COMMENT '项目标识符',
  type        VARCHAR(20)  NOT NULL DEFAULT 'Scrum' COMMENT 'Scrum/Kanban/瀑布',
  status      VARCHAR(20)  NOT NULL DEFAULT '进行中',
  owner       VARCHAR(32)  NULL,
  product_id  VARCHAR(32)  NULL COMMENT '关联产品',
  start_date  DATE         NULL,
  end_date    DATE         NULL,
  progress    INT          NOT NULL DEFAULT 0 COMMENT '进度 0-100',
  color       VARCHAR(20)  NOT NULL DEFAULT '#23d3a9',
  description VARCHAR(300) NOT NULL DEFAULT '',
  members     JSON         NULL COMMENT '成员 ID 列表',
  created_at  DATETIME     NULL,
  updated_at  DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_project_identifier (identifier),
  KEY idx_project_owner (owner)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目';

-- 迭代 -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_sprint (
  id          VARCHAR(32)  NOT NULL,
  project_id  VARCHAR(32)  NOT NULL,
  name        VARCHAR(60)  NOT NULL,
  goal        VARCHAR(200) NOT NULL DEFAULT '',
  start_date  DATE         NULL,
  end_date    DATE         NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT '未开始',
  created_at  DATETIME     NULL,
  updated_at  DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_sprint_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='迭代';

-- 工作项 ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_work_item (
  id          VARCHAR(32)  NOT NULL,
  project_id  VARCHAR(32)  NOT NULL,
  sprint_id   VARCHAR(32)  NULL,
  parent_id   VARCHAR(32)  NULL COMMENT '父工作项；为空表示顶层工作项',
  title       VARCHAR(120) NOT NULL,
  code        VARCHAR(40)  NOT NULL,
  type        VARCHAR(10)  NOT NULL DEFAULT '任务',
  priority    VARCHAR(10)  NOT NULL DEFAULT '中',
  status      VARCHAR(10)  NOT NULL DEFAULT '待处理',
  assignee    VARCHAR(32)  NULL,
  points      INT          NOT NULL DEFAULT 3,
  start_date  DATE         NULL,
  end_date    DATE         NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  created_at  DATETIME     NULL,
  updated_at  DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_work_item_code (code),
  KEY idx_work_item_project (project_id),
  KEY idx_work_item_status (status),
  KEY idx_work_item_assignee (assignee),
  KEY idx_work_item_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工作项';

-- 测试库 ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_test_library (
  id          VARCHAR(32)  NOT NULL,
  name        VARCHAR(60)  NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  owner       VARCHAR(32)  NULL,
  product_id  VARCHAR(32)  NULL,
  created_at  DATETIME     NULL,
  updated_at  DATETIME     NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试库';

-- 测试用例 -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_test_case (
  id           VARCHAR(32)  NOT NULL,
  library_id   VARCHAR(32)  NOT NULL,
  code         VARCHAR(40)  NOT NULL,
  title        VARCHAR(120) NOT NULL,
  module       VARCHAR(30)  NOT NULL DEFAULT '通用',
  priority     VARCHAR(10)  NOT NULL DEFAULT '中',
  type         VARCHAR(10)  NOT NULL DEFAULT '功能',
  precondition VARCHAR(200) NOT NULL DEFAULT '',
  steps        JSON         NULL COMMENT '测试步骤',
  expected     VARCHAR(300) NOT NULL DEFAULT '',
  maintainer   VARCHAR(32)  NULL,
  last_result  VARCHAR(10)  NOT NULL DEFAULT '未执行',
  created_at   DATETIME     NULL,
  updated_at   DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_test_case_code (code),
  KEY idx_test_case_library (library_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试用例';

-- 测试计划 -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_test_plan (
  id          VARCHAR(32)  NOT NULL,
  name        VARCHAR(60)  NOT NULL,
  library_id  VARCHAR(32)  NULL,
  project_id  VARCHAR(32)  NULL,
  owner       VARCHAR(32)  NULL,
  start_date  DATE         NULL,
  end_date    DATE         NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT '进行中',
  case_ids    JSON         NULL COMMENT '用例 ID 列表',
  results     JSON         NULL COMMENT 'caseId -> 执行结果',
  created_at  DATETIME     NULL,
  updated_at  DATETIME     NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试计划';

-- 知识空间 -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_wiki_space (
  id          VARCHAR(32)  NOT NULL,
  name        VARCHAR(60)  NOT NULL,
  icon        VARCHAR(8)   NOT NULL DEFAULT '📘',
  color       VARCHAR(20)  NOT NULL DEFAULT '#23d3a9',
  description VARCHAR(300) NOT NULL DEFAULT '',
  owner       VARCHAR(32)  NULL,
  members     JSON         NULL,
  created_at  DATETIME     NULL,
  updated_at  DATETIME     NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识空间';

-- 知识页面 -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_wiki_page (
  id          VARCHAR(32)   NOT NULL,
  space_id    VARCHAR(32)   NOT NULL,
  parent_id   VARCHAR(32)   NULL,
  title       VARCHAR(120)  NOT NULL,
  content     MEDIUMTEXT    NULL COMMENT 'Markdown 正文',
  author      VARCHAR(32)   NULL,
  created_at  DATETIME      NULL,
  updated_at  DATETIME      NULL,
  PRIMARY KEY (id),
  KEY idx_wiki_page_space (space_id),
  KEY idx_wiki_page_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识页面';

-- 协作话题 -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_topic (
  id          VARCHAR(32)  NOT NULL,
  title       VARCHAR(120) NOT NULL,
  content     VARCHAR(2000) NOT NULL DEFAULT '',
  author      VARCHAR(32)  NULL,
  tags        JSON         NULL,
  created_at  DATETIME     NULL,
  updated_at  DATETIME     NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='协作话题';

-- 话题评论 -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_topic_comment (
  id          VARCHAR(32)  NOT NULL,
  topic_id    VARCHAR(32)  NOT NULL,
  author      VARCHAR(32)  NULL,
  content     VARCHAR(1000) NOT NULL,
  created_at  DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_comment_topic (topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='话题评论';

-- 自动化规则 -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_automation (
  id             VARCHAR(32)  NOT NULL,
  name           VARCHAR(60)  NOT NULL,
  enabled        TINYINT(1)   NOT NULL DEFAULT 1,
  trigger_event  VARCHAR(40)  NOT NULL COMMENT '触发时机',
  scope          VARCHAR(60)  NOT NULL DEFAULT '全部项目',
  condition_expr VARCHAR(120) NOT NULL DEFAULT '无' COMMENT '触发条件',
  actions        JSON         NULL COMMENT '执行动作',
  runs           INT          NOT NULL DEFAULT 0 COMMENT '执行次数',
  last_run       DATETIME     NULL,
  created_at     DATETIME     NULL,
  updated_at     DATETIME     NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动化规则';

-- 智能体 ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_agent (
  id          VARCHAR(32)  NOT NULL,
  name        VARCHAR(60)  NOT NULL,
  emoji       VARCHAR(8)   NOT NULL DEFAULT '🤖',
  color       VARCHAR(20)  NOT NULL DEFAULT '#23d3a9',
  role        VARCHAR(20)  NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  skills      JSON         NULL,
  created_at  DATETIME     NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='智能体';

-- 活动日志 -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plm_activity (
  id          VARCHAR(32)  NOT NULL,
  user_id     VARCHAR(32)  NULL,
  action      VARCHAR(40)  NOT NULL,
  target      VARCHAR(200) NOT NULL DEFAULT '',
  occurred_at DATETIME     NULL,
  created_at  DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_activity_time (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动日志';

-- 实体关联（需求追踪矩阵的数据基础）------------------------------------------
CREATE TABLE IF NOT EXISTS plm_link (
  id          VARCHAR(32)  NOT NULL,
  source_type VARCHAR(20)  NOT NULL COMMENT 'requirement / work-item / test-case',
  source_id   VARCHAR(32)  NOT NULL,
  target_type VARCHAR(20)  NOT NULL COMMENT 'requirement / work-item / test-case',
  target_id   VARCHAR(32)  NOT NULL,
  link_type   VARCHAR(20)  NOT NULL DEFAULT 'relates' COMMENT 'implements / verifies / relates',
  created_at  DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_link (source_type, source_id, target_type, target_id, link_type),
  KEY idx_link_source (source_type, source_id),
  KEY idx_link_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='实体关联';

-- 通用评论（工作项 / 需求 / 用例 / 话题）-------------------------------------
CREATE TABLE IF NOT EXISTS plm_comment (
  id          VARCHAR(32)  NOT NULL,
  target_type VARCHAR(20)  NOT NULL COMMENT 'work-item / requirement / test-case / topic',
  target_id   VARCHAR(32)  NOT NULL,
  author      VARCHAR(32)  NULL,
  content     VARCHAR(1000) NOT NULL,
  created_at  DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_comment_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通用评论';
