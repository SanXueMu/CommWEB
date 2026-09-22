import { cloneElement, createContext, useContext, useEffect, useId, useMemo, useReducer, useState, type FormEvent, type ReactElement, type ReactNode } from 'react'

type FieldName = string | string[]

export interface FormInstance<T extends Record<string, unknown> = Record<string, unknown>> {
  getFieldsValue: () => T
  resetFields: () => void
  setFieldsValue: (values: Partial<T>) => void
  submit: () => void
  validateFields: () => Promise<T>
  _submit: () => void
  _subscribe: (listener: () => void) => () => void
  _setField: (name: FieldName, value: unknown) => void
  _getField: (name: FieldName) => unknown
}

function keyOf(name: FieldName) {
  return Array.isArray(name) ? name.join('.') : name
}

function createForm<T extends Record<string, unknown>>(): FormInstance<T> {
  let values = {} as T
  let submitHandler: (() => void) | undefined
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())
  return {
    getFieldsValue: () => values,
    resetFields: () => { values = {} as T; notify() },
    setFieldsValue: (next) => { values = { ...values, ...next }; notify() },
    submit: () => submitHandler?.(),
    validateFields: async () => values,
    _submit: () => submitHandler?.(),
    _subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    _setField: (name, value) => { values = { ...values, [keyOf(name)]: value } as T; notify() },
    _getField: (name) => values[keyOf(name) as keyof T],
    get _submitHandler() { return submitHandler },
    set _submitHandler(handler: (() => void) | undefined) { submitHandler = handler },
  } as FormInstance<T> & { _submitHandler?: (() => void) | undefined }
}

interface FormContextValue {
  form: FormInstance
  setSubmitHandler: (handler: () => void) => void
}

const FormContext = createContext<FormContextValue | null>(null)

export function useForm<T extends Record<string, unknown> = Record<string, unknown>>() {
  const [form] = useState(() => createForm<T>())
  return [form] as const
}

export function useFormInstance<T extends Record<string, unknown> = Record<string, unknown>>() {
  const context = useContext(FormContext)
  if (!context) throw new Error('useFormInstance 必须在 Form 内使用')
  return context.form as FormInstance<T>
}

export function useWatch(name: FieldName, form: FormInstance = useFormInstance()) {
  const [, refresh] = useReducer((value) => value + 1, 0)
  useEffect(() => form._subscribe(refresh), [form])
  return form._getField(name)
}

export function Form({ form: externalForm, onFinish, children, style }: {
  form?: FormInstance
  onFinish?: (values: Record<string, unknown>) => void | Promise<void>
  children: ReactNode
  style?: React.CSSProperties
  layout?: 'vertical' | 'horizontal'
}) {
  const [internalForm] = useForm()
  const form = externalForm ?? internalForm
  const context = useMemo<FormContextValue>(() => ({
    form,
    setSubmitHandler: (handler) => { (form as FormInstance & { _submitHandler?: () => void })._submitHandler = handler },
  }), [form])
  const submit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    void onFinish?.(form.getFieldsValue())
  }
  context.setSubmitHandler(() => submit())
  return <FormContext.Provider value={context}><form onSubmit={submit} style={style}>{children}</form></FormContext.Provider>
}

Form.Item = function FormItem({ name, label, help, extra, initialValue, children, valuePropName }: {
  name?: FieldName
  label?: ReactNode
  help?: ReactNode
  extra?: ReactNode
  initialValue?: unknown
  rules?: unknown
  valuePropName?: string
  children: ReactElement
}) {
  const form = useFormInstance()
  const generatedId = useId()
  const fieldKey = name ? keyOf(name) : generatedId
  const [, refresh] = useReducer((value) => value + 1, 0)
  useEffect(() => form._subscribe(refresh), [form])
  useEffect(() => {
    if (name && form._getField(name) === undefined && initialValue !== undefined) form._setField(name, initialValue)
  }, [form, initialValue, name])
  const current = name ? form._getField(name) : undefined
  const child = children.props as Record<string, unknown>
  const valueProp = valuePropName ?? (child.type === 'checkbox' ? 'checked' : 'value')
  const control = name ? {
    [valueProp]: valueProp === 'checked' ? Boolean(current) : current ?? '',
    onChange: (eventOrValue: unknown) => {
      const event = eventOrValue as { target?: { checked?: boolean; value?: unknown } }
      form._setField(name, valueProp === 'checked' ? event.target?.checked : event.target?.value ?? eventOrValue)
    },
  } : {}
  return <div key={fieldKey} style={{ marginBottom: 16 }}>
    {label && <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</label>}
    {Object.keys(control).length ? cloneElement(children, control) : children}
    {help && <div style={{ color: 'var(--cw-danger)', fontSize: 12, marginTop: 4 }}>{help}</div>}
    {extra && <div style={{ color: 'var(--cw-text-secondary)', fontSize: 12, marginTop: 4 }}>{extra}</div>}
  </div>
}

export const FormApi = Form
