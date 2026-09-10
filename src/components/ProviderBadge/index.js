import { jsx as _jsx } from "react/jsx-runtime";
/** 会员来源徽章：色点 + 名称（色按 pid 内容哈希取色板，稳定）。 */
import { Tag } from 'antd';
import { contentHash } from '@/transfer/memory';
const PALETTE = ['#202753', '#0F6E56', '#D85A30', '#722ED1', '#1677FF', '#C41D7F', '#AD6800', '#237804'];
export function providerColor(pid) {
    const hash = Number.parseInt(contentHash(pid), 36);
    return PALETTE[hash % PALETTE.length];
}
export function ProviderBadge({ pid, name }) {
    if (!pid || pid === 'default')
        return null;
    const color = providerColor(pid);
    return (_jsx(Tag, { style: { marginInlineEnd: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px', color, borderColor: color, background: 'transparent' }, title: `会员：${name ?? pid}`, children: (name ?? pid).slice(0, 6) }));
}
