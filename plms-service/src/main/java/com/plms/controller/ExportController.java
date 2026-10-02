package com.plms.controller;

import com.plms.common.ApiException;
import com.plms.common.PageResult;
import com.plms.common.R;
import com.plms.entity.User;
import com.plms.service.CrudService;
import com.plms.service.DomainService;
import com.plms.support.Schemas;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;

/**
 * 数据导出接口：把列表数据导出为 CSV（带 UTF-8 BOM，Excel 直接打开不乱码）。
 */
@RestController
@RequestMapping("/api/export")
public class ExportController {

    /** 允许导出的资源 */
    private static final Map<String, String> EXPORTABLE = Map.of(
            "requirements", "需求清单",
            "work-items", "工作项清单",
            "test-cases", "测试用例清单",
            "users", "成员清单",
            "projects", "项目清单",
            "activities", "活动日志"
    );

    private final CrudService crud;
    private final DomainService domainService;

    public ExportController(CrudService crud, DomainService domainService) {
        this.crud = crud;
        this.domainService = domainService;
    }

    /** 支持导出的资源清单 */
    @GetMapping("/resources")
    public R<List<Map<String, String>>> resources() {
        List<Map<String, String>> list = new ArrayList<>();
        EXPORTABLE.forEach((k, v) -> {
            Map<String, String> m = new LinkedHashMap<>();
            m.put("resource", k);
            m.put("label", v);
            list.add(m);
        });
        return R.ok(list);
    }

    /**
     * 导出资源为 CSV，支持与列表接口相同的筛选参数（如 ?status=已完成）。
     */
    @GetMapping("/{resource}")
    public ResponseEntity<byte[]> export(@PathVariable String resource,
                                         @RequestParam Map<String, String> params) {
        if (!EXPORTABLE.containsKey(resource)) {
            throw ApiException.badRequest("不支持导出该资源：" + resource
                    + "，可选：" + String.join(" / ", EXPORTABLE.keySet()));
        }

        if ("members".equals(params.get("view"))) {
            return csv("效能报表-成员", memberHeaders(), memberRows());
        }

        Map<String, String> query = new LinkedHashMap<>(params);
        query.remove("view");
        query.put("page", "1");
        query.put("pageSize", "500");

        PageResult<Object> page = crud.list(resource, query);
        List<String> headers = headersOf(resource);
        List<List<String>> rows = new ArrayList<>();
        for (Object o : page.getList()) rows.add(rowOf(resource, o));

        return csv(EXPORTABLE.get(resource), headers, rows);
    }

    /** 成员效能报表（特殊视图，走聚合逻辑而非原始表） */
    @GetMapping("/metrics/members")
    public ResponseEntity<byte[]> exportMembers() {
        return csv("效能报表-成员", memberHeaders(), memberRows());
    }

    /* ==================== 内部 ==================== */

    private List<String> memberHeaders() {
        return List.of("姓名", "部门", "角色", "工作项总数", "已完成", "完成故事点");
    }

    private List<List<String>> memberRows() {
        List<List<String>> rows = new ArrayList<>();
        for (Map<String, Object> m : domainService.metricsMembers()) {
            User u = (User) m.get("user");
            rows.add(List.of(
                    nz(u.getName()), nz(u.getDept()), nz(u.getRole()),
                    String.valueOf(m.get("total")), String.valueOf(m.get("done")), String.valueOf(m.get("points"))));
        }
        return rows;
    }

    /** 表头：直接用校验规则表里的字段（保证与接口字段一致） */
    private List<String> headersOf(String resource) {
        List<String> headers = new ArrayList<>();
        if (Schemas.rules(resource) == null) return headers;
        Schemas.rules(resource).forEach(r -> headers.add(r.label()));
        headers.add("创建时间");
        return headers;
    }

    private List<String> rowOf(String resource, Object o) {
        List<String> row = new ArrayList<>();
        for (Schemas.Rule r : Schemas.rules(resource)) {
            Object v = CrudService.readValue(o, r.field());
            if (v instanceof List<?> list) row.add(String.join(" / ", list.stream().map(String::valueOf).toList()));
            else if (v instanceof Boolean b) row.add(b ? "是" : "否");
            else row.add(nz(v));
        }
        row.add(nz(CrudService.readValue(o, "createdAt")));
        return row;
    }

    private ResponseEntity<byte[]> csv(String name, List<String> headers, List<List<String>> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append('\ufeff');                     // UTF-8 BOM
        sb.append(String.join(",", headers.stream().map(this::esc).toList())).append("\r\n");
        for (List<String> row : rows) {
            sb.append(String.join(",", row.stream().map(this::esc).toList())).append("\r\n");
        }
        byte[] bytes = sb.toString().getBytes(StandardCharsets.UTF_8);

        String filename = name + "-" + LocalDate.now() + ".csv";
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");

        HttpHeaders h = new HttpHeaders();
        h.setContentType(new MediaType("text", "csv", StandardCharsets.UTF_8));
        h.set(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + filename + "\"; filename*=UTF-8''" + encoded);
        h.setContentLength(bytes.length);
        return new ResponseEntity<>(bytes, h, org.springframework.http.HttpStatus.OK);
    }

    /** CSV 转义：含逗号/引号/换行的值加引号并转义内部引号 */
    private String esc(String v) {
        String s = v == null ? "" : v;
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    private String nz(Object o) {
        if (o == null) return "";
        String s = String.valueOf(o);
        return s.length() > 500 ? s.substring(0, 500) + "…" : s;
    }
}
