import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** 阅读卡片弹窗：纯渲染 cards props，内容来自 config（组件零文案）。 */
import { BookOutlined } from '@ant-design/icons';
import { Button, Card, Modal, Space, Typography } from 'antd';
import { useState } from 'react';
export function HelpCardModal({ cards, title = '阅读卡片' }) {
    const [open, setOpen] = useState(false);
    return (_jsxs(_Fragment, { children: [_jsx(Button, { type: "text", icon: _jsx(BookOutlined, {}), onClick: () => setOpen(true), title: title }), _jsx(Modal, { open: open, onCancel: () => setOpen(false), footer: null, width: 680, title: title, children: _jsx(Space, { direction: "vertical", size: 12, style: { width: '100%', paddingTop: 8 }, children: cards.map((card) => (_jsxs(Card, { size: "small", style: { border: '1px solid #f0f0f0' }, children: [_jsx(Typography.Text, { strong: true, children: card.title }), _jsx(Typography.Paragraph, { type: "secondary", style: { marginBottom: 0, marginTop: 4 }, children: card.body })] }, card.title))) }) })] }));
}
