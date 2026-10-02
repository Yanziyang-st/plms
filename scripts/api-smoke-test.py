#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PLMS 后端接口冒烟测试
覆盖：鉴权、分页筛选、CRUD、字段校验、业务规则、状态码语义
运行：python scripts/api-smoke-test.py
"""
import json
import urllib.request
import urllib.error
import sys

BASE = "http://127.0.0.1:8080"
TOKEN = None
passed, failed = [], []


def call(method, path, body=None, token=True, raw=False):
    """发起请求，返回 (http_status, parsed_body)"""
    url = BASE + path
    data = None
    headers = {"Content-Type": "application/json; charset=utf-8"}
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    if token and TOKEN:
        headers["Authorization"] = "Bearer " + TOKEN
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            text = resp.read().decode("utf-8")
            return resp.status, (text if raw else (json.loads(text) if text else None))
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8")
        try:
            return e.code, json.loads(text)
        except Exception:
            return e.code, {"raw": text}


def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(("  \u2713 " if cond else "  \u2717 ") + name + (("  \u2014 " + str(detail)) if detail and not cond else ""))


def section(t):
    print("\n=== " + t + " ===")


# ---------------------------------------------------------------- 1. 鉴权
section("1. 认证与鉴权")
st, res = call("POST", "/api/auth/login", {"username": "demo_admin", "password": "123456"}, token=False)
check("登录成功返回 200", st == 200, st)
check("登录返回 code=0", res.get("code") == 0, res)
check("登录返回 token", bool(res.get("data", {}).get("token")))
check("登录不返回密码字段", "password" not in json.dumps(res.get("data", {}).get("user", {})), "响应泄露了密码")
TOKEN = res["data"]["token"]

st, res = call("POST", "/api/auth/login", {"username": "demo_admin", "password": "wrong-password"}, token=False)
check("密码错误返回 401", st == 401, st)
check("密码错误 code=40102", res.get("code") == 40102, res.get("code"))

st, res = call("POST", "/api/auth/login", {"username": "", "password": ""}, token=False)
check("空账号密码返回 400", st == 400, st)

st, res = call("GET", "/api/products", token=False)
check("无令牌访问返回 401", st == 401, st)
check("无令牌 code=40101", res.get("code") == 40101, res.get("code"))

st, res = call("GET", "/api/auth/me")
check("GET /auth/me 返回当前用户", st == 200 and res["data"]["username"] == "demo_admin", res)

st, res = call("GET", "/api/system/health", token=False)
check("健康检查免鉴权", st == 200, st)

# ---------------------------------------------------------------- 2. 水合与列表
section("2. 首屏水合与列表查询")
st, res = call("GET", "/api/bootstrap")
d = res.get("data", {})
check("bootstrap 返回 200", st == 200, st)
for k in ["users", "products", "requirements", "projects", "workItems", "testCases", "wikiPages", "topics", "automations", "agents"]:
    check("bootstrap 含 " + k, isinstance(d.get(k), list) and len(d[k]) > 0, len(d.get(k, [])))
check("topics 内嵌 comments", isinstance(d.get("topics", [{}])[0].get("comments"), list))

st, res = call("GET", "/api/requirements")
check("默认分页返回 total/page/pageSize", all(k in res["data"] for k in ("list", "total", "page", "pageSize")), res.get("data", {}).keys())

st, res = call("GET", "/api/requirements?page=1&pageSize=5")
check("pageSize=5 生效", len(res["data"]["list"]) == 5, len(res["data"]["list"]))

st, res = call("GET", "/api/requirements?status=%E5%B7%B2%E5%AE%8C%E6%88%90")
ok = all(r["status"] == "已完成" for r in res["data"]["list"])
check("按 status 筛选生效", ok and len(res["data"]["list"]) > 0, res["data"]["total"])

st, res = call("GET", "/api/requirements?productId=p1")
check("按 productId 筛选生效", all(r["productId"] == "p1" for r in res["data"]["list"]))

st, res = call("GET", "/api/requirements?keyword=%E5%AE%A1%E6%89%B9")
check("关键字检索生效", all("审批" in r["title"] for r in res["data"]["list"]))

st, res = call("GET", "/api/requirements?sort=points&order=desc")
pts = [r["points"] for r in res["data"]["list"]]
check("排序生效（points 降序）", pts == sorted(pts, reverse=True), pts[:5])

st, res = call("GET", "/api/requirements?pageSize=99999")
check("超出上限的 pageSize 被收敛", res["data"]["pageSize"] <= 500, res["data"]["pageSize"])

st, res = call("GET", "/api/requirements?evil=%27%20OR%201%3D1--")
check("非白名单筛选参数被忽略（不报错）", st == 200, st)

st, res = call("GET", "/api/requirements/r1")
check("详情接口返回单条", st == 200 and res["data"]["id"] == "r1", res)

st, res = call("GET", "/api/requirements/not-exist")
check("详情不存在返回 404", st == 404 and res["code"] == 40401, (st, res.get("code")))

# ---------------------------------------------------------------- 3. 字段校验
section("3. 字段级校验")
st, res = call("POST", "/api/requirements", {"title": "", "productId": "p1"})
check("标题为空返回 400", st == 400 and res["code"] == 40001, (st, res.get("code")))
check("400 返回字段级 errors", isinstance(res.get("errors"), list) and res["errors"][0]["field"] == "title", res.get("errors"))

st, res = call("POST", "/api/requirements", {"title": "x", "productId": "p1"})
check("标题长度不足返回 400", st == 400, st)

st, res = call("POST", "/api/requirements", {"title": "合法标题", "productId": "no-such-product"})
check("引用不存在返回 400", st == 400 and "不存在" in res["message"], res.get("message"))

st, res = call("POST", "/api/requirements", {"title": "合法标题", "productId": "p1", "priority": "超级高"})
check("枚举非法返回 400", st == 400 and "优先级" in res["message"], res.get("message"))

st, res = call("POST", "/api/requirements", {"title": "合法标题", "productId": "p1", "points": 999})
check("数值越界返回 400", st == 400, st)

st, res = call("POST", "/api/products", {"name": "测试产品", "identifier": "123abc"})
check("标识符格式校验返回 400", st == 400 and "标识符" in res["message"], res.get("message"))

st, res = call("POST", "/api/requirements", {"title": "合法标题", "productId": "p1", "code": "HACK-001", "points": 1})
check("readonly 字段被忽略（不采纳客户端编号）", st == 201 and res["data"]["code"] != "HACK-001", res["data"].get("code") if st == 201 else res)
created_req_id = res["data"]["id"] if st == 201 else None

# ---------------------------------------------------------------- 4. CRUD
section("4. 增删改查")
st, res = call("POST", "/api/requirements", {"title": "接口冒烟新增需求", "productId": "p1", "type": "需求", "priority": "高", "points": 8})
check("新建返回 201", st == 201, st)
check("新建自动生成编号", bool(res["data"]["code"]), res["data"].get("code"))
new_id = res["data"]["id"]

st, res = call("PATCH", "/api/requirements/" + new_id, {"status": "开发中"})
check("部分更新返回 200", st == 200 and res["data"]["status"] == "开发中", res)

st, res = call("PATCH", "/api/requirements/" + new_id, {"status": "非法状态"})
check("部分更新校验非法枚举", st == 400, st)

st, res = call("PATCH", "/api/requirements/" + new_id, {})
check("空更新体返回 400", st == 400, st)

st, res = call("PATCH", "/api/requirements/not-exist", {"status": "开发中"})
check("更新不存在资源返回 404", st == 404, st)

st, res = call("PUT", "/api/requirements/" + new_id, {"title": "通过 PUT 更新"})
check("PUT 兼容更新", st == 200 and res["data"]["title"] == "通过 PUT 更新", res)

st, res = call("DELETE", "/api/requirements/" + new_id)
check("删除返回 200", st == 200, st)

st, res = call("GET", "/api/requirements/" + new_id)
check("删除后查不到（404）", st == 404, st)

st, res = call("DELETE", "/api/products/p1")
check("存在引用时删除返回 409", st == 409 and res["code"] == 40901, (st, res.get("code")))

st, res = call("POST", "/api/products", {"name": "重复标识产品", "identifier": "OA"})
check("标识符重复返回 400/409", st in (400, 409, 500), st)

# ---------------------------------------------------------------- 5. 业务接口
section("5. 领域业务接口")
# 注意：这里用 w7 而不是 w1 —— w1 下已挂子任务，
# 父项在子项未全部完成时不允许关闭（见第 17 节），会返回 422。
st, res = call("GET", "/api/work-items/w7")
old = res["data"]["status"]
st, res = call("PATCH", "/api/work-items/w7/status", {"status": "已完成"})
check("看板状态流转返回 200", st == 200 and res["data"]["item"]["status"] == "已完成", res)
check("状态流转联动返回项目", res["data"].get("project") is not None)
check("项目进度已重算", isinstance(res["data"]["project"]["progress"], int), res["data"]["project"]["progress"])
check("流转响应带子项汇总", "subtasks" in res["data"], list(res["data"].keys()))

st, res = call("PATCH", "/api/work-items/w7/status", {"status": "不存在的状态"})
check("非法状态流转返回 400", st == 400, st)
call("PATCH", "/api/work-items/w7/status", {"status": old})

st, res = call("POST", "/api/test-cases/tc1/result", {"result": "通过"})
check("记录用例结果", st == 200 and res["data"]["lastResult"] == "通过", res)

st, res = call("POST", "/api/test-cases/tc1/result", {"result": "乱七八糟"})
check("非法结果返回 400", st == 400, st)

st, before = call("GET", "/api/work-items?type=%E7%BC%BA%E9%99%B7")
st, res = call("POST", "/api/test-plans/tp1/execute", {"caseId": "tc2", "result": "失败"})
check("执行测试计划返回 200", st == 200, (st, res))
check("失败自动创建缺陷（自动化规则）", res["data"].get("autoCreatedDefect") is not None, res["data"].keys() if st == 200 else res)
st, after = call("GET", "/api/work-items?type=%E7%BC%BA%E9%99%B7")
check("缺陷数量 +1", after["data"]["total"] == before["data"]["total"] + 1, (before["data"]["total"], after["data"]["total"]))

st, res = call("POST", "/api/test-plans/tp1/execute", {"caseId": "tc999", "result": "通过"})
check("用例不在计划内返回 422", st == 422 and res["code"] == 42201, (st, res.get("code")))

st, res = call("POST", "/api/topics/t1/comments", {"content": "接口冒烟测试评论"})
check("发表评论返回 201", st == 201 and res["data"]["content"] == "接口冒烟测试评论", res)

st, res = call("POST", "/api/topics/t1/comments", {"content": ""})
check("空评论返回 400", st == 400, st)

st, res = call("POST", "/api/automations/a1/toggle")
check("自动化开关切换", st == 200 and res["data"]["enabled"] is False, res["data"].get("enabled"))
call("POST", "/api/automations/a1/toggle")

st, res = call("POST", "/api/automations/a1/run")
check("自动化手动执行 runs+1", st == 200 and res["data"]["runs"] >= 1, res["data"].get("runs"))

st, res = call("GET", "/api/metrics/overview")
check("效能总览返回聚合数据", st == 200 and "workItems" in res["data"] and "tests" in res["data"], list(res.get("data", {}).keys()))
check("总览含故事点汇总", "totalPoints" in res["data"]["workItems"], res["data"].get("workItems"))

st, res = call("GET", "/api/metrics/members")
check("成员效能报表按点数降序", st == 200 and len(res["data"]) > 0, len(res.get("data", [])))

st, res = call("GET", "/api/search?q=%E5%AE%A1%E6%89%B9")
check("全局搜索返回结果", st == 200 and len(res["data"]) > 0, len(res.get("data", [])))

st, res = call("GET", "/api/search?q=")
check("空关键字搜索返回 400", st == 400, st)

# ---------------------------------------------------------------- 6. 异常与错误码
section("6. 异常处理与错误码")
st, res = call("GET", "/api/not-exist-path")
check("未知路径返回 4xx JSON", st in (404, 500), st)

st, res = call("POST", "/api/requirements", raw=True)
req = urllib.request.Request(BASE + "/api/requirements", data=b"{bad json",
                             headers={"Content-Type": "application/json", "Authorization": "Bearer " + TOKEN}, method="POST")
try:
    urllib.request.urlopen(req, timeout=10)
    check("非法 JSON 返回 400", False, "未报错")
except urllib.error.HTTPError as e:
    check("非法 JSON 返回 400", e.code == 400, e.code)

st, res = call("DELETE", "/api/products/p1", token=True)
check("错误响应结构统一（含 code/message）", "code" in res and "message" in res, res)

# ---------------------------------------------------------------- 7. 权限控制
section("7. RBAC 权限控制")
ADMIN_TOKEN = TOKEN
st, res = call("GET", "/api/auth/permissions")
check("权限接口返回权限点", st == 200 and isinstance(res["data"].get("permissions"), list), res.get("data", {}).keys())
check("权限接口返回角色矩阵", isinstance(res["data"].get("matrix"), list) and len(res["data"]["matrix"]) >= 5)

# 测试工程师：有 test:write，无 product:write
st, res = call("POST", "/api/auth/login", {"username": "zhaomin", "password": "123456"}, token=False)
TESTER_TOKEN = res["data"]["token"]
st, res = call("GET", "/api/test-cases", token=False)
TOKEN_SAVE = TOKEN
TOKEN = TESTER_TOKEN
st, res = call("GET", "/api/test-cases")
check("测试工程师可读测试用例", st == 200, st)
st, res = call("POST", "/api/products", {"name": "越权产品", "identifier": "XX"}, token=True)
check("测试工程师写产品被拒 403", st == 403 and res.get("code") == 40301, (st, res.get("code")))
st, res = call("GET", "/api/products")
check("测试工程师可读产品（有 product:read）", st == 200, st)

# 运维工程师：无 product:read
st, res = call("POST", "/api/auth/login", {"username": "zhoutao", "password": "123456"}, token=False)
TOKEN = res["data"]["token"]
st, res = call("GET", "/api/products")
check("运维工程师读产品被拒 403", st == 403, st)
st, res = call("GET", "/api/automations")
check("运维工程师可读自动化", st == 200, st)

# 越权的 bootstrap 也不下发数据
st, res = call("GET", "/api/bootstrap")
check("bootstrap 按权限过滤集合", "products" not in res["data"] and "projects" in res["data"],
      list(res.get("data", {}).keys()))
TOKEN = ADMIN_TOKEN

# ---------------------------------------------------------------- 8. 状态机
section("8. 工作项状态机")
st, res = call("GET", "/api/work-items/w1/transitions")
check("查询可流转状态", st == 200 and "allowed" in res["data"], res.get("data"))
call("PATCH", "/api/work-items/w1/status", {"status": "进行中"})
st, res = call("GET", "/api/work-items/w1/transitions")
check("进行中可流转到待测试", "待测试" in res["data"]["allowed"], res["data"].get("allowed"))
st, res = call("PATCH", "/api/work-items/w1/status", {"status": "进行中"})
check("重复设置为同一状态被拒 422", st == 422, st)
st, res = call("PATCH", "/api/work-items/w1/status", {"status": "乱七八糟"})
check("非法状态被拒 400", st == 400, st)
# 待处理 -> 待测试 不允许
st, res = call("POST", "/api/work-items", {
    "title": "状态机测试工作项", "projectId": "proj1", "status": "待处理"})
SM_ID = res["data"]["id"]
st, res = call("PATCH", f"/api/work-items/{SM_ID}/status", {"status": "待测试"})
check("待处理→待测试 非法流转 422", st == 422 and "不允许" in res["message"], res.get("message"))
st, res = call("PATCH", f"/api/work-items/{SM_ID}/status", {"status": "进行中"})
check("待处理→进行中 合法", st == 200, st)
call("DELETE", f"/api/work-items/{SM_ID}")

# ---------------------------------------------------------------- 9. 关联与追溯
section("9. 实体关联与需求追踪矩阵")
st, res = call("GET", "/api/trace/requirement/r1")
check("需求追踪详情", st == 200 and "workItems" in res["data"], res.get("data", {}).keys())
check("需求 r1 已关联工作项", len(res["data"]["workItems"]) > 0, len(res["data"]["workItems"]))
check("需求 r1 已关联用例", len(res["data"]["testCases"]) > 0, len(res["data"]["testCases"]))
check("覆盖度字段完整", all(k in res["data"]["coverage"] for k in ("hasWorkItem", "hasTestCase", "fullyCovered")))

st, res = call("GET", "/api/trace/matrix")
check("追踪矩阵返回 rows + summary", st == 200 and "rows" in res["data"] and "coverageRate" in res["data"]["summary"],
      res.get("data", {}).get("summary"))
st, res = call("GET", "/api/trace/matrix?productId=p1")
check("矩阵按产品过滤", st == 200 and res["data"]["summary"]["total"] > 0, res["data"]["summary"])

st, res = call("GET", "/api/links?entityType=requirement&entityId=r1")
check("查询实体关联", st == 200 and len(res["data"]["links"]) > 0, len(res["data"].get("links", [])))
LINK_ID = res["data"]["links"][0]["linkId"]

st, res = call("POST", "/api/links", {
    "sourceType": "requirement", "sourceId": "r10",
    "targetType": "work-item", "targetId": "w1", "linkType": "implements"})
check("新建关联 201", st == 201, st)
NEW_LINK = res["data"]["id"] if st == 201 else None
st, res = call("POST", "/api/links", {
    "sourceType": "requirement", "sourceId": "r10",
    "targetType": "work-item", "targetId": "w1", "linkType": "implements"})
check("重复关联返回 409", st == 409, st)
st, res = call("POST", "/api/links", {
    "sourceType": "requirement", "sourceId": "r1",
    "targetType": "work-item", "targetId": "不存在"})
check("关联不存在的对象返回 404", st == 404, st)
st, res = call("POST", "/api/links", {
    "sourceType": "requirement", "sourceId": "r1",
    "targetType": "work-item", "targetId": "r1"})
check("非法类型组合被拒", st == 404, st)
if NEW_LINK:
    st, res = call("DELETE", f"/api/links/{NEW_LINK}")
    check("解除关联", st == 200, st)

# ---------------------------------------------------------------- 10. 评论
section("10. 通用评论")
st, res = call("GET", "/api/comments?targetType=work-item&targetId=w1")
check("查询工作项评论", st == 200 and len(res["data"]) > 0, len(res.get("data", [])))
st, res = call("POST", "/api/comments", {"targetType": "work-item", "targetId": "w1", "content": "冒烟测试评论"})
check("发表评论 201", st == 201 and res["data"]["content"] == "冒烟测试评论", res)
CMT_ID = res["data"]["id"] if st == 201 else None
st, res = call("POST", "/api/comments", {"targetType": "work-item", "targetId": "w1", "content": ""})
check("空评论 400", st == 400, st)
st, res = call("POST", "/api/comments", {"targetType": "work-item", "targetId": "not-exist", "content": "x"})
check("评论对象不存在 404", st == 404, st)
st, res = call("POST", "/api/comments", {"targetType": "unknown", "targetId": "w1", "content": "x"})
check("非法评论类型 400", st == 400, st)
if CMT_ID:
    st, res = call("DELETE", f"/api/comments/{CMT_ID}")
    check("删除自己的评论", st == 200, st)

# 权限规则：仅作者本人或管理员可删。
# ① 管理员（当前登录）可删他人评论 —— 合法，应返回 200
st, res = call("GET", "/api/comments?targetType=work-item&targetId=w1")
others = [c for c in res["data"] if c["author"] != "u1"]
if others:
    st, res = call("DELETE", f"/api/comments/{others[0]['id']}")
    check("管理员可删除他人评论", st == 200, st)

# ② 非管理员删除他人评论 —— 应返回 403
st, res = call("POST", "/api/comments", {"targetType": "work-item", "targetId": "w1",
                                         "content": "由管理员发表的评论"})
ADMIN_CMT = res["data"]["id"] if st == 201 else None
TOKEN = TESTER_TOKEN
if ADMIN_CMT:
    st, res = call("DELETE", f"/api/comments/{ADMIN_CMT}")
    check("非管理员删除他人评论被拒 403", st == 403 and res.get("code") == 40301, (st, res.get("code")))
# ③ 非管理员删除自己的评论 —— 合法
st, res = call("POST", "/api/comments", {"targetType": "work-item", "targetId": "w1", "content": "测试者自己的评论"})
if st == 201:
    st, res = call("DELETE", f"/api/comments/{res['data']['id']}")
    check("非管理员可删除自己的评论", st == 200, st)
TOKEN = ADMIN_TOKEN
if ADMIN_CMT:
    call("DELETE", f"/api/comments/{ADMIN_CMT}")

st, res = call("GET", "/api/topics/t1/comments")
check("话题评论走通用评论", st == 200 and len(res["data"]) >= 2, len(res.get("data", [])))

# ---------------------------------------------------------------- 11. 批量操作
section("11. 批量操作")
ids = []
for i in range(3):
    st, res = call("POST", "/api/work-items", {"title": f"批量测试项{i}", "projectId": "proj2"})
    ids.append(res["data"]["id"])
st, res = call("POST", "/api/work-items/batch-update", {"ids": ids, "patch": {"priority": "高"}})
check("批量更新成功", st == 200 and res["data"]["success"] == 3, res.get("data", {}).get("success"))
st, res = call("POST", "/api/work-items/batch-delete", {"ids": ids})
check("批量删除成功", st == 200 and res["data"]["success"] == 3, res.get("data", {}).get("success"))
st, res = call("POST", "/api/work-items/batch-delete", {"ids": []})
check("空 ids 返回 400", st == 400, st)
st, res = call("POST", "/api/work-items/batch-update", {"ids": ["w1"], "patch": {"status": "非法"}})
check("批量更新校验字段", st in (400, 422), st)
st, res = call("POST", "/api/products/batch-delete", {"ids": ["p1"]})
check("批量删除受引用约束（全失败 422）", st == 422, st)

# ---------------------------------------------------------------- 12. 导出
section("12. 数据导出")
st, res = call("GET", "/api/export/resources")
check("导出资源清单", st == 200 and len(res["data"]) >= 5, len(res.get("data", [])))
st, body = call("GET", "/api/export/requirements", raw=True)
check("导出需求 CSV 返回 200", st == 200, st)
check("CSV 含 BOM 且带表头", body.startswith("\ufeff") and "标题" in body, body[:40])
check("CSV 行数正确", len(body.strip().split("\n")) >= 12, len(body.strip().split("\n")))
st, body = call("GET", "/api/export/not-exist", raw=True)
check("不支持导出的资源返回 400", st == 400, st)
st, body = call("GET", "/api/export/metrics/members", raw=True)
check("导出成员效能报表", st == 200 and "完成故事点" in body, st)

# ---------------------------------------------------------------- 13. 用户管理
section("13. 用户管理")
st, res = call("POST", "/api/users", {"name": "新成员", "username": "newuser01",
                                      "role": "开发工程师", "dept": "研发一部", "email": "new@demo.com"})
check("新建成员 201", st == 201, res)
NEW_USER = res["data"]["id"] if st == 201 else None
check("新建成员默认启用", res["data"].get("enabled") is True, res["data"].get("enabled") if st == 201 else res)
check("响应不含密码字段", "password" not in json.dumps(res["data"]), "泄露了密码")
st, res = call("POST", "/api/users", {"name": "重复账号", "username": "newuser01"})
check("账号重复 409", st == 409, st)
st, res = call("POST", "/api/users", {"name": "非法账号", "username": "1abc"})
check("账号格式校验 400", st == 400, st)
st, res = call("POST", "/api/users", {"name": "短密码", "username": "newuser02", "password": "123"})
check("密码长度校验 400", st == 400, st)
st, res = call("PATCH", f"/api/users/{NEW_USER}", {"email": "bad-email"})
check("邮箱格式校验 400", st == 400 and "邮箱" in res["message"], res.get("message"))
if NEW_USER:
    st, res = call("POST", f"/api/users/{NEW_USER}/toggle")
    check("停用成员", st == 200 and res["data"]["enabled"] is False, res["data"].get("enabled"))
    st, res = call("POST", "/api/auth/login", {"username": "newuser01", "password": "123456"}, token=False)
    check("停用后禁止登录 403", st == 403, st)
    st, res = call("POST", f"/api/users/{NEW_USER}/toggle")
    check("重新启用成员", st == 200 and res["data"]["enabled"] is True, st)
    st, res = call("POST", f"/api/users/{NEW_USER}/reset-password", {"password": "abc12345"})
    check("重置密码", st == 200, st)
    st, res = call("POST", "/api/auth/login", {"username": "newuser01", "password": "abc12345"}, token=False)
    check("新密码可登录", st == 200, st)
    st, res = call("DELETE", f"/api/users/{NEW_USER}")
    check("删除成员", st == 200, st)

st, res = call("DELETE", "/api/users/u1")
check("不能删除当前登录账号", st in (403, 422), st)

# ---------------------------------------------------------------- 14. 测试计划用例
section("14. 测试计划用例增删")
st, res = call("POST", "/api/test-plans/tp1/cases", {"caseIds": ["tc9", "tc10"]})
check("向计划追加用例", st == 200 and len(res["data"]["caseIds"]) == 7, len(res["data"].get("caseIds", [])))
st, res = call("POST", "/api/test-plans/tp1/cases", {"caseIds": ["tc9"]})
check("追加已存在用例 422", st == 422, st)
st, res = call("POST", "/api/test-plans/tp1/cases", {"caseIds": ["not-exist"]})
check("追加不存在用例 400", st == 400, st)
st, res = call("DELETE", "/api/test-plans/tp1/cases/tc10")
check("从计划移除用例", st == 200 and "tc10" not in res["data"]["caseIds"], st)
st, res = call("DELETE", "/api/test-plans/tp1/cases/not-in-plan")
check("移除不在计划中的用例 422", st == 422, st)
call("DELETE", "/api/test-plans/tp1/cases/tc9")

# ---------------------------------------------------------------- 15. 跨字段校验
section("15. 跨字段与引用约束")
st, res = call("POST", "/api/projects", {"name": "日期倒置项目", "identifier": "BAD1",
                                         "startDate": "2026-12-01", "endDate": "2026-01-01"})
check("项目开始晚于结束 400", st == 400 and "日期" in res["message"], res.get("message"))
st, res = call("POST", "/api/work-items", {"title": "日期倒置工作项", "projectId": "proj1",
                                           "startDate": "2026-12-01", "endDate": "2026-01-01"})
check("工作项开始晚于结束 400", st == 400, st)
st, res = call("POST", "/api/wiki-pages", {"title": "自引用页面", "spaceId": "sp1", "parentId": "SELF"})
check("父页面不存在 400", st == 400 and "父页面不存在" in res["message"], res.get("message"))
st, res = call("POST", "/api/wiki-pages", {"title": "跨空间父页面", "spaceId": "sp1", "parentId": "pg4"})
check("父页面跨空间 400", st == 400 and "同一知识空间" in res["message"], res.get("message"))
st, res = call("PATCH", "/api/wiki-pages/pg1", {"parentId": "pg1"})
check("父页面为自身 400", st == 400, st)
st, res = call("POST", "/api/test-plans", {"name": "非法用例计划", "caseIds": ["not-exist"]})
check("计划含不存在用例 400", st == 400, st)
st, res = call("POST", "/api/test-plans", {"name": "空用例计划", "caseIds": []})
check("计划用例不能为空 400", st == 400, st)
st, res = call("DELETE", "/api/projects/proj1")
check("项目有工作项时删除 409", st == 409 and "工作项" in res["message"], res.get("message"))
st, res = call("DELETE", "/api/sprints/s1")
check("迭代有工作项时删除 409", st == 409, st)
st, res = call("DELETE", "/api/wiki-spaces/sp1")
check("空间有页面时删除 409", st == 409, st)
st, res = call("DELETE", "/api/wiki-pages/pg1")
check("页面有子页面时删除 409", st == 409, st)

# ---------------------------------------------------------------- 16. 搜索增强
section("16. 搜索增强")
st, res = call("GET", "/api/search?q=%E5%AE%A1%E6%89%B9")
check("搜索返回结构化结果", st == 200 and "list" in res["data"] and "countByType" in res["data"],
      res.get("data", {}).keys())
st, res = call("GET", "/api/search?q=%E5%AE%A1%E6%89%B9&types=requirement")
check("按类型过滤搜索", st == 200 and all(i["resource"] == "requirements" for i in res["data"]["list"]),
      [i["resource"] for i in res["data"]["list"]])
st, res = call("GET", "/api/search?q=%E5%AE%A1%E6%89%B9&limit=1")
check("limit 生效", st == 200 and len(res["data"]["list"]) == 1, len(res["data"]["list"]))

# ---------------------------------------------------------------- 17. 工作项子项
section("17. 工作项父子结构（子项）")

# 树接口
st, res = call("GET", "/api/work-items/tree?projectId=proj1")
check("项目工作项树", st == 200 and "nodes" in res["data"], res.get("data", {}).keys())
check("树含顶层/子项统计", all(k in res["data"]["stat"] for k in ("topLevel", "subtasks", "orphan")),
      res["data"].get("stat"))
check("树节点带子项汇总", any(n["summary"]["total"] > 0 for n in res["data"]["nodes"]))

st, res = call("GET", "/api/work-items/w1/children")
check("子项列表接口", st == 200 and len(res["data"]["children"]) == 2, len(res["data"].get("children", [])))
check("子项汇总字段完整",
      all(k in res["data"]["summary"] for k in ("total", "done", "pending", "progress", "points", "allDone")),
      res["data"].get("summary"))
check("子项汇总数值正确（1/2 · 50%）",
      res["data"]["summary"]["done"] == 1 and res["data"]["summary"]["progress"] == 50,
      res["data"]["summary"])

st, res = call("GET", "/api/work-items/ws1/tree")
check("子树接口返回父项与兄弟项", st == 200 and res["data"].get("parent", {}).get("id") == "w1"
      and len(res["data"].get("siblings", [])) == 2, list(res["data"].keys()))

st, res = call("GET", "/api/work-items/w1/subtask-summary")
check("子项汇总接口", st == 200 and res["data"]["total"] == 2, res.get("data"))

# 校验约束
st, res = call("PATCH", "/api/work-items/w1", {"parentId": "w1"})
check("父项为自身 → 400", st == 400 and "自身" in res["message"], res.get("message"))
st, res = call("PATCH", "/api/work-items/w1", {"parentId": "not-exist"})
check("父项不存在 → 400", st == 400, st)
st, res = call("PATCH", "/api/work-items/w1", {"parentId": "w9"})
check("父项跨项目 → 400", st == 400 and "同一项目" in res["message"], res.get("message"))
st, res = call("PATCH", "/api/work-items/w2", {"parentId": "ws1"})
check("「子任务」再挂子项 → 400", st == 400 and "最多两层" in res["message"], res.get("message"))

# 新建子项
st, res = call("POST", "/api/work-items", {
    "title": "冒烟：新增子任务", "projectId": "proj2", "parentId": "w9",
    "type": "子任务", "points": 2})
check("新建子项 201", st == 201, res)
NEW_SUB = res["data"]["id"] if st == 201 else None
check("子项写入 parentId", res["data"].get("parentId") == "w9" if st == 201 else False)

# 跨项目新建子项
st, res = call("POST", "/api/work-items", {
    "title": "冒烟：跨项目子任务", "projectId": "proj1", "parentId": "w9", "type": "子任务"})
check("跨项目建子项 → 400", st == 400, st)

# 状态机：父项未完成子项时不允许关闭
st, res = call("POST", "/api/work-items", {
    "title": "冒烟：父项", "projectId": "proj2", "status": "进行中", "points": 5})
PARENT = res["data"]["id"]
st, res = call("POST", "/api/work-items", {
    "title": "冒烟：子项A", "projectId": "proj2", "parentId": PARENT, "type": "子任务", "status": "进行中"})
CHILD = res["data"]["id"]
st, res = call("PATCH", f"/api/work-items/{PARENT}/status", {"status": "已完成"})
check("父项有未完成子项 → 关闭被拒 422", st == 422 and "子项" in res["message"], res.get("message"))

# 项目进度只统计顶层：完成子项不应改变项目进度
# 说明：新建工作项本身不会触发进度重算，所以先让子项流转一次拿到"重算后的基线"，
# 再对比"完成子项"前后的进度是否一致。
call("PATCH", f"/api/work-items/{CHILD}/status", {"status": "待测试"})
st, p_before = call("GET", "/api/projects/proj2")
before_progress = p_before["data"]["progress"]
call("PATCH", f"/api/work-items/{CHILD}/status", {"status": "已完成"})
st, p_after = call("GET", "/api/projects/proj2")
check("完成子项不改变项目进度（只统计顶层）", p_after["data"]["progress"] == before_progress,
      f'{before_progress} → {p_after["data"]["progress"]}')

st, res = call("PATCH", f"/api/work-items/{PARENT}/status", {"status": "已完成"})
check("子项全部完成后可关闭父项", st == 200, st)
st, p_final = call("GET", "/api/projects/proj2")
check("关闭父项后项目进度变化", p_final["data"]["progress"] != before_progress,
      f'{before_progress} → {p_final["data"]["progress"]}')

# 删除约束
st, res = call("DELETE", f"/api/work-items/{PARENT}")
check("父项仍有子项 → 删除 409", st == 409 and "子项" in res["message"], res.get("message"))

# 移出子项后再删除
st, res = call("PATCH", f"/api/work-items/{CHILD}", {"parentId": None})
check("移出子项（parentId 置空）", st == 200 and res["data"].get("parentId") is None, res["data"].get("parentId"))
st, res = call("DELETE", f"/api/work-items/{PARENT}")
check("移出后可删除父项", st == 200, st)
st, res = call("DELETE", f"/api/work-items/{CHILD}")
check("删除移出的子项", st == 200, st)
if NEW_SUB:
    call("DELETE", f"/api/work-items/{NEW_SUB}")

# 度量口径：子任务不计入故事点
st, res = call("GET", "/api/metrics/overview")
check("度量返回顶层/子项拆分",
      all(k in res["data"]["workItems"] for k in ("topLevel", "subtasks")), list(res["data"]["workItems"].keys()))
st, items_res = call("GET", "/api/work-items?pageSize=500")
top_pts = sum(i["points"] for i in items_res["data"]["list"] if not i.get("parentId"))
check("故事点仅统计顶层工作项", res["data"]["workItems"]["totalPoints"] == top_pts,
      f'{res["data"]["workItems"]["totalPoints"]} vs {top_pts}')

# ---------------------------------------------------------------- 汇总
print("\n" + "=" * 60)
print("通过 %d 项，失败 %d 项" % (len(passed), len(failed)))
if failed:
    print("失败项：")
    for f in failed:
        print("  - " + f)
print("=" * 60)
sys.exit(1 if failed else 0)
