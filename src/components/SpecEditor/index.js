import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** SpecEditor：JSON 结构化编辑器（轻实现）——ViewSpec/TaskSpec 编辑，实时 parse 校验。
 *  纯壳准则：内置视图名等快选项由声明 props 注入，本组件零业务知识。 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Input, Space, Tag, Typography } from 'antd';
export function SpecEditor({ value, onChange, rows = 10, builtinViews = [], specLabel }) {
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!value.trim()) {
            setError(null);
            return;
        }
        try {
            JSON.parse(value);
            setError(null);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [value]);
    const status = useMemo(() => {
        if (error)
            return _jsx(Tag, { color: "orange", children: "JSON \u65E0\u6548" });
        if (value.trim())
            return _jsx(Tag, { color: "green", children: "JSON \u6709\u6548" });
        return _jsx(Tag, { children: "\u7A7A" });
    }, [error, value]);
    return (_jsxs(Space, { direction: "vertical", size: 8, style: { width: '100%' }, children: [_jsxs(Space, { size: 8, wrap: true, children: [status, builtinViews.length > 0 && (_jsxs(_Fragment, { children: [_jsxs(Typography.Text, { type: "secondary", style: { fontSize: 12 }, children: [specLabel ?? '快选', "\uFF1A"] }), builtinViews.map((name) => (_jsx(Tag, { style: { cursor: 'pointer' }, onClick: () => onChange(JSON.stringify(name)), children: name }, name)))] }))] }), _jsx(Input.TextArea, { value: value, onChange: (e) => onChange(e.target.value), rows: rows, placeholder: '\u8F93\u5165 JSON\uFF08\u5BF9\u8C61/\u6570\u7EC4\uFF09\uFF0C\u6216\u70B9\u51FB\u4E0A\u65B9\u5FEB\u9009', style: { fontFamily: 'monospace', fontSize: 12 } }), error && _jsx(Alert, { type: "warning", showIcon: true, message: error })] }));
}
