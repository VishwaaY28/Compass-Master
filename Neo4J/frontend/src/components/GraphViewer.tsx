import { useState, useEffect, useRef, useCallback } from 'react'
import type NVL from '@neo4j-nvl/base'
import type { Node, Relationship, HitTargets } from '@neo4j-nvl/base'
import { InteractiveNvlWrapper } from '@neo4j-nvl/react'
import type { MouseEventCallbacks } from '@neo4j-nvl/react'
import NodeDetails from './NodeDetails'
import { transformApiResponseToNvl } from '../utils/transformer'
import type { TraversalNode, TraversalRelationship } from '../utils/transformer'
import type { ApiResponse } from '../types'

const PATH_HIGHLIGHT_COLOR = '#1976D2'
const PATH_STROKE_WIDTH = 3
const NORMAL_STROKE_WIDTH = 1.5
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3.0
const ZOOM_STEP = 0.25
const DEFAULT_ZOOM = 1.0
const ANIMATION_DELAY = 300

export interface GraphViewerProps {
  entityType: string
  entityId: number
  depth?: number
  direction?: 'outgoing' | 'incoming' | 'both'
  apiBase?: string
  showNodeDetails?: boolean
  showLegend?: boolean
  showZoomControls?: boolean
  showNodeCounter?: boolean
  onNodeSelect?: (node: { id: string; label: string; properties: Record<string, unknown> }) => void
  onError?: (error: string) => void
  onLoad?: (nodeCount: number) => void
}

