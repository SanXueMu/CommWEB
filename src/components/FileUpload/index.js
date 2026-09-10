import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 通用上传组件：POST /api/files → 返回服务端路径，受控用法 value/onChange。 */
import { InboxOutlined } from '@ant-design/icons';
import { Typography, Upload, message } from 'antd';
import { api } from '@/api/client';
export function FileUpload({ value, onChange, accept, }) {
    return (_jsxs("div", { children: [_jsxs(Upload.Dragger, { accept: accept, showUploadList: false, customRequest: async ({ file, onSuccess, onError }) => {
                    try {
                        const result = await api.uploadFile(file);
                        onChange?.(result.path);
                        message.success(`已上传：${result.name}`);
                        onSuccess?.(result);
                    }
                    catch (error) {
                        message.error(`上传失败：${error.message}`);
                        onError?.(error);
                    }
                }, style: { background: '#fafafa' }, children: [_jsx("p", { style: { margin: '12px 0 4px' }, children: _jsx(InboxOutlined, { style: { fontSize: 28, color: '#202753' } }) }), _jsx(Typography.Text, { type: "secondary", style: { fontSize: 13 }, children: "\u70B9\u51FB\u6216\u62D6\u62FD\u6587\u4EF6\u4E0A\u4F20\uFF08\u2264200MB\uFF0C\u4E0A\u4F20\u540E\u5F97\u5230\u670D\u52A1\u7AEF\u8DEF\u5F84\uFF09" })] }), value && (_jsx(Typography.Text, { code: true, style: { display: 'block', marginTop: 6, fontSize: 12 }, children: value }))] }));
}
