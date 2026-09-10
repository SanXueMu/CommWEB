import { describe, expect, it } from 'vitest';
import { resolveForm } from './resolver';
const schema = {
    type: 'object',
    required: ['segments'],
    properties: {
        segments: { type: 'array', items: { type: 'string' }, description: '待处理段落' },
        target_lang: { type: 'string', default: 'English' },
        mode: { type: 'string', enum: ['chapter', 'page', 'paragraph'] },
        retries: { type: 'integer', minimum: 0, maximum: 5 },
        verbose: { type: 'boolean' },
        long_text: { type: 'string', maxLength: 500 },
        nested: {
            type: 'object',
            properties: { inner: { type: 'string' }, depth: { type: 'number' } },
            required: ['inner'],
        },
    },
};
describe('resolveForm 推导', () => {
    const fields = resolveForm(schema);
    it('array + items.string → tags', () => {
        expect(fields.find((f) => f.name === 'segments')?.widget).toBe('tags');
    });
    it('enum → select 且带选项', () => {
        const mode = fields.find((f) => f.name === 'mode');
        expect(mode?.widget).toBe('select');
        expect(mode?.options).toHaveLength(3);
    });
    it('integer → number / boolean → switch / maxLength>200 → textarea', () => {
        expect(fields.find((f) => f.name === 'retries')?.widget).toBe('number');
        expect(fields.find((f) => f.name === 'verbose')?.widget).toBe('switch');
        expect(fields.find((f) => f.name === 'long_text')?.widget).toBe('textarea');
    });
    it('required 与 default 与 description 透传', () => {
        const seg = fields.find((f) => f.name === 'segments');
        expect(seg.required).toBe(true);
        expect(fields.find((f) => f.name === 'target_lang')?.defaultValue).toBe('English');
        expect(seg.help).toBe('待处理段落');
    });
    it('嵌套 object 递归平铺为前缀路径', () => {
        expect(fields.find((f) => f.name === 'nested.inner')?.widget).toBe('input');
        expect(fields.find((f) => f.name === 'nested.depth')?.widget).toBe('number');
        expect(fields.find((f) => f.name === 'nested.inner')?.required).toBe(true);
    });
});
describe('resolveForm UI 声明覆盖', () => {
    it('ui.field 覆盖 label 与 widget，order 排序', () => {
        const fields = resolveForm(schema, {
            order: ['mode', 'segments'],
            field: { mode: { label: '拆分粒度', widget: 'input' } },
        });
        expect(fields[0].name).toBe('mode');
        expect(fields[0].label).toBe('拆分粒度');
        expect(fields[0].widget).toBe('input');
        expect(fields[1].name).toBe('segments');
    });
});
