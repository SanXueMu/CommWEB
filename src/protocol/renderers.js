/** ToolFace 渲染器注册表：输出 JSON → 呈现形态（table / json / text）。纯函数。 */
export function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isArrayOfObjects(value) {
    return Array.isArray(value) && value.length > 0 && value.every(isPlainObject);
}
/** 深度探测提取表格：顶层对象数组，或对象内首个对象数组（一深度）。 */
export function extractTable(output) {
    let rows = null;
    if (isArrayOfObjects(output))
        rows = output;
    else if (isPlainObject(output)) {
        for (const value of Object.values(output)) {
            if (isArrayOfObjects(value)) {
                rows = value;
                break;
            }
        }
    }
    if (!rows)
        return null;
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return { columns, rows };
}
export function detectRenderer(output) {
    if (output == null)
        return 'json';
    if (typeof output === 'string')
        return 'text';
    if (Array.isArray(output) && output.every((v) => typeof v === 'string'))
        return 'text';
    if (extractTable(output))
        return 'table';
    return 'json';
}
/** 待审行判定（通用数据约定，不含业务字段名）：
 *  ① 任意键名以 `_flags` 结尾且值为非空数组；② 工具声明 highlight 字段命中且真值。 */
export function rowNeedsReview(row, highlight) {
    if (Object.entries(row).some(([key, value]) => key.endsWith('_flags') && Array.isArray(value) && value.length > 0)) {
        return true;
    }
    return (highlight ?? []).some((key) => Boolean(row[key]));
}
/** 纯文本提取：数组字符串逐行，字符串整体。 */
export function extractText(output) {
    if (Array.isArray(output))
        return output.map(String).join('\n');
    return String(output);
}
