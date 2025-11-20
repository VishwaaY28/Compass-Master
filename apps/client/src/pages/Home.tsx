import { useState } from 'react'

type Process = {
  id: number
  name: string
  level: string
  description: string
}

type Capability = {
  id: number
  vertical: string
  name: string
  description: string
  processes: Process[]
}

export default function Home() {
  const verticalOptions = ['Vertical A', 'Vertical B', 'Vertical C']
  const [selectedVertical, setSelectedVertical] = useState('')
  const [capabilities, setCapabilities] = useState<Capability[]>([])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add')
  const [editingId, setEditingId] = useState<number | null>(null)

  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')

  function openAddModal() {
    setModalMode('add')
    setEditingId(null)
    setFormName('')
    setFormDescription('')
    setIsModalOpen(true)
  }

  function openEditModal(cap: Capability) {
    setModalMode('edit')
    setEditingId(cap.id)
    setFormName(cap.name)
    setFormDescription(cap.description)
    setIsModalOpen(true)
  }

  function openViewModal(cap: Capability) {
    setModalMode('view')
    setEditingId(cap.id)
    setFormName(cap.name)
    setFormDescription(cap.description)
    setIsModalOpen(true)
  }

  function saveCapability() {
    if (modalMode === 'add') {
      const newCap: Capability = {
        id: Date.now(),
        vertical: selectedVertical,
        name: formName,
        description: formDescription,
        processes: [],
      }
      setCapabilities((s) => [newCap, ...s])
    } else if (modalMode === 'edit' && editingId != null) {
      setCapabilities((s) =>
        s.map((c) => (c.id === editingId ? { ...c, name: formName, description: formDescription } : c)),
      )
    }
    setIsModalOpen(false)
  }

  // Process modal state and handlers
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false)
  const [processCapId, setProcessCapId] = useState<number | null>(null)
  const [processName, setProcessName] = useState('')
  const [processLevel, setProcessLevel] = useState('Level 1 - Enterprise process')
  const [processDescription, setProcessDescription] = useState('')

  const processLevelOptions = [
    'Level 1 - Enterprise process',
    'Level 2 - Core process',
    'Level 3 - Process',
    'Level 4 - Subprocess',
  ]

  function openProcessModal(capId: number) {
    setProcessCapId(capId)
    setProcessName('')
    setProcessLevel(processLevelOptions[0])
    setProcessDescription('')
    setIsProcessModalOpen(true)
  }

  function saveProcess() {
    if (!processName.trim() || processCapId == null) return
    const newProcess: Process = {
      id: Date.now(),
      name: processName.trim(),
      level: processLevel,
      description: processDescription.trim(),
    }
    setCapabilities((s) => s.map((c) => (c.id === processCapId ? { ...c, processes: [...c.processes, newProcess] } : c)))
    setIsProcessModalOpen(false)
  }

  // Expanded state for capabilities (collapse/expand)
  const [expandedIds, setExpandedIds] = useState<number[]>([])

  function toggleExpand(capId: number) {
    setExpandedIds((prev) => (prev.includes(capId) ? prev.filter((id) => id !== capId) : [capId, ...prev]))
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto bg-white shadow rounded p-6">
        <h1 className="text-2xl font-semibold mb-4">Capabilities</h1>

        <div className="flex items-center gap-4 mb-6">
          <select
            className="border rounded px-3 py-2"
            value={selectedVertical}
            onChange={(e) => setSelectedVertical(e.target.value)}
          >
            <option value="">Select vertical</option>
            {verticalOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <button
            className={`px-4 py-2 rounded text-white ${selectedVertical ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
            disabled={!selectedVertical}
            onClick={openAddModal}
          >
            Add capability
          </button>
        </div>

        <div>
          {capabilities.length === 0 ? (
            <p className="text-gray-500">No capabilities yet.</p>
          ) : (
            <ul className="space-y-4">
              {capabilities.map((c) => {
                const isExpanded = expandedIds.includes(c.id)
                return (
                  <li key={c.id} className="border rounded">
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <button
                            className="text-sm text-gray-500 px-2 py-1 rounded hover:bg-gray-100"
                            onClick={() => toggleExpand(c.id)}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? '▾' : '▸'}
                          </button>
                          <div>
                            <div className="text-lg font-medium">{c.name}</div>
                            <div className="text-xs text-gray-500">Vertical: {c.vertical}</div>
                          </div>
                        </div>
                        {!isExpanded && <div className="mt-2 text-sm text-gray-600">{c.description}</div>}
                      </div>

                      <div className="flex gap-2">
                        <button
                          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                          onClick={() => openViewModal(c)}
                        >
                          View
                        </button>
                        <button
                          className="px-3 py-1 bg-yellow-200 rounded hover:bg-yellow-300 text-sm"
                          onClick={() => openEditModal(c)}
                        >
                          Edit
                        </button>
                        <button
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                          onClick={() => openProcessModal(c.id)}
                        >
                          Add process
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 border-t bg-gray-50">
                        <div className="mb-3 text-sm text-gray-700">{c.description}</div>
                        <div className="space-y-3">
                          {c.processes.length === 0 ? (
                            <div className="text-gray-500">No processes yet.</div>
                          ) : (
                            c.processes.map((p) => (
                              <div key={p.id} className="border rounded p-3 bg-white shadow-sm">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium">{p.name}</div>
                                    <div className="text-xs text-gray-500">{p.level}</div>
                                  </div>
                                  {/* Could add process actions here */}
                                </div>
                                {p.description && <div className="mt-2 text-sm text-gray-600">{p.description}</div>}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              {modalMode === 'view' ? 'View capability' : modalMode === 'edit' ? 'Edit capability' : 'Add capability'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={modalMode === 'view'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  rows={4}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  disabled={modalMode === 'view'}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button className="px-4 py-2 rounded border" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              {modalMode !== 'view' && (
                <button
                  className="px-4 py-2 rounded bg-blue-600 text-white"
                  onClick={saveCapability}
                  disabled={!formName.trim()}
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isProcessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Add process</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Process name</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={processName}
                  onChange={(e) => setProcessName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Level</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={processLevel}
                  onChange={(e) => setProcessLevel(e.target.value)}
                >
                  {processLevelOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  value={processDescription}
                  onChange={(e) => setProcessDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button className="px-4 py-2 rounded border" onClick={() => setIsProcessModalOpen(false)}>
                Cancel
              </button>
              <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={saveProcess} disabled={!processName.trim()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
