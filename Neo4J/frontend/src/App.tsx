
import { useState, useEffect, useRef, useCallback } from 'react'
import type NVL from '@neo4j-nvl/base'
import type { Node, Relationship, HitTargets } from '@neo4j-nvl/base'
import { InteractiveNvlWrapper } from '@neo4j-nvl/react'
import type { MouseEventCallbacks } from '@neo4j-nvl/react'
import EntitySelector from './components/EntitySelector'
import ControlPanel from './components/ControlPanel'
import NodeDetails from './components/NodeDetails'
import { transformApiResponseToNvl } from './utils/transformer'
import type { TraversalNode, TraversalRelationship } from './utils/transformer'
import type { EntityType, EntityListItem, Direction, ApiResponse } from './types'
import './App.css'

const API_BASE = '/api'
const ANIMATION_DELAY = 300
const PATH_HIGHLIGHT_COLOR = '#1976D2'
const PATH_STROKE_WIDTH = 3
const NORMAL_STROKE_WIDTH = 1.5
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3.0
const ZOOM_STEP = 0.25
const DEFAULT_ZOOM = 1.0

function App() {
  const nvlRef = useRef<NVL | null>(null)
  const [entityType, setEntityType] = useState<EntityType>('Capability')
  const [entities, setEntities] = useState<EntityListItem[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null)
  const [depth, setDepth] = useState(1)
  const [direction, setDirection] = useState<Direction>('outgoing')
  const [allNodes, setAllNodes] = useState<TraversalNode[]>([])
  const [allRels, setAllRels] = useState<TraversalRelationship[]>([])
  const [visibleNodes, setVisibleNodes] = useState<Node[]>([])
  const [visibleRels, setVisibleRels] = useState<Relationship[]>([])
  const [totalLoadedNodes, setTotalLoadedNodes] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<{
    id: string
    label: string
    properties: Record<string, unknown>
  } | null>(null)
  const [parentMap, setParentMap] = useState<Map<string, string>>(new Map())
  const [, setRootId] = useState<string | null>(null)
  const [, setHighlightedPath] = useState<Set<string>>(new Set())
  const [, setHighlightedEdges] = useState<Set<string>>(new Set())
  const [currentZoom, setCurrentZoom] = useState<number>(DEFAULT_ZOOM)
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchEntities()
  }, [entityType])

  useEffect(() => {
    if (selectedEntityId !== null) {
      fetchSubtree()
    }
  }, [selectedEntityId, depth, direction])

  const animateTraversal = useCallback((nodes: TraversalNode[], rels: TraversalRelationship[]) => {
    if (animationRef.current) {
      clearTimeout(animationRef.current)
    }

    setVisibleNodes([])
    setVisibleRels([])
    setAnimating(true)

    const sortedNodes = [...nodes].sort((a, b) => a.traversalOrder - b.traversalOrder)
    const sortedRels = [...rels].sort((a, b) => a.traversalOrder - b.traversalOrder)

    let nodeIndex = 0
    let relIndex = 0

    const animate = () => {
      if (nodeIndex < sortedNodes.length) {
        const currentNode = sortedNodes[nodeIndex]

        setVisibleNodes(prev => {
          const newNode: Node = {
            id: currentNode.id,
            captions: currentNode.captions,
            color: currentNode.color,
            size: currentNode.size,
            x: currentNode.x,
            y: currentNode.y,
          }
          return [...prev, newNode]
        })

        while (relIndex < sortedRels.length) {
          const rel = sortedRels[relIndex]
          const targetNodeOrder = sortedNodes.find(n => n.id === rel.to)?.traversalOrder ?? Infinity

          if (targetNodeOrder <= currentNode.traversalOrder) {
            setVisibleRels(prev => {
              const newRel: Relationship = {
                id: rel.id,
                from: rel.from,
                to: rel.to,
                captions: rel.captions,
                color: '#000000',
              }
              return [...prev, newRel]
            })
            relIndex++
          } else {
            break
          }
        }

        nodeIndex++
        animationRef.current = setTimeout(animate, ANIMATION_DELAY)
      } else {
        while (relIndex < sortedRels.length) {
          const rel = sortedRels[relIndex]
          setVisibleRels(prev => [...prev, {
            id: rel.id,
            from: rel.from,
            to: rel.to,
            captions: rel.captions,
            color: '#000000',
          }])
          relIndex++
        }
        setAnimating(false)

        setTimeout(() => {
          if (nvlRef.current && nodes.length > 0) {
            nvlRef.current.fit(nodes.map((n) => n.id))
          }
        }, 200)
      }
    }

    animate()
  }, [])

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current)
      }
    }
  }, [])

  async function fetchEntities() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/subtree/${entityType}/all`)
      if (!response.ok) throw new Error('Failed to fetch entities')
      const data: EntityListItem[] = await response.json()
      setEntities(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function fetchSubtree() {
    if (selectedEntityId === null) return
    setLoading(true)
    setError(null)
    setHighlightedPath(new Set())
    setHighlightedEdges(new Set())
    try {
      const depthParam = depth > 0 ? `&depth=${depth}` : ''
      const response = await fetch(
        `${API_BASE}/subtree/${entityType}/id/${selectedEntityId}?direction=${direction}${depthParam}`
      )
      if (!response.ok) throw new Error('Failed to fetch subtree')
      const data: ApiResponse = await response.json()
      const { nodes: nvlNodes, rels: nvlRels, parentMap: newParentMap, rootId: newRootId } = transformApiResponseToNvl(data)

      setAllNodes(nvlNodes)
      setAllRels(nvlRels)
      setTotalLoadedNodes(nvlNodes.length)
      setParentMap(newParentMap)
      setRootId(newRootId)

      animateTraversal(nvlNodes, nvlRels)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const computePathToRoot = useCallback((nodeId: string): { pathNodes: Set<string>, pathEdges: Set<string> } => {
    const pathNodes = new Set<string>()
    const pathEdges = new Set<string>()

    let currentId: string | undefined = nodeId
    while (currentId) {
      pathNodes.add(currentId)
      const parentId = parentMap.get(currentId)
      if (parentId) {
        const edge = allRels.find(r =>
          (r.from === parentId && r.to === currentId) ||
          (r.from === currentId && r.to === parentId)
        )
        if (edge) {
          pathEdges.add(edge.id)
        }
      }
      currentId = parentId
    }

    return { pathNodes, pathEdges }
  }, [parentMap, allRels])

  const clearPathHighlight = useCallback(() => {
    setHighlightedPath(new Set())
    setHighlightedEdges(new Set())

    setVisibleRels(prev => prev.map(rel => ({
      ...rel,
      color: '#000000',
      width: NORMAL_STROKE_WIDTH,
    })))
  }, [])

  const highlightPathToNode = useCallback((nodeId: string) => {
    const { pathEdges } = computePathToRoot(nodeId)
    setHighlightedPath(new Set())
    setHighlightedEdges(pathEdges)

    setVisibleRels(prev => prev.map(rel => {
      const isOnPath = pathEdges.has(rel.id)
      return {
        ...rel,
        color: isOnPath ? PATH_HIGHLIGHT_COLOR : '#000000',
        width: isOnPath ? PATH_STROKE_WIDTH : NORMAL_STROKE_WIDTH,
      }
    }))
  }, [computePathToRoot])

  const skipAnimation = () => {
    if (animationRef.current) {
      clearTimeout(animationRef.current)
    }
    setVisibleNodes(allNodes.map(n => ({
      id: n.id,
      captions: n.captions,
      color: n.color,
      size: n.size,
      x: n.x,
      y: n.y,
    })))
    setVisibleRels(allRels.map(r => ({
      id: r.id,
      from: r.from,
      to: r.to,
      captions: r.captions,
      color: '#000000',
    })))
    setAnimating(false)

    setTimeout(() => {
      if (nvlRef.current && allNodes.length > 0) {
        nvlRef.current.fit(allNodes.map((n) => n.id))
      }
    }, 200)
  }

  const zoomIn = useCallback(() => {
    if (nvlRef.current && currentZoom < MAX_ZOOM) {
      const newZoom = Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM)
      nvlRef.current.setZoom(newZoom)
      setCurrentZoom(newZoom)
    }
  }, [currentZoom])

  const zoomOut = useCallback(() => {
    if (nvlRef.current && currentZoom > MIN_ZOOM) {
      const newZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM)
      nvlRef.current.setZoom(newZoom)
      setCurrentZoom(newZoom)
    }
  }, [currentZoom])

  const resetZoom = useCallback(() => {
    if (nvlRef.current) {
      nvlRef.current.setZoom(DEFAULT_ZOOM)
      setCurrentZoom(DEFAULT_ZOOM)
    }
  }, [])

  const fitToView = useCallback(() => {
    if (nvlRef.current && visibleNodes.length > 0) {
      nvlRef.current.fit(visibleNodes.map(n => n.id))
      setTimeout(() => {
        if (nvlRef.current) {
          const zoom = nvlRef.current.getScale()
          setCurrentZoom(Math.max(MIN_ZOOM, Math.min(zoom, MAX_ZOOM)))
        }
      }, 100)
    }
  }, [visibleNodes])

  const isZoomInDisabled = currentZoom >= MAX_ZOOM || visibleNodes.length === 0
  const isZoomOutDisabled = currentZoom <= MIN_ZOOM || visibleNodes.length === 0
  const isResetDisabled = visibleNodes.length === 0
  const isFitDisabled = visibleNodes.length === 0

  const handleNodeClick = (node: Node, hitTargets: HitTargets, originalEvent: MouseEvent) => {
    originalEvent.stopPropagation()
    console.log('onNodeClick', node, hitTargets, originalEvent)
    setSelectedNode({
      id: node.id,
      label: node.captions?.[0]?.value || 'Node',
      properties: {
        id: node.id,
        color: node.color,
        size: node.size,
      },
    })
    highlightPathToNode(node.id)
  }

  const mouseEventCallbacks: MouseEventCallbacks = {
    onHover: (element: Node | Relationship, hitTargets: HitTargets, originalEvent: MouseEvent) => {
      console.log('onHover', element, hitTargets, originalEvent)
    },
    onNodeClick: handleNodeClick,
    onNodeDoubleClick: (node: Node, hitTargets: HitTargets, originalEvent: MouseEvent) => {
      console.log('onNodeDoubleClick', node, hitTargets, originalEvent)
    },
    onRelationshipClick: (rel: Relationship, hitTargets: HitTargets, originalEvent: MouseEvent) => {
      console.log('onRelationshipClick', rel, hitTargets, originalEvent)
    },
    onDrag: (draggedNodes: Node[], originalEvent: MouseEvent) => {
      console.log('onDrag', draggedNodes, originalEvent)
    },
    onPan: (pan: { x: number; y: number }, originalEvent: MouseEvent) => {
      console.log('onPan', pan, originalEvent)
    },
    onZoom: (zoomLevel: number, _originalEvent: MouseEvent) => {
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(zoomLevel, MAX_ZOOM))
      setCurrentZoom(clampedZoom)
    },
    onCanvasClick: (_event: MouseEvent) => {
      console.log('onCanvasClick - clearing highlight')
      clearPathHighlight()
    },
  }

  return (
    <div className="app">
      <header className="app-header">
  <h1 className="title">Visualizer</h1>
</header>

      <div className="app-controls">
        <EntitySelector
          entityType={entityType}
          setEntityType={setEntityType}
          entities={entities}
          selectedEntityId={selectedEntityId}
          setSelectedEntityId={setSelectedEntityId}
          loading={loading}
        />
        <ControlPanel
          depth={depth}
          setDepth={setDepth}
          direction={direction}
          setDirection={setDirection}
        />
        {animating && (
          <button className="skip-animation-btn" onClick={skipAnimation}>
            Skip Animation
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="app-main">
        {totalLoadedNodes > 0 && (
          <div className="node-counter">
            <span className="counter-label">Number of Nodes:</span><span className="counter-value">{totalLoadedNodes}</span>
          </div>
        )}
        <div className="zoom-controls">
          <button
            className="zoom-btn"
            onClick={zoomIn}
            disabled={isZoomInDisabled}
            title="Zoom In"
            aria-label="Zoom In"
          >
            +
          </button>
          <button
            className="zoom-btn"
            onClick={zoomOut}
            disabled={isZoomOutDisabled}
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            −
          </button>
          <button
            className="zoom-btn zoom-btn-text"
            onClick={resetZoom}
            disabled={isResetDisabled}
            title="Reset Zoom"
            aria-label="Reset Zoom"
          >
            Reset
          </button>
          <button
            className="zoom-btn zoom-btn-text"
            onClick={fitToView}
            disabled={isFitDisabled}
            title="Fit to View"
            aria-label="Fit to View"
          >
            Fit
          </button>
          <span className="zoom-level">{Math.round(currentZoom * 100)}%</span>
        </div>
        <div className="graph-container" onClick={(e) => {
          if (e.target === e.currentTarget) {
            clearPathHighlight()
          }
        }}>
          {loading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
            </div>
          )}
          {animating && (
            <div className="animation-indicator">
              Traversing path... ({visibleNodes.length}/{allNodes.length} nodes)
            </div>
          )}
          {visibleNodes.length > 0 ? (
            <div className="graph-wrapper">
              <InteractiveNvlWrapper
                ref={nvlRef}
                style={{
                  borderRadius: 10,
                  border: '2px solid #D5D6D8',
                  height: '100%',
                  width: '100%',
                  minHeight: '600px',
                  minWidth: '800px',
                  background: '#ffffff',
                }}
                nodes={visibleNodes}
                rels={visibleRels}
                mouseEventCallbacks={mouseEventCallbacks}
                layout="forceDirected"
                nvlOptions={{
                  initialZoom: 1,
                  relationshipThreshold: 0,
                  minZoom: 0.1,
                  maxZoom: 10,
                }}
              />
            </div>
          ) : (
            !loading && selectedEntityId === null && (
              <div className="empty-state" onClick={clearPathHighlight}>
                <p>Select an entity type and item to visualize its graph</p>
              </div>
            )
          )}
        </div>

        <NodeDetails selectedNode={selectedNode} onClose={() => setSelectedNode(null)} />
      </div>

      <div className="legend">
        <span className="legend-item"><span className="dot capability"></span>Capability</span>
        <span className="legend-item"><span className="dot process"></span>Process</span>
        <span className="legend-item"><span className="dot subprocess"></span>Subprocess</span>
        <span className="legend-item"><span className="dot dataentity"></span>Data Entity</span>
        <span className="legend-item"><span className="dot dataelement"></span>Data Element</span>
      </div>
    </div>
  )
}

export default App
