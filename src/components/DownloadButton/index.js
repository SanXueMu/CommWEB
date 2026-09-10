import { jsx as _jsx } from "react/jsx-runtime";
/** DownloadButton：产物下载（GET /api/files/download，受控限 DATA_DIR 内）。 */
import { DownloadOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { apiFor } from '@/api/client';
import { useActivePid } from '@/transfer/context';
export function DownloadButton({ path, label, providerId }) {
    const pid = providerId ?? useActivePid();
    return (_jsx(Tooltip, { title: path, children: _jsx(Button, { size: "small", type: "primary", ghost: true, icon: _jsx(DownloadOutlined, {}), href: apiFor(pid).downloadUrl(path), target: "_blank", children: label ?? '下载' }) }));
}
