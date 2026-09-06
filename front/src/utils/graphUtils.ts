import type { Edge, Node } from '@xyflow/react'
import type {
  MenuConfig,
  ScenarioNode,
  Transition,
  NodeType,
} from '../types'

export const START_NODE_KEY = 'start'

export const NODE_TYPE_META: Record<
  NodeType,
  { label: string; color: string; bg: string; border: string }
> = {
  message: {
    label: 'Сообщение',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
  },
  question: {
    label: 'Вопрос',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-300',
  },
  menu: {
    label: 'Меню',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-300',
  },
  condition: {
    label: 'Условие',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
  },
  action: {
    label: 'Действие',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-300',
  },
  subscenario: {
    label: 'Подсценарий',
    color: 'text-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-300',
  },
  delay: {
    label: 'Задержка',
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    border: 'border-gray-300',
  },
}

export function getNodePreview(node: ScenarioNode): string {
  const config = node.config as Record<string, unknown>
  switch (node.type) {
    case 'message':
      return (config.text as string) || 'Пустое сообщение'
    case 'question':
      return (config.prompt as string) || 'Вопрос...'
    case 'menu':
      return (config.text as string) || 'Меню'
    case 'condition':
      return 'Ветвление по условиям'
    case 'action':
      return (config.url as string) || 'HTTP запрос'
    case 'subscenario':
      return `Сценарий #${config.scenario_id ?? '?'}`
    case 'delay':
      return `${config.seconds ?? 0} сек.`
    default:
      return node.key
  }
}

export function scenarioToFlow(
  nodes: ScenarioNode[],
  transitions: Transition[],
): { nodes: Node[]; edges: Edge[] } {
  const flowNodes: Node[] = nodes.map((n) => ({
    id: String(n.id),
    type: 'scenarioNode',
    position: n.position,
    data: {
      scenarioNode: n,
      isStart: n.key === START_NODE_KEY,
    },
  }))

  const edges: Edge[] = transitions.map((t) => {
    const sourceHandle = getSourceHandleId(t, nodes)
    return {
      id: String(t.id),
      source: String(t.from_node),
      target: String(t.to_node),
      sourceHandle,
      type: 'transitionEdge',
      data: { transition: t },
      label: getEdgeLabel(t),
    }
  })

  return { nodes: flowNodes, edges }
}

function getSourceHandleId(transition: Transition, nodes: ScenarioNode[]): string | undefined {
  const fromNode = nodes.find((n) => n.id === transition.from_node)
  if (!fromNode) return undefined

  if (fromNode.type === 'menu' && transition.trigger === 'callback' && transition.trigger_value) {
    return `callback-${transition.trigger_value}`
  }
  if (fromNode.type === 'condition') {
    if (transition.trigger === 'always') return 'always'
    if (transition.trigger === 'condition') return `condition-${transition.id}`
  }
  return undefined
}

function getEdgeLabel(transition: Transition): string {
  switch (transition.trigger) {
    case 'callback':
      return transition.trigger_value ?? 'callback'
    case 'text':
      return `/${transition.trigger_value}/`
    case 'condition':
      return transition.condition_expr ?? 'условие'
    case 'always':
      return 'иначе'
    default:
      return ''
  }
}

export function getMenuHandles(node: ScenarioNode): string[] {
  if (node.type !== 'menu') return []
  const config = node.config as MenuConfig
  return (config.buttons ?? []).map((b) => `callback-${b.callback}`)
}

export function getConditionHandles(
  node: ScenarioNode,
  transitions: Transition[],
): string[] {
  if (node.type !== 'condition') return []
  const outgoing = transitions.filter((t) => t.from_node === node.id)
  const handles = outgoing
    .filter((t) => t.trigger === 'condition')
    .map((t) => `condition-${t.id}`)
  if (outgoing.some((t) => t.trigger === 'always')) {
    handles.push('always')
  }
  return handles
}

export interface ValidationIssue {
  type: 'error' | 'warning'
  message: string
  nodeId?: number
}

export function validateScenarioForPublish(
  nodes: ScenarioNode[],
  transitions: Transition[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const startNode = nodes.find((n) => n.key === START_NODE_KEY)

  if (!startNode) {
    issues.push({ type: 'error', message: 'Отсутствует стартовый узел (key=start)' })
    return issues
  }

  const reachable = findReachableNodes(startNode.id, transitions)
  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      issues.push({
        type: 'error',
        message: `Узел «${node.key}» недостижим из start`,
        nodeId: node.id,
      })
    }
  }

  for (const node of nodes) {
    if (node.type === 'menu') {
      const config = node.config as MenuConfig
      const outgoing = transitions.filter((t) => t.from_node === node.id)
      for (const btn of config.buttons ?? []) {
        const hasTransition = outgoing.some(
          (t) => t.trigger === 'callback' && t.trigger_value === btn.callback,
        )
        if (!hasTransition) {
          issues.push({
            type: 'error',
            message: `Кнопка «${btn.text}» в «${node.key}» не имеет перехода`,
            nodeId: node.id,
          })
        }
      }
    }

    if (node.type === 'condition') {
      const outgoing = transitions.filter((t) => t.from_node === node.id)
      const hasAlways = outgoing.some((t) => t.trigger === 'always')
      if (!hasAlways) {
        issues.push({
          type: 'error',
          message: `Узел «${node.key}» не имеет fallback-перехода (trigger=always)`,
          nodeId: node.id,
        })
      }
    }
  }

  return issues
}

function findReachableNodes(startId: number, transitions: Transition[]): Set<number> {
  const reachable = new Set<number>()
  const queue = [startId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (reachable.has(current)) continue
    reachable.add(current)

    for (const t of transitions) {
      if (t.from_node === current && !reachable.has(t.to_node)) {
        queue.push(t.to_node)
      }
    }
  }

  return reachable
}

export function generateNodeKey(type: NodeType, existingKeys: string[]): string {
  let i = 1
  let key = `${type}_${i}`
  while (existingKeys.includes(key)) {
    i++
    key = `${type}_${i}`
  }
  return key
}
