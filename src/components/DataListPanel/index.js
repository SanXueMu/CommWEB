import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 通用列表面板：搜索栏（输入即检）+ 右侧动作区（含卡片/列表渲染切换）+ 双形态展示。
 * 工具库与任务中心共用——「货架—柜台」一致体验的落点。
 */
import { BarsOutlined, AppstoreOutlined, SearchOutlined } from '@ant-design/icons';
import { Col, Empty, Input, List, Row, Segmented, Spin } from 'antd';
import { getViewPrefs, setViewProp } from '@/transfer/preferences';
import { useEffect, useRef, useState } from 'react';
export function DataListPanel({ panelKey, providerId, items, loading, rowKey, onSearch, searchPlaceholder = '搜索…', extraActions, renderCard, renderRow, onItemClick, defaultView = 'card', emptyText = '暂无数据', }) {
    /** 布局偏好收编（蓝图03 §4.4）：有 providerId 时走 preferences（按会员隔离），否则回落旧 localStorage 键。 */
    const readLayout = () => {
        if (providerId) {
            const fromPrefs = getViewPrefs(providerId).viewProps[panelKey]?.defaultLayout;
            if (fromPrefs === 'card' || fromPrefs === 'list')
                return fromPrefs;
        }
        const legacy = localStorage.getItem(`commweb.view.${panelKey}`);
        return legacy ?? defaultView;
    };
    const [view, setView] = useState(() => readLayout());
    const [keyword, setKeyword] = useState('');
    const timer = useRef();
    useEffect(() => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => onSearch(keyword), 250);
        return () => window.clearTimeout(timer.current);
        // onSearch 由父组件闭包持有过滤逻辑，身份变化无需重置
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyword]);
    const switchView = (next) => {
        if (providerId)
            setViewProp(providerId, panelKey, 'defaultLayout', next);
        else
            localStorage.setItem(`commweb.view.${panelKey}`, next);
        setView(next);
    };
    return (_jsxs("div", { children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    paddingBottom: 12,
                    marginBottom: 16,
                    borderBottom: '1px solid #f0f0f0',
                }, children: [_jsx(Input, { allowClear: true, prefix: _jsx(SearchOutlined, { style: { color: '#bfbfbf' } }), placeholder: searchPlaceholder, value: keyword, onChange: (e) => setKeyword(e.target.value), style: { maxWidth: 320 } }), _jsx("div", { style: { flex: 1 } }), extraActions, _jsx(Segmented, { value: view, onChange: (v) => switchView(v), options: [
                            { value: 'card', icon: _jsx(AppstoreOutlined, {}), title: '卡片式' },
                            { value: 'list', icon: _jsx(BarsOutlined, {}), title: '列表式' },
                        ] })] }), loading ? (_jsx(Spin, { style: { display: 'block', margin: '60px auto' } })) : items.length === 0 ? (_jsx(Empty, { description: emptyText, style: { margin: '60px 0' } })) : view === 'card' ? (_jsx(Row, { gutter: [12, 12], children: items.map((item) => (_jsx(Col, { xs: 24, sm: 12, lg: 8, xl: 6, children: renderCard(item) }, rowKey(item)))) })) : (_jsx(List, { dataSource: items, renderItem: (item) => (_jsx("div", { className: "commweb-list-row", onClick: () => onItemClick?.(item), style: { cursor: onItemClick ? 'pointer' : 'default' }, children: renderRow(item) })) }))] }));
}
