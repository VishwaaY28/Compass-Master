import { useState } from "react";
import { useResearch } from "../hooks/useResearch";

import { Building2, Search, Sparkles } from "lucide-react";
import { FiChevronRight, FiChevronDown, FiLayers } from "react-icons/fi";

const exampleQueries = [
  "What are all the capabilities in private equity?",
  "Show me the deal sourcing and evaluation process",
  "What are the data entities involved in market mapping?",
  "Give me processes for KYC verification"
];

export default function ResearchAgent() {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<{[id: number]: boolean}>({});
  const [subexpanded, setSubexpanded] = useState<{[id: number]: boolean}>({});
  const { research, results, isLoading, error } = useResearch();

  const handleSearch = async (_searchQuery: string) => {
    await research(_searchQuery);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      handleSearch(query);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
  };

  const handleToggleExpand = (id: number) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleSubProcessExpand = (processId: number) => {
    setSubexpanded(prev => ({ ...prev, [processId]: !prev[processId] }));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/favicon.png" width ="40" height="40" />
              <div>
                <h1 className="text-xl font-semibold">Capability Compass</h1>
                <p className="text-xs text-muted-foreground">
                  AI-Driven What-If Scenario Analysis
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-6">
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a what-if question about your business architecture..."
                  className="w-full min-h-[120px] resize-none text-base p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  data-testid="input-query"
                />
                <div className="absolute top-3 right-3">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {exampleQueries.map((example, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleExampleClick(example)}
                      className="px-3 py-1 text-xs bg-secondary text-secondary-foreground border rounded hover:shadow-md transition-shadow cursor-pointer"
                      data-testid={`badge-example-${idx}`}
                    >
                      {example}
                    </button>
                  ))}
                </div>
                
                <button
                  type="submit"
                  disabled={!query.trim() || isLoading}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-white whitespace-nowrap"
                  data-testid="button-analyze"
                >
                  <Search className="h-4 w-4" />
                  {isLoading ? "Analyzing..." : "Analyze"}
                </button>
              </div>
          </form>

          {error && (
            <div className="border border-destructive rounded-lg p-4 bg-destructive/10">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-16">Analyzing...</div>
          ) : results.length > 0 ? (
            <div className="py-8">
              <div className="flex items-center gap-3 mb-6">
                <FiLayers className="w-8 h-8 text-indigo-600" />
                <h3 className="text-2xl font-semibold text-gray-900">Relevant Results ({results.length})</h3>
              </div>
              <ul className="space-y-4">
                {results.map((item: any) => {
                  const itemType = item.type || "capability";
                  const isExpanded = expanded[item.id];
                  
                  // Render subprocess-level matches
                  if (itemType === "subprocess") {
                    return (
                      <li key={item.id} className="bg-white border border-orange-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">SubProcess</span>
                              </div>
                              <div className="text-lg font-semibold text-gray-900 mt-2">{item.name}</div>
                              {item.description && (
                                <div className="mt-2 text-sm text-gray-600">{item.description}</div>
                              )}
                              {item.parent_process && (
                                <div className="mt-3 text-sm text-gray-500">
                                  <span className="font-semibold">Process:</span> {item.parent_process.name}
                                </div>
                              )}
                              {item.parent_capability && (
                                <div className="mt-1 text-sm text-gray-500">
                                  <span className="font-semibold">Capability:</span> {item.parent_capability.name}
                                  {item.parent_capability.subvertical && ` (${item.parent_capability.subvertical})`}
                                </div>
                              )}
                              <div className="flex items-center gap-3 mt-3 flex-wrap">
                                {item.category && (
                                  <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-orange-50 text-orange-700">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {(item.data || item.data_entities || item.data_elements || item.application || item.api) && (
                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                              {item.data && (
                                <div className="text-sm">
                                  <span className="font-semibold text-gray-900">Data Entity:</span>
                                  <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">{item.data}</p>
                                </div>
                              )}
                              {item.data_entities && item.data_entities.length > 0 && (
                                <div className="text-sm">
                                  <span className="font-semibold text-gray-900">Data Entities:</span>
                                  <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">
                                    {item.data_entities.map((de: any) => de.data_entity_name).join(', ')}
                                  </p>
                                </div>
                              )}
                              {item.data_elements && item.data_elements.length > 0 && (
                                <div className="text-sm">
                                  <span className="font-semibold text-gray-900">Data Elements:</span>
                                  <div className="mt-1 space-y-1">
                                    {item.data_elements.map((elem: any, idx: number) => (
                                      <p key={idx} className="text-gray-600 text-xs">
                                        {elem.name} ({elem.entityName})
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {item.application && (
                                <div className="text-sm">
                                  <span className="font-semibold text-gray-900">Application:</span>
                                  <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">{item.application}</p>
                                </div>
                              )}
                              {item.api && (
                                <div className="text-sm">
                                  <span className="font-semibold text-gray-900">API:</span>
                                  <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">{item.api}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  }
                  
                  // Render process-level matches
                  if (itemType === "process") {
                    return (
                      <li key={item.id} className="bg-white border border-blue-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <button
                              className="text-gray-400 p-2 rounded-md hover:bg-gray-50 flex items-center justify-center flex-shrink-0"
                              onClick={() => handleToggleExpand(item.id)}
                              aria-expanded={isExpanded}
                              title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? <FiChevronDown size={18} /> : <FiChevronRight size={18} />}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Process</span>
                              </div>
                              <div className="text-lg font-semibold text-gray-900 mt-2">{item.name}</div>
                              {item.description && (
                                <div className="mt-2 text-sm text-gray-600">{item.description}</div>
                              )}
                              {item.parent_capability && (
                                <div className="mt-2 text-sm text-gray-500">
                                  <span className="font-semibold">Capability:</span> {item.parent_capability.name}
                                  {item.parent_capability.subvertical && ` (${item.parent_capability.subvertical})`}
                                </div>
                              )}
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                {item.level && (
                                  <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                    Level: {item.level}
                                  </span>
                                )}
                                {item.category && (
                                  <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isExpanded && item.subprocesses && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <h5 className="font-semibold text-gray-900 text-sm mb-3">Sub-Processes</h5>
                              {item.subprocesses.length > 0 ? (
                                <div className="space-y-2">
                                  {item.subprocesses.map((subproc: any) => (
                                    <div key={subproc.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                      <h6 className="font-semibold text-gray-900 text-sm">{subproc.name}</h6>
                                      {subproc.description && (
                                        <p className="text-sm text-gray-600 mt-1">{subproc.description}</p>
                                      )}
                                      <div className="mt-3 space-y-2">
                                        {subproc.category && (
                                          <div className="text-sm">
                                            <span className="font-semibold text-gray-900">Category:</span>
                                            <span className="ml-2 inline-block px-2 py-1 rounded text-xs font-medium bg-orange-50 text-orange-700">{subproc.category}</span>
                                          </div>
                                        )}
                                        {subproc.data && (
                                          <div className="text-sm">
                                            <span className="font-semibold text-gray-900">Data Entity:</span>
                                            <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">{subproc.data}</p>
                                          </div>
                                        )}
                                        {subproc.data_entities && subproc.data_entities.length > 0 && (
                                          <div className="text-sm">
                                            <span className="font-semibold text-gray-900">Data Entities:</span>
                                            <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">
                                              {subproc.data_entities.map((de: any) => de.data_entity_name).join(', ')}
                                            </p>
                                          </div>
                                        )}
                                        {subproc.data_elements && subproc.data_elements.length > 0 && (
                                          <div className="text-sm">
                                            <span className="font-semibold text-gray-900">Data Elements:</span>
                                            <div className="mt-1 space-y-1">
                                              {subproc.data_elements.map((elem: any, idx: number) => (
                                                <p key={idx} className="text-gray-600 text-xs">
                                                  {elem.name} ({elem.entityName})
                                                </p>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {subproc.application && (
                                          <div className="text-sm">
                                            <span className="font-semibold text-gray-900">Application:</span>
                                            <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">{subproc.application}</p>
                                          </div>
                                        )}
                                        {subproc.api && (
                                          <div className="text-sm">
                                            <span className="font-semibold text-gray-900">API:</span>
                                            <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">{subproc.api}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4">
                                  <p className="text-sm text-gray-500">No sub-processes found</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  }
                  
                  // Render capability-level matches (default)
                  return (
                    <li key={item.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-4 flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <button
                              className="text-gray-400 p-2 rounded-md hover:bg-gray-50 flex items-center justify-center"
                              onClick={() => handleToggleExpand(item.id)}
                              aria-expanded={isExpanded}
                              title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? <FiChevronDown size={18} /> : <FiChevronRight size={18} />}
                            </button>
                            <div>
                              <div className="text-lg font-semibold text-gray-900">{item.name}</div>
                              <div className="mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">{item.subvertical ?? 'Unassigned'}</span>
                              </div>
                              <div className="mt-3 text-sm text-gray-600">{item.description}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 py-4 border-t border-gray-100">
                          {item.processes && item.processes.length > 0 ? (
                            <div className="space-y-3">
                              {item.processes.map((proc: any) => {
                                const isProcExpanded = subexpanded[proc.id];
                                return (
                                  <div key={proc.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 p-3 flex items-start gap-3 cursor-pointer hover:bg-gray-100 transition" onClick={() => handleToggleSubProcessExpand(proc.id)}>
                                      <button
                                        className="flex-shrink-0 text-gray-600 hover:text-gray-800"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleSubProcessExpand(proc.id);
                                        }}
                                        aria-expanded={isProcExpanded}
                                      >
                                        {isProcExpanded ? <FiChevronDown size={18} /> : <FiChevronRight size={18} />}
                                      </button>
                                      <div className="flex-1">
                                        <h4 className="font-semibold text-gray-900">{proc.name}</h4>
                                        <p className="text-sm text-gray-600 mt-1">{proc.description}</p>
                                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                                          {proc.level && (
                                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                              Level: {proc.level}
                                            </span>
                                          )}
                                          {proc.category && (
                                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700">
                                              {proc.category}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {isProcExpanded && (
                                      <div className="p-4 bg-white border-t border-gray-200">
                                        <h5 className="font-semibold text-gray-900 text-sm mb-3">Sub-Processes</h5>
                                        {proc.subprocesses && proc.subprocesses.length > 0 ? (
                                          <div className="space-y-2">
                                            {proc.subprocesses.map((subproc: any) => (
                                              <div key={subproc.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                                <h6 className="font-semibold text-gray-900 text-sm">{subproc.name}</h6>
                                                {subproc.description && (
                                                  <p className="text-sm text-gray-600 mt-1">{subproc.description}</p>
                                                )}
                                                <div className="mt-3 space-y-2">
                                                  {subproc.category && (
                                                    <div className="text-sm">
                                                      <span className="font-semibold text-gray-900">Category:</span>
                                                      <span className="ml-2 inline-block px-2 py-1 rounded text-xs font-medium bg-orange-50 text-orange-700">{subproc.category}</span>
                                                    </div>
                                                  )}
                                                  {subproc.data && (
                                                    <div className="text-sm">
                                                      <span className="font-semibold text-gray-900">Data Entity:</span>
                                                      <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">{subproc.data}</p>
                                                    </div>
                                                  )}
                                                  {subproc.data_entities && subproc.data_entities.length > 0 && (
                                                    <div className="text-sm">
                                                      <span className="font-semibold text-gray-900">Data Entities:</span>
                                                      <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">
                                                        {subproc.data_entities.map((de: any) => de.data_entity_name).join(', ')}
                                                      </p>
                                                    </div>
                                                  )}
                                                  {subproc.data_elements && subproc.data_elements.length > 0 && (
                                                    <div className="text-sm">
                                                      <span className="font-semibold text-gray-900">Data Elements:</span>
                                                      <div className="mt-1 space-y-1">
                                                        {subproc.data_elements.map((elem: any, idx: number) => (
                                                          <p key={idx} className="text-gray-600 text-xs">
                                                            {elem.name} ({elem.entityName})
                                                          </p>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )}
                                                  {subproc.application && (
                                                    <div className="text-sm">
                                                      <span className="font-semibold text-gray-900">Application:</span>
                                                      <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">{subproc.application}</p>
                                                    </div>
                                                  )}
                                                  {subproc.api && (
                                                    <div className="text-sm">
                                                      <span className="font-semibold text-gray-900">API:</span>
                                                      <p className="text-gray-600 mt-1 whitespace-pre-wrap text-xs">{subproc.api}</p>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="text-center py-6">
                                            <p className="text-sm text-gray-500">No sub-processes found</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <p className="text-sm text-gray-500">No processes found</p>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : query.trim() ? (
            <div className="text-center py-16" data-testid="no-results-state">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Matching Capabilities Found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                We couldn't find any capabilities matching your query. Try rewording your question or exploring different topics.
              </p>
            </div>
          ) : (
            <div className="text-center py-16" data-testid="empty-state">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Ready to Explore</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Enter a question above to discover architecture relationships and pathways
                across your enterprise.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
