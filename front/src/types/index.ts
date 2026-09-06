export type NodeType =
  | 'message'
  | 'question'
  | 'menu'
  | 'condition'
  | 'action'
  | 'subscenario'
  | 'delay'

export type TransitionTrigger = 'callback' | 'text' | 'condition' | 'always'

export interface Position {
  x: number
  y: number
}

export interface MessageConfig {
  text: string
  media_url?: string
}

export interface QuestionConfig {
  prompt: string
  var_name: string
  validation?: 'any' | 'number' | 'phone' | 'email'
}

export interface MenuButton {
  text: string
  callback: string
}

export interface MenuConfig {
  text: string
  buttons: MenuButton[]
}

export interface ActionConfig {
  url: string
  method: 'GET' | 'POST'
  body_template?: Record<string, unknown>
  result_mapping: Record<string, string>
}

export interface SubscenarioConfig {
  scenario_id: number
  return_node_key?: string
}

export interface DelayConfig {
  seconds: number
}

export type NodeConfig =
  | MessageConfig
  | QuestionConfig
  | MenuConfig
  | Record<string, never>
  | ActionConfig
  | SubscenarioConfig
  | DelayConfig

export interface ScenarioNode {
  id: number
  key: string
  type: NodeType
  config: NodeConfig
  position: Position
}

export interface Transition {
  id: number
  from_node: number
  to_node: number
  trigger: TransitionTrigger
  trigger_value: string | null
  condition_expr: string | null
  priority: number
}

export interface Scenario {
  id: number
  name: string
  version: number
  is_published: boolean
  nodes: ScenarioNode[]
  transitions: Transition[]
}

export interface Bot {
  id: number
  name: string
  is_active: boolean
}

export interface CreateBotPayload {
  name?: string
  token: string
  is_active?: boolean
}

export interface AuthUser {
  id: number
  username: string
}

export interface ScenarioSummary {
  id: number
  name: string
  version: number
  is_published: boolean
}

export interface CreateNodePayload {
  key: string
  type: NodeType
  config: NodeConfig
  position: Position
}

export interface UpdateNodePayload {
  key?: string
  config?: NodeConfig
  position?: Position
}

export interface CreateTransitionPayload {
  from_node: number
  to_node: number
  trigger: TransitionTrigger
  trigger_value?: string | null
  condition_expr?: string | null
  priority?: number
}

export interface UpdateTransitionPayload {
  to_node?: number
  trigger?: TransitionTrigger
  trigger_value?: string | null
  condition_expr?: string | null
  priority?: number
}

export interface ScenarioDraftPayload {
  nodes?: ScenarioNode[]
  transitions?: Transition[]
}
