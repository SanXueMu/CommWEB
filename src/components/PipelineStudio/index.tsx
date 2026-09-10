/** PipelineStudio：'pipeline.studio' 通用视图——声明驱动的工作流集合页。
 *  纯壳准则：流 ID / save_as 组装规则全部来自声明 props；本组件零业务知识。
 *
 *  声明 props：
 *  {
 *    flow_ids?: string[]         // 显式清单，或
 *    flow_prefix?: string        // 按前缀拉取
 *    save_as?: SaveAsDecl        // 产物→管线 组装声明（lib/saveAsPipeline）
 *  }
 */

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Empty, Modal, Space, Tag, Typography } from 'antd'

import { apiFor } from '@/api/client'
import { useViewProps } from '@/protocol/ViewPropsContext'
import type { PipelineSummary } from '@/api/types'
import { useActivePid } from '@/transfer/context'
import { FlowRunner } from '@/components/FlowRunner'
import { ResultRenderer } from '@/components/ResultRenderer'
import { buildPipelineFromSaveAs, type SaveAsDecl } from '@/lib/saveAsPipeline'

export interface PipelineStudioProps {
  flow_ids?: string[]
  flow_prefix?: string
  save_as?: SaveAsDecl
}

const TERMINAL = ['succeeded', 'failed', 'cancelled']

export function PipelineStudio() {
  const viewProps = useViewProps() as unknown as PipelineStudioProps
  const props = viewProps
  const pid = useActivePid()
  const api = apiFor(pid)
  const [selected, setSelected] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [saveAs, setSaveAs] = useState<null | { error?: string; done?: string }>(null)

  const { data: flows = [] } = useQuery({
    queryKey: ['provider', pid, 'pipelines'],
    queryFn: () => api.listPipelines(),
    select: (d: { pipelines: PipelineSummary[] }) =>
      d.pipelines.filter((p) => (props.flow_ids ? props.flow_ids.includes(p.id) : props.flow_prefix ? p.id.startsWith(props.flow_prefix) : false)),
  })

  const { data: flow } = useQuery({
    queryKey: ['provider', pid, 'pipeline', selected],
    queryFn: () => api.getPipeline(selected!),
    enabled: !!selected,
  })

  const { data: runDetail } = useQuery({
    queryKey: ['provider', pid, 'pipeline-run', runId],
    queryFn: () => api.getPipelineRun(runId!),
    enabled: !!runId,
    refetchInterval: (q) => (TERMINAL.includes(q.state.data?.run.status ?? '') ? false : 2000),
  })

  useEffect(() => { setRunId(null) }, [selected])

  const finishedRun = useMemo(
    () => (runDetail && TERMINAL.includes(runDetail.run.status) ? runDetail : null),
    [runDetail],
  )

  async function handleSaveAs() {
    if (!props.save_as || !finishedRun) return
    const built = buildPipelineFromSaveAs(props.save_as, finishedRun.run.input ?? {}, lastOutput(finishedRun))
    if (!built) {
      setSaveAs({ error: '产物缺少必填内容或运行输入未填，无法组装管线' })
      return
    }
    try {
      await api.createPipeline(built)
      setSaveAs({ done: built.id })
    } catch (e) {
      setSaveAs({ error: e instanceof Error ? e.message : String(e) })
    }
  }

  const output = finishedRun ? lastOutput(finishedRun) : null

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space size={8} wrap>
        {flows.map((f) => (
          <Tag.CheckableTag key={f.id} checked={f.id === selected} onChange={() => setSelected(f.id)}>
            {f.name || f.id}
          </Tag.CheckableTag>
        ))}
      </Space>

      {flow ? (
        <Card size="small" title={flow.name || flow.id}>
          <FlowRunner flow={flow} runId={runId} onRunIdChange={setRunId} providerId={pid} />
        </Card>
      ) : (
        <Empty description="声明未匹配到任何流" />
      )}

      {finishedRun && finishedRun.run.status === 'succeeded' && output && (
        <Card size="small" title="运行产物">
          <ResultRenderer output={output} />
          {props.save_as && (
            <Button style={{ marginTop: 12 }} onClick={handleSaveAs}>
              {props.save_as.button_label ?? '另存为管线'}
            </Button>
          )}
        </Card>
      )}
      {finishedRun && finishedRun.run.status === 'failed' && (
        <Alert type="error" showIcon message={finishedRun.run.error?.message ?? '运行失败'} />
      )}

      <Modal open={!!saveAs?.error} onCancel={() => setSaveAs(null)} footer={null} title="另存失败">
        <Alert type="error" showIcon message={saveAs?.error} />
      </Modal>
      <Modal
        open={!!saveAs?.done}
        onCancel={() => setSaveAs(null)}
        footer={<Button type="primary" onClick={() => setSaveAs(null)}>好的</Button>}
        title="已保存"
      >
        <Typography.Text>管线已注册：{saveAs?.done}</Typography.Text>
      </Modal>
    </Space>
  )
}

function lastOutput(run: { tasks: { status: string; output: Record<string, unknown> | null }[] }): Record<string, unknown> {
  const done = run.tasks.filter((t) => t.status === 'succeeded')
  return (done[done.length - 1]?.output ?? {}) as Record<string, unknown>
}
