import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from 'react';
import { mergedViewProps } from '@/transfer/siteManifest';
/** 视图 props 上下文：站点声明（+用户偏好合并）注入通用视图组件（纯壳准则，2026-09-10）。
 *  CommWEB 组件只读声明，不持业务。 */
const ViewPropsContext = createContext({});
export function ViewScope({ decl, pid, children }) {
    return _jsx(ViewPropsContext.Provider, { value: mergedViewProps(decl, pid), children: children });
}
export function useViewProps() {
    return useContext(ViewPropsContext);
}
