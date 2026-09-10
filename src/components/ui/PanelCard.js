import { jsx as _jsx } from "react/jsx-runtime";
export function PanelCard({ children, onClick, style, }) {
    return (_jsx("div", { onClick: onClick, style: {
            border: '1px solid #ececec',
            borderRadius: 10,
            padding: 16,
            height: '100%',
            background: '#fff',
            transition: 'box-shadow .2s',
            cursor: onClick ? 'pointer' : 'default',
            ...style,
        }, onMouseEnter: (e) => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'), onMouseLeave: (e) => (e.currentTarget.style.boxShadow = 'none'), children: children }));
}
