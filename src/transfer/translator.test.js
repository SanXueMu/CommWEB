import { describe, expect, it } from 'vitest';
import { normalizePipeline, normalizeStatuses, normalizeTask, normalizeToolDetail, normalizeToolSummary } from './translator';
describe('transfer translator（翻译数据：归一 + 溯源）', () => {
    it('工具摘要：tags 缺省补 []，注入 providerId', () => {
        const out = normalizeToolSummary({ id: 'x', name: 'X' }, 'cmd41');
        expect(out.tags).toEqual([]);
        expect(out.providerId).toBe('cmd41');
    });
    it('工具详情：manifest 三段与 doc_md 容错', () => {
        const raw = {
            id: 't',
            name: 'T',
            manifest: {
                tool: { id: 't', name: 'T', version: '1' },
                io: { input_schema: {}, output_schema: {}, input_types: [], output_types: [] },
                runtime: null,
                resources: undefined,
            },
        };
        const out = normalizeToolDetail(raw, 'default');
        expect(out.manifest.doc_md).toBeNull();
        expect(out.manifest.runtime).toEqual({});
        expect(out.manifest.resources).toEqual({});
        expect(out.manifest.ui).toEqual({});
        expect(out.providerId).toBe('default');
    });
    it('任务：error 缺省 null + 溯源', () => {
        const out = normalizeTask({ handle: 'h', status: 'queued' }, 'p1');
        expect(out.error).toBeNull();
        expect(out.providerId).toBe('p1');
    });
    it('状态目录：非数组保底空、字段补全', () => {
        const out = normalizeStatuses([{ value: 'paused' }]);
        expect(out).toEqual([{ value: 'paused', label: 'paused', group: 'other', terminal: false }]);
        expect(normalizeStatuses(null)).toEqual([]);
    });
    it('流摘要：steps 缺省 []，doc_md null 化', () => {
        const out = normalizePipeline({ id: 'f', name: 'F' }, 'p2');
        expect(out.steps).toEqual([]);
        expect(out.doc_md).toBeNull();
        expect(out.providerId).toBe('p2');
    });
});
