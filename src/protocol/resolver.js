/** ToolFace resolver：input_schema + [ui] 声明 → 表单字段模型。纯函数，可单测。 */
import { inferWidget, isWidgetKind } from './widgets';
function toOptions(values) {
    if (!values)
        return undefined;
    return values.map((v) => ({ label: String(v), value: v }));
}
function flatten(properties, required, prefix) {
    const fields = [];
    for (const [key, schema] of Object.entries(properties)) {
        const name = prefix ? `${prefix}.${key}` : key;
        if (schema.type === 'object' && schema.properties) {
            fields.push(...flatten(schema.properties, schema.required ?? [], name));
        }
        else {
            fields.push({ name, schema, required: required.includes(key) });
        }
    }
    return fields;
}
/** 解析：推导默认 widget → [ui] 覆盖 label/help/placeholder/widget → order 排序。 */
export function resolveForm(inputSchema, ui, inputTypes) {
    const schema = inputSchema;
    const properties = schema.properties ?? {};
    const required = schema.required ?? [];
    const hasFileInput = (inputTypes ?? []).some((t) => t.startsWith('file.'));
    let fields = flatten(properties, required, '').map(({ name, schema, required }) => {
        const override = ui?.field?.[name];
        const widget = override?.widget && isWidgetKind(override.widget)
            ? override.widget
            : inferWidget(schema);
        return {
            name,
            label: override?.label ?? name,
            widget,
            required,
            help: override?.help ?? schema.description,
            placeholder: override?.placeholder
                ?? (hasFileInput && widget === 'input' ? '本地路径（绝对路径）' : undefined),
            options: widget === 'select' ? toOptions(schema.enum)
                : widget === 'multiSelect' ? toOptions(schema.items?.enum)
                    : undefined,
            defaultValue: schema.default,
            isFilePath: hasFileInput && widget === 'input',
        };
    });
    if (ui?.order) {
        const rank = new Map(ui.order.map((name, i) => [name, i]));
        fields = [...fields].sort((a, b) => (rank.get(a.name) ?? ui.order.length) - (rank.get(b.name) ?? ui.order.length));
    }
    return fields;
}
/** Transfer 记忆接入：schema-hash 缓存的表单推导（命中 0ms，变更精准失效=热部署）。 */
import { TranslationMemory, contentHash } from '@/transfer/memory';
const formMemory = new TranslationMemory('resolveForm');
export function cachedResolveForm(inputSchema, ui, inputTypes) {
    return formMemory.remember(contentHash([inputSchema, ui ?? {}, inputTypes]), () => resolveForm(inputSchema, ui, inputTypes));
}
