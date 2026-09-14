import { describe, expect, it } from 'vitest'
import {
  deleteRunOptions, deleteRunParams, optionByValue, type DeleteRunLabels,
} from './confirm'

const LABELS: DeleteRunLabels = {
  keep: '删除任务，保留文件',
  keepDesc: '任务记录消失，服务器上的产物文件保留',
  purge: '删除任务，并删除产物文件',
  purgeDesc: '连同该任务的产物（含中间结果）一起清除，不可恢复',
}

describe('confirm 协议层', () => {
  it('删除任务选项：keep 在前、purge 标危险且不丢说明', () => {
    const options = deleteRunOptions(LABELS)
    expect(options.map((o) => o.value)).toEqual(['keep', 'purge'])
    expect(options[0].danger).toBeFalsy()
    expect(options[1].danger).toBe(true)
    for (const o of options) expect(o.description).toBeTruthy()
  })

  it('返回值 → 请求参数：purge 传 true、keep 传 false、取消不产生请求', () => {
    expect(deleteRunParams('purge')).toEqual({ purgeFiles: true })
    expect(deleteRunParams('keep')).toEqual({ purgeFiles: false })
    expect(deleteRunParams(null)).toBeNull()
  })

  it('optionByValue 可按返回值回查选项', () => {
    const options = deleteRunOptions(LABELS)
    expect(optionByValue(options, 'purge')?.label).toBe(LABELS.purge)
    expect(optionByValue(options, 'keep')?.label).toBe(LABELS.keep)
  })
})