export function GraphViewer({
  entityType,
  entityId,
  depth = 4,
  direction = 'outgoing',
  apiBase = '/api',
  showNodeDetails = true,
  showLegend = true,
  showZoomControls = true,
  showNodeCounter = true,
  onNodeSelect,
  onError,
  onLoad,
}: GraphViewerProps) {
  const nvlRef = useRef<NVL | null>(null)
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
    path?: Array<{ name: string; type: string }>
  } | null>(null)
  const [nodePropertiesLoading, setNodePropertiesLoading] = useState(false)
  const [parentMap, setParentMap] = useState<Map<string, string>>(new Map())
  const [, setHighlightedPath] = useState<Set<string>>(new Set())
  const [, setHighlightedEdges] = useState<Set<string>>(new Set())
  const [currentZoom, setCurrentZoom] = useState<number>(DEFAULT_ZOOM)
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    async function fetchSubtree() {
      if (!entityType || !entityId) return
      setLoading(true)
      setError(null)
      setHighlightedPath(new Set())
      setHighlightedEdges(new Set())
      try {
        const depthParam = depth > 0 ? `&depth=${depth}` : ''
        const response = await fetch(
          `${apiBase}/subtree/${entityType}/id/${entityId}?direction=${direction}${depthParam}`
        )
        if (!response.ok) throw new Error('Failed to fetch subtree')
        const data: ApiResponse = await response.json()
        const { nodes: nvlNodes, rels: nvlRels, parentMap: newParentMap } = transformApiResponseToNvl(data)

        setAllNodes(nvlNodes)
        setAllRels(nvlRels)
        setTotalLoadedNodes(nvlNodes.length)
        setParentMap(newParentMap)

        animateTraversal(nvlNodes, nvlRels)
        onLoad?.(nvlNodes.length)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMsg)
        onError?.(errorMsg)
      } finally {
        setLoading(false)
      }
    }

    fetchSubtree()
  }, [entityType, entityId, depth, direction, apiBase, animateTraversal, onLoad, onError])

  const computePathToRoot = useCallback((nodeId: string): { pathNodes: Set<string>, pathEdges: Set<string>, pathDetails: Array<{ name: string; type: string }> } => {
    const pathNodes = new Set<string>()
    const pathEdges = new Set<string>()
    const pathDetails: Array<{ name: string; type: string }> = []

    let currentId: string | undefined = nodeId
    while (currentId) {
      pathNodes.add(currentId)
      const currentNode = allNodes.find(n => n.id === currentId)
      if (currentNode) {
        pathDetails.push({
          name: currentNode.captions?.[0]?.value || 'Unknown',
          type: currentNode.label || 'Node'
        })
      }
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

    return { pathNodes, pathEdges, pathDetails }
  }, [parentMap, allRels, allNodes])

  const clearPathHighlight = useCallback(() => {
    setHighlightedPath(new Set())
    setHighlightedEdges(new Set())

    setVisibleNodes(prev => prev.map(node => ({
      ...node,
      opacity: 1,
    })))

    setVisibleRels(prev => prev.map(rel => ({
      ...rel,
      color: '#000000',
      width: NORMAL_STROKE_WIDTH,
      opacity: 1,
    })))
  }, [])

  const highlightPathToNode = useCallback((nodeId: string): Array<{ name: string; type: string }> => {
    const { pathNodes, pathEdges, pathDetails } = computePathToRoot(nodeId)
    setHighlightedPath(pathNodes)
    setHighlightedEdges(pathEdges)

    setVisibleNodes(prev => prev.map(node => {
      const isOnPath = pathNodes.has(node.id)
      return {
        ...node,
        opacity: isOnPath ? 1 : 0.35,
      }
    }))

    setVisibleRels(prev => prev.map(rel => {
      const isOnPath = pathEdges.has(rel.id)
      return {
        ...rel,
        color: isOnPath ? PATH_HIGHLIGHT_COLOR : '#000000',
        width: isOnPath ? PATH_STROKE_WIDTH : NORMAL_STROKE_WIDTH,
        opacity: isOnPath ? 1 : 0.35,
      }
    }))
    
    return pathDetails
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

  const handleNodeClick = async (node: Node, _hitTargets: HitTargets, originalEvent: MouseEvent) => {
    originalEvent.stopPropagation()
    
    const fullNode = allNodes.find(n => n.id === node.id)
    const nodeLabel = fullNode?.label || 'Node'
    const nodeProperties = fullNode?.properties || {}
    const nodeUid = nodeProperties.uid
    
    const pathDetails = highlightPathToNode(node.id)
    
    const nodeData = {
      id: node.id,
      label: node.captions?.[0]?.value || 'Node',
      properties: {
        ...nodeProperties,
      },
      path: pathDetails,
    }
    setSelectedNode(nodeData)
    onNodeSelect?.(nodeData)
    
    if (nodeUid && nodeLabel) {
      setNodePropertiesLoading(true)
      try {
        const response = await fetch(`${apiBase}/properties/node-properties/${nodeLabel}?uid=${nodeUid}`)
        if (response.ok) {
          const data = await response.json()
          if (data.properties) {
            setSelectedNode(prev => prev ? {
              ...prev,
              properties: {
                ...prev.properties,
                ...data.properties,
              },
            } : null)
          }
        }
      } catch (err) {
        console.error('Failed to fetch node properties:', err)
      } finally {
        setNodePropertiesLoading(false)
      }
    }
  }

  const mouseEventCallbacks: MouseEventCallbacks = {
    onHover: () => {},
    onNodeClick: handleNodeClick,
    onNodeDoubleClick: () => {},
    onRelationshipClick: () => {},
    onDrag: () => {},
    onPan: () => {},
    onZoom: (zoomLevel: number) => {
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(zoomLevel, MAX_ZOOM))
      setCurrentZoom(clampedZoom)
    },
    onCanvasClick: () => {
      clearPathHighlight()
    },
  }

  return (
    <div className="graph-viewer">
      {error && <div className="error-message">{error}</div>}

      <div className="graph-viewer-main">
        {showNodeCounter && totalLoadedNodes > 0 && (
          <div className="node-counter">
            <span className="counter-label">Number of Nodes:</span>
            <span className="counter-value">{totalLoadedNodes}</span>
          </div>
        )}

        {showZoomControls && (
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
        )}

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
            <>
              <div className="animation-indicator">
                Traversing path... ({visibleNodes.length}/{allNodes.length} nodes)
              </div>
              <button className="skip-animation-btn skip-btn-embedded" onClick={skipAnimation}>
                Skip Animation
              </button>
            </>
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
                  minHeight: '500px',
                  minWidth: '100%',
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
            !loading && (
              <div className="empty-state">
                <p>Loading graph visualization...</p>
              </div>
            )
          )}
        </div>

        {showNodeDetails && (
          <NodeDetails 
            selectedNode={selectedNode} 
            onClose={() => setSelectedNode(null)} 
            loading={nodePropertiesLoading}
          />
        )}
      </div>

      {showLegend && (
        <div className="legend">
          <span className="legend-item"><span className="dot capability"></span>Capability</span>
          <span className="legend-item"><span className="dot process"></span>Process</span>
          <span className="legend-item"><span className="dot subprocess"></span>Subprocess</span>
          <span className="legend-item"><span className="dot dataentity"></span>Data Entity</span>
          <span className="legend-item"><span className="dot dataelement"></span>Data Element</span>
        </div>
      )}
    </div>
  )
}

export default GraphViewer
