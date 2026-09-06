import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  ReactFlowProvider,
} from '@xyflow/react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Save,
  Upload,
  Plus,
  ArrowLeft,
  Loader2,
  FlaskConical,
  LogOut,
} from 'lucide-react'
import { ScenarioNodeCard } from '../components/nodes/ScenarioNode'
import { TransitionEdge } from '../components/nodes/TransitionEdge'
import { NodeForm } from '../components/forms/NodeForm'
import { CreateNodeModal } from '../components/nodes/CreateNodeModal'
import { TestChatPanel } from '../components/chat/TestChatPanel'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { useScenario, useUpdateScenarioDraft, usePublishScenario } from '../api/hooks/useBots'
import {
  useCreateNode,
  useUpdateNode,
  useDeleteNode,
} from '../api/hooks/useNodes'
import {
  useCreateTransition,
  useUpdateTransition,
} from '../api/hooks/useTransitions'
import { useEditorStore } from '../store/editorStore'
import {
  scenarioToFlow,
  validateScenarioForPublish,
  generateNodeKey,
  START_NODE_KEY,
  NODE_TYPE_META,
} from '../utils/graphUtils'
import { getDefaultConfig } from '../utils/nodeConfigSchemas'
import type { NodeType, NodeConfig } from '../types'
import { debounce } from '../utils/cn'
import { ApiError } from '../api/client'
import { useCurrentUser, useLogout } from '../api/hooks/useAuth'

const nodeTypes = { scenarioNode: ScenarioNodeCard }
const edgeTypes = { transitionEdge: TransitionEdge }

interface EditorInnerProps {
  scenarioId: number
}

