import { z } from 'zod'

export const messageConfigSchema = z.object({
  text: z.string().min(1, 'Текст сообщения обязателен'),
  media_url: z.string().url('Некорректный URL').optional().or(z.literal('')),
})

export const questionConfigSchema = z.object({
  prompt: z.string().min(1, 'Вопрос обязателен'),
  var_name: z
    .string()
    .min(1, 'Имя переменной обязательно')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Только латиница, цифры и _'),
  validation: z.enum(['any', 'number', 'phone', 'email']).optional(),
})

export const menuButtonSchema = z.object({
  text: z.string().min(1, 'Текст кнопки обязателен'),
  callback: z
    .string()
    .min(1, 'Callback обязателен')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Только латиница, цифры, _ и -'),
})

export const menuConfigSchema = z.object({
  text: z.string().min(1, 'Текст меню обязателен'),
  buttons: z.array(menuButtonSchema).min(1, 'Добавьте хотя бы одну кнопку'),
})

export const actionConfigSchema = z.object({
  url: z.string().url('Некорректный URL'),
  method: z.enum(['GET', 'POST']),
  body_template: z.record(z.string(), z.unknown()).optional(),
  result_mapping: z.record(z.string(), z.string()),
})

export const subscenarioConfigSchema = z.object({
  scenario_id: z.number().int().positive('Выберите сценарий'),
  return_node_key: z.string().optional(),
})

export const delayConfigSchema = z.object({
  seconds: z.number().int().min(1, 'Минимум 1 секунда').max(86400, 'Максимум 24 часа'),
})

export const conditionRuleSchema = z.object({
  condition_expr: z.string().min(1, 'Выражение обязательно'),
  priority: z.number().int().min(0),
})

export function getDefaultConfig(type: string): Record<string, unknown> {
  switch (type) {
    case 'message':
      return { text: '' }
    case 'question':
      return { prompt: '', var_name: '', validation: 'any' }
    case 'menu':
      return { text: '', buttons: [{ text: 'Кнопка 1', callback: 'btn_1' }] }
    case 'condition':
      return {}
    case 'action':
      return { url: '', method: 'GET', result_mapping: {} }
    case 'subscenario':
      return { scenario_id: 0 }
    case 'delay':
      return { seconds: 5 }
    default:
      return {}
  }
}

export function getConfigSchema(type: string) {
  switch (type) {
    case 'message':
      return messageConfigSchema
    case 'question':
      return questionConfigSchema
    case 'menu':
      return menuConfigSchema
    case 'action':
      return actionConfigSchema
    case 'subscenario':
      return subscenarioConfigSchema
    case 'delay':
      return delayConfigSchema
    default:
      return z.object({})
  }
}
