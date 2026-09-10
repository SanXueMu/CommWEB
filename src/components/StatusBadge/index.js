import { jsx as _jsx } from "react/jsx-runtime";
/** 状态徽章：value → label + color，目录驱动（CommAND /api/meta/statuses）。 */
import { Tag } from 'antd';
import { useStatusCatalog } from '@/config/useStatusCatalog';
import { STATUS_GROUP_COLORS, STATUS_COLOR_OVERRIDES } from '@/theme/tokens';
export function StatusBadge({ value, style }) {
    const { byValue } = useStatusCatalog();
    const entry = byValue.get(value);
    const color = STATUS_COLOR_OVERRIDES[value] ??
        STATUS_GROUP_COLORS[entry?.group ?? ''] ??
        '#8c8c8c';
    return (_jsx(Tag, { color: color, style: { marginRight: 0, ...style }, children: entry?.label ?? value }));
}