function ScenarioEditorInner({ scenarioId }: EditorInnerProps) {
  const navigate = useNavigate()
  const { data: scenario, isLoading, error, refetch } = useScenario(scenarioId)
  const updateDraft = useUpdateScenarioDraft(scenarioId)
  const publishScenario = usePublishScenario(scenarioId)
  const { data: currentUser } = useCurrentUser()
  const logout = useLogout()
  const createNode = useCreateNode(scenarioId)
  const updateNode = useUpdateNode(scenarioId)
  const deleteNode = useDeleteNode(scenarioId)
  const createTransition = useCreateTransition(scenarioId)
  const updateTransition = useUpdateTransition(scenarioId)

  const {
    selectedNodeId,
    setSelectedNodeId,
    isDirty,
    setDirty,
    isSaving,
    setSaving,
    lastSavedAt,
    setLastSavedAt,
    showTestChat,
    setShowTestChat,
  } = useEditorStore()

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [apiErrors, setApiErrors] = useState<Record<string, string[]>>({})
  const [publishIssues, setPublishIssues] = useState<string[]>([])
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)

  const scenarioRef = useRef(scenario)
  scenarioRef.current = scenario

  useEffect(() => {
    if (!scenario) return
    const { nodes: flowNodes, edges: flowEdges } = scenarioToFlow(
      scenario.nodes,
      scenario.transitions,
    )

    // Preserve local node positions when possible to avoid UI recentering while editing
    // Use functional set to access the previous nodes state without adding `nodes` to deps
    setNodes((prevNodes) =>
      flowNodes.map((n) => {
        const local = prevNodes.find((ln) => ln.id === n.id)
        return {
          ...n,
          position: local?.position ?? n.position,
          data: {
            ...n.data,
            transitions: scenario.transitions,
          },
        }
      }),
    )

    setEdges(flowEdges)
  }, [scenario, setNodes, setEdges])

  const selectedNode = scenario?.nodes.find((n) => n.id === selectedNodeId) ?? null

  const debouncedSavePosition = useMemo(
    () =>
      debounce((nodeId: number, position: { x: number; y: number }) => {
        updateNode.mutate({ id: nodeId, position })
      }, 800),
    [updateNode],
  )

  const debouncedAutoSave = useMemo(
    () =>
      debounce(() => {
        const s = scenarioRef.current
        if (!s) return
        // Autosave only positions to avoid sending incomplete configs and triggering validation
        const nodesPositions = nodes
          .map((n) => ({ id: Number(n.id), position: n.position }))
          .filter((n) => !Number.isNaN(n.id))
        setSaving(true)
        updateDraft.mutate(
          { nodes: nodesPositions, transitions: s.transitions },
          {
            onSettled: () => {
              setSaving(false)
              setDirty(false)
              setLastSavedAt(new Date())
            },
          },
        )
      }, 800),
    [updateDraft, setSaving, setDirty, setLastSavedAt, nodes],
  )

  const markDirty = useCallback(() => {
    setDirty(true)
    // If a node is currently open for editing, avoid performing the autosave
    // that triggers scenario-level PATCHes. Position saves still occur on drag.
    if (!selectedNodeId) {
      debouncedAutoSave()
    }
  }, [setDirty, debouncedAutoSave, selectedNodeId])

  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      debouncedSavePosition(parseInt(node.id, 10), node.position)
      markDirty()
    },
    [debouncedSavePosition, markDirty],
  )

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || !scenario) return

      const fromId = parseInt(connection.source, 10)
      const toId = parseInt(connection.target, 10)
      const fromNode = scenario.nodes.find((n) => n.id === fromId)
      if (!fromNode) return

      let trigger: 'callback' | 'text' | 'condition' | 'always' = 'always'
      let trigger_value: string | null = null
      let condition_expr: string | null = null
      let priority = 0

      if (fromNode.type === 'menu' && connection.sourceHandle?.startsWith('callback-')) {
        trigger = 'callback'
        trigger_value = connection.sourceHandle.replace('callback-', '')
      } else if (fromNode.type === 'condition') {
        if (connection.sourceHandle === 'always') {
          trigger = 'always'
          priority = 9999
        } else if (connection.sourceHandle?.startsWith('condition-')) {
          trigger = 'condition'
          const transitionId = parseInt(connection.sourceHandle.replace('condition-', ''), 10)
          const existing = scenario.transitions.find((t) => t.id === transitionId)
          condition_expr = existing?.condition_expr ?? 'true'
          priority = existing?.priority ?? 0
        }
      } else if (fromNode.type === 'question') {
        trigger = 'always'
      }

      const existing = scenario.transitions.find(
        (t) =>
          t.from_node === fromId &&
          ((trigger === 'callback' && t.trigger_value === trigger_value) ||
            (trigger === 'condition' &&
              connection.sourceHandle === `condition-${t.id}`) ||
            (trigger === 'always' && t.trigger === 'always')),
      )

      try {
        if (existing) {
          await updateTransition.mutateAsync({ id: existing.id, to_node: toId })
        } else {
          await createTransition.mutateAsync({
            from_node: fromId,
            to_node: toId,
            trigger,
            trigger_value,
            condition_expr,
            priority,
          })
        }
        markDirty()
        refetch()
      } catch {
        // handled by mutation
      }
    },
    [scenario, createTransition, updateTransition, markDirty, refetch],
  )

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createModalProps, setCreateModalProps] = useState<
    | {
        type: NodeType
        keyName: string
        position: { x: number; y: number }
      }
    | null
  >(null)

  const handleAddNode = async (type: NodeType) => {
    if (!scenario) return

    const key =
      type === 'message' && !scenario.nodes.some((n) => n.key === START_NODE_KEY)
        ? START_NODE_KEY
        : generateNodeKey(
            type,
            scenario.nodes.map((n) => n.key),
          )

    // place new node in center of viewport instead of edge
    const position = {
      x: Math.round((window.innerWidth || 800) / 2 - 150),
      y: Math.round((window.innerHeight || 600) / 2 - 100),
    }

    // Open in-app modal to gather required fields before creating node
    setCreateModalProps({ type, keyName: key, position })
    setCreateModalOpen(true)
    setShowAddMenu(false)
  }

  const handleUpdateNode = async (config: NodeConfig, key?: string) => {
    if (!selectedNode) return
    try {
      await updateNode.mutateAsync({
        id: selectedNode.id,
        config,
        ...(key ? { key } : {}),
      })
      setApiErrors({})
      markDirty()
      refetch()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.fieldErrors) {
        setApiErrors(err.fieldErrors)
      }
    }
  }

  const handleDeleteNode = async () => {
    if (!selectedNode || selectedNode.key === START_NODE_KEY) return
    if (!confirm(`Удалить узел «${selectedNode.key}»?`)) return
    await deleteNode.mutateAsync(selectedNode.id)
    setSelectedNodeId(null)
    markDirty()
  }

  const handleManualSave = () => {
    if (!scenario) return
    setSaving(true)
    updateDraft.mutate(
      { nodes: scenario.nodes, transitions: scenario.transitions },
      {
        onSettled: () => {
          setSaving(false)
          setDirty(false)
          setLastSavedAt(new Date())
        },
      },
    )
  }

  const handlePublish = () => {
    if (!scenario) return
    const issues = validateScenarioForPublish(scenario.nodes, scenario.transitions)
    const errors = issues.filter((i) => i.type === 'error')
    if (errors.length > 0) {
      setPublishIssues(errors.map((e) => e.message))
      return
    }
    setPublishIssues([])
    setShowPublishConfirm(true)
  }

  const confirmPublish = async () => {
    await publishScenario.mutateAsync()
    setShowPublishConfirm(false)
  }

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(parseInt(node.id, 10))
    },
    [setSelectedNodeId],
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error || !scenario) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-600">Не удалось загрузить сценарий</p>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Назад
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {createModalOpen && createModalProps && (
        <CreateNodeModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          scenarioId={scenarioId}
          type={createModalProps.type}
          keyName={createModalProps.keyName}
          position={createModalProps.position}
        />
      )}
      <header className="flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-gray-900">{scenario.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={scenario.is_published ? 'published' : 'draft'}>
              {scenario.is_published ? 'Опубликован' : 'Черновик'}
            </Badge>
            <span className="text-xs text-gray-400">v{scenario.version}</span>
            {isSaving && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Сохранение...
              </span>
            )}
            {!isSaving && lastSavedAt && (
              <span className="text-xs text-gray-400">
                Сохранено {lastSavedAt.toLocaleTimeString()}
              </span>
            )}
            {isDirty && !isSaving && (
              <span className="text-xs text-amber-600">Есть несохранённые изменения</span>
            )}
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="hidden md:inline">{currentUser.username}</span>
            <button
              type="button"
              onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="relative">
          <Button variant="secondary" size="sm" onClick={() => setShowAddMenu(!showAddMenu)}>
            <Plus className="w-4 h-4" />
            Добавить узел
          </Button>
          {showAddMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              {(Object.keys(NODE_TYPE_META) as NodeType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleAddNode(type)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className={NODE_TYPE_META[type].color}>{NODE_TYPE_META[type].label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTestChat(!showTestChat)}
          className={showTestChat ? 'bg-indigo-50 text-indigo-700' : ''}
        >
          <FlaskConical className="w-4 h-4" />
          Тест
        </Button>

        <Button variant="secondary" size="sm" onClick={handleManualSave} disabled={isSaving}>
          <Save className="w-4 h-4" />
          Сохранить
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={handlePublish}
          disabled={publishScenario.isPending}
        >
          <Upload className="w-4 h-4" />
          Опубликовать
        </Button>
      </header>

      {publishIssues.length > 0 && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200">
          <p className="text-sm font-medium text-red-800 mb-1">Ошибки валидации:</p>
          <ul className="text-sm text-red-700 list-disc list-inside">
            {publishIssues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode={null}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {selectedNode && (
          <aside className="w-80 bg-white border-l border-gray-200 shrink-0 overflow-hidden flex flex-col">
            <NodeForm
              node={selectedNode}
              transitions={scenario.transitions}
              onUpdate={handleUpdateNode}
              onDelete={handleDeleteNode}
              onTransitionChange={() => refetch()}
              apiErrors={apiErrors}
              scenarioId={scenarioId}
            />
          </aside>
        )}

        {showTestChat && (
          <aside className="w-72 shrink-0">
            <TestChatPanel nodes={scenario.nodes} transitions={scenario.transitions} />
          </aside>
        )}
      </div>

      {showPublishConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Опубликовать сценарий?</h2>
            <p className="text-sm text-gray-600 mb-6">
              Живые пользователи бота переключатся на новую версию сразу после публикации.
              Убедитесь, что сценарий протестирован.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setShowPublishConfirm(false)}>
                Отмена
              </Button>
              <Button variant="primary" onClick={confirmPublish} disabled={publishScenario.isPending}>
                {publishScenario.isPending ? 'Публикация...' : 'Опубликовать'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function ScenarioEditorPage() {
  const { scenarioId: scenarioIdParam } = useParams<{ scenarioId: string }>()
  const id = parseInt(scenarioIdParam ?? '0', 10)

  return (
    <ReactFlowProvider>
      <ScenarioEditorInner scenarioId={id} />
    </ReactFlowProvider>
  )
}
