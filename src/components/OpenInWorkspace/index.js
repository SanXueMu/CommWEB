import { jsx as _jsx } from "react/jsx-runtime";
/** 「在工作区打开」入口按钮：打开（或追加）一个工作区标签页。 */
import { FolderOpenOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceSelector } from '@/workspace/store';
import { useActivePid } from '@/transfer/context';
export function OpenInWorkspace({ kind, refId, title, providerId, size = 'small' }) {
    const openTab = useWorkspaceSelector((s) => s.openTab);
    const activePid = useActivePid();
    const pid = providerId ?? activePid;
    const navigate = useNavigate();
    return (_jsx(Tooltip, { title: "\u5728\u5DE5\u4F5C\u533A\u6253\u5F00\uFF08\u53EF\u591A\u5F00\u4E92\u4E0D\u5E72\u6270\uFF09", children: _jsx(Button, { size: size, icon: _jsx(FolderOpenOutlined, {}), onClick: (e) => {
                e.stopPropagation();
                openTab({ kind, refId, title, providerId: pid });
                navigate('/workspace');
            } }) }));
}
