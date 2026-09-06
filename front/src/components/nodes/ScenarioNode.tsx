import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  MessageSquare,
  HelpCircle,
  LayoutGrid,
  GitBranch,
  Zap,
  FolderInput,
  Clock,
  Star,
} from 'lucide-react'
import type { ScenarioNode, NodeType, MenuConfig } from '../../types'
import { NODE_TYPE_META, getNodePreview } from '../../utils/graphUtils'
import type { Transition } from '../../types'

const ICONS: Record<NodeType, typeof MessageSquare> = {
  message: MessageSquare,
  question: HelpCircle,
  menu: LayoutGrid,
  condition: GitBranch,
  action: Zap,
  subscenario: FolderInput,
  delay: Clock,
}

export interface ScenarioNodeData {
  scenarioNode: ScenarioNode
  isStart: boolean
  transitions?: Transition[]
  onSelect?: (id: number) => void
  [key: string]: unknown
}

function ScenarioNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as ScenarioNodeData
  const node = nodeData.scenarioNode
  const meta = NODE_TYPE_META[node.type]
  const Icon = ICONS[node.type]
  const preview = getNodePreview(node)
  const transitions = nodeData.transitions ?? []

  const showDefaultSource = node.type !== 'menu' && node.type !== 'condition'

  return (
    <div
      className={`min-w-[180px] max-w-[240px] rounded-xl border-2 shadow-sm transition-shadow ${meta.bg} ${meta.border} ${
        selected ? 'ring-2 ring-indigo-500 shadow-md' : ''
      } ${nodeData.isStart ? 'ring-2 ring-yellow-400' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />

      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-4 h-4 shrink-0 ${meta.color}`} />
          <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>
            {meta.label}
          </span>
          {nodeData.isStart && (
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 ml-auto" />
          )}
        </div>
        <div className="text-xs text-gray-500 font-mono mb-1">{node.key}</div>
        <div className="text-sm text-gray-800 line-clamp-2">{preview}</div>

        {node.type === 'menu' && (
          <div className="mt-2 space-y-1">
            {(node.config as MenuConfig).buttons?.map((btn, i) => (
              <div
                key={btn.callback}
                className="relative flex items-center justify-between text-xs bg-white/70 rounded px-2 py-1 border border-green-200"
              >
                <span className="truncate">{btn.text}</span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`callback-${btn.callback}`}
                  className="!bg-green-500 !w-2.5 !h-2.5 !right-[-6px]"
                  style={{ top: `${((i + 1) / ((node.config as MenuConfig).buttons.length + 1)) * 100}%` }}
                />
              </div>
            ))}
          </div>
        )}

        {node.type === 'condition' && (
          <div className="mt-2 space-y-1">
            {transitions
              .filter((t) => t.from_node === node.id)
              .sort((a, b) => a.priority - b.priority)
              .map((t, i) => (
                <div
                  key={t.id}
                  className="relative text-xs bg-white/70 rounded px-2 py-1 border border-orange-200 truncate"
                >
                  {t.trigger === 'always' ? 'иначе' : t.condition_expr}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={
                      t.trigger === 'always'
                        ? 'always'
                        : `condition-${t.id}`
                    }
                    className="!bg-orange-500 !w-2.5 !h-2.5 !right-[-6px]"
                    style={{ top: `${((i + 1) / (transitions.filter((tr) => tr.from_node === node.id).length + 1)) * 100}%` }}
                  />
                </div>
              ))}
          </div>
        )}
      </div>

      {showDefaultSource && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-gray-400 !w-3 !h-3"
        />
      )}
    </div>
  )
}

export const ScenarioNodeCard = memo(ScenarioNodeComponent)
