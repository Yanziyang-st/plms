package com.plms.support;

import com.plms.common.ApiException;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 校验器：依据 {@link Schemas} 的规则对入参做字段级校验与清洗。
 * <ul>
 *   <li>白名单机制：只有规则表中声明的字段会被保留，防止越权字段写入（mass-assignment）</li>
 *   <li>readonly 字段由服务端生成，客户端传入一律忽略</li>
 *   <li>PATCH 场景传 {@code partial=true}，未传的字段不校验也不改动</li>
 * </ul>
 */
@Component
public class Validator {

    private final ResourceRegistry registry;

    public Validator(ResourceRegistry registry) {
        this.registry = registry;
    }

    public Map<String, Object> validate(String resource, Map<String, Object> input, boolean partial) {
        List<Schemas.Rule> rules = Schemas.rules(resource);
        if (rules == null) throw ApiException.badRequest("资源 " + resource + " 不支持写入");
        if (input == null) input = Collections.emptyMap();

        Map<String, Object> out = new LinkedHashMap<>();
        List<Map<String, String>> errors = new ArrayList<>();

        for (Schemas.Rule rule : rules) {
            if (rule.isReadonly()) continue;

            boolean present = input.containsKey(rule.field());
            Object value = present ? input.get(rule.field()) : null;

            if (isEmpty(value)) {
                if (partial) {
                    // 部分更新：未传 → 不改动
                    if (!present) continue;
                    // 显式传空值（null 或 ""）→ 视为「清空该字段」，用于解除关联关系
                    // （例如把 work-item.parentId 置空以移出子任务）
                    if (rule.isRequired()) {
                        errors.add(err(rule.field(), rule.label() + "不能为空"));
                        continue;
                    }
                    out.put(rule.field(), null);
                    continue;
                }
                if (rule.isRequired()) {
                    errors.add(err(rule.field(), rule.label() + "不能为空"));
                    continue;
                }
                if (rule.hasDef()) { out.put(rule.field(), rule.def()); continue; }
                out.put(rule.field(), null);
                continue;
            }

            String err = check(rule, value);
            if (err != null) { errors.add(err(rule.field(), err)); continue; }
            out.put(rule.field(), normalize(rule, value));
        }

        if (!errors.isEmpty()) {
            throw ApiException.badRequest(
                    "参数校验失败：" + errors.stream().map(e -> e.get("message")).reduce((a, b) -> a + "；" + b).orElse(""),
                    errors);
        }
        if (partial && out.isEmpty()) throw ApiException.badRequest("没有需要更新的字段");
        return out;
    }

    /* ==================== 内部 ==================== */

    private boolean isEmpty(Object v) {
        if (v == null) return true;
        if (v instanceof String) return ((String) v).trim().isEmpty();
        return false;
    }

    private String check(Schemas.Rule r, Object v) {
        String label = r.label();
        switch (r.type()) {
            case "string": {
                if (!(v instanceof String)) return label + "必须是字符串";
                String s = ((String) v).trim();
                if (r.min() != null && s.length() < r.min()) return label + "长度不能少于 " + r.min() + " 个字符";
                if (r.max() != null && s.length() > r.max()) return label + "长度不能超过 " + r.max() + " 个字符";
                if (r.pattern() != null && !r.pattern().matcher(s).matches())
                    return r.patternMsg() != null ? r.patternMsg() : (label + "格式不正确");
                return null;
            }
            case "int": {
                Long n = toLong(v);
                if (n == null) return label + "必须是整数";
                if (r.min() != null && n < r.min()) return label + "不能小于 " + r.min();
                if (r.max() != null && n > r.max()) return label + "不能大于 " + r.max();
                return null;
            }
            case "bool": {
                if (!(v instanceof Boolean)) return label + "必须是布尔值";
                return null;
            }
            case "enum": {
                if (!(v instanceof String) || !r.values().contains(v))
                    return label + "只能是：" + String.join(" / ", r.values());
                return null;
            }
            case "array": {
                if (!(v instanceof List)) return label + "必须是数组";
                int size = ((List<?>) v).size();
                if (r.minItems() != null && size < r.minItems()) return label + "至少需要 " + r.minItems() + " 项";
                if (r.maxItems() != null && size > r.maxItems()) return label + "最多 " + r.maxItems() + " 项";
                return null;
            }
            case "date": {
                if (!(v instanceof String)) return label + "必须是日期字符串";
                String s = (String) v;
                if (!s.matches("^\\d{4}-\\d{2}-\\d{2}.*")) return label + "格式应为 YYYY-MM-DD";
                try {
                    java.time.LocalDate.parse(s.length() > 10 ? s.substring(0, 10) : s);
                } catch (Exception e) {
                    return label + "不是有效日期";
                }
                return null;
            }
            case "ref": {
                if (!(v instanceof String) || ((String) v).trim().isEmpty()) return label + "必须是非空 ID";
                String id = ((String) v).trim();
                if (!registry.exists(r.ref())) return label + "引用的资源不存在";
                if (registry.mapper(r.ref()).selectById(id) == null)
                    return label + "对应的记录不存在（" + r.ref() + "#" + id + "）";
                return null;
            }
            default:
                return null;
        }
    }

    private Object normalize(Schemas.Rule r, Object v) {
        switch (r.type()) {
            case "string": return ((String) v).trim();
            case "int": return toLong(v).intValue();
            case "array": return new ArrayList<>((List<?>) v);
            case "date": {
                String s = (String) v;
                return s.length() > 10 ? s.substring(0, 10) : s;
            }
            default: return v;
        }
    }

    private Long toLong(Object v) {
        if (v instanceof Number) {
            double d = ((Number) v).doubleValue();
            if (d != Math.floor(d)) return null;
            return ((Number) v).longValue();
        }
        if (v instanceof String) {
            try { return Long.parseLong(((String) v).trim()); } catch (NumberFormatException e) { return null; }
        }
        return null;
    }

    private Map<String, String> err(String field, String message) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("field", field);
        m.put("message", message);
        return m;
    }
}
