import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiTrash2, FiChevronDown, FiLoader } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import { useCompassChat, type ChatMessage } from '../hooks/useCompassChat';
import { useCapabilityApi } from '../hooks/useCapability';

interface Vertical {
  id: number;
  name: string;
}

const CompassChat: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedVertical, setSelectedVertical] = useState<string>('');
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [showThinking, setShowThinking] = useState<{ [key: string]: boolean }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoadingVerticals, setIsLoadingVerticals] = useState(true);

  const { dualMessages, isLoading, error, sendDualMessage, clearMessages } = useCompassChat();
  const { listVerticals } = useCapabilityApi();

  // Load verticals on mount
  useEffect(() => {
    const loadVerticals = async () => {
      try {
        setIsLoadingVerticals(true);
        const data = await listVerticals();
        setVerticals(data);
        if (data.length > 0) {
          setSelectedVertical(data[0].name);
        }
      } catch (err) {
        console.error('Failed to load verticals:', err);
        toast.error('Failed to load verticals');
      } finally {
        setIsLoadingVerticals(false);
      }
    };

    loadVerticals();
  }, [listVerticals]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dualMessages]);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!selectedVertical) {
      toast.error('Please select a vertical');
      return;
    }

    await sendDualMessage(query, selectedVertical);
    setQuery('');
  };

  const toggleThinking = (messageId: string, side: 'db' | 'independent') => {
    const key = `${messageId}-${side}`;
    setShowThinking((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const renderMessage = (message: ChatMessage | undefined, messageId: string, side: 'db' | 'independent') => {
    if (!message) {
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg rounded-bl-none shadow-sm p-4 text-center">
          <p className="text-sm text-gray-400">Waiting for response...</p>
        </div>
      );
    }

    const thinkingKey = `${messageId}-${side}`;
    const isThinkingVisible = showThinking[thinkingKey] || false;

    return (
      <div className="space-y-2">
        {/* Thinking Section - Collapsible Dropdown */}
        {message.thinking && (
          <div className="border border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-blue-25 overflow-hidden">
            <button
              onClick={() => toggleThinking(messageId, side)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className={`text-blue-600 transition-transform ${isThinkingVisible ? 'rotate-180' : ''}`}>
                  ▼
                </span>
                <span className="text-sm font-bold text-black-700 group-hover:text-blue-800">
                  LLM Thinking
                </span>
              </div>
              <span className="text-xs text-blue-500">
                {isThinkingVisible ? 'Hide' : 'Show'}
              </span>
            </button>

            {isThinkingVisible && (
              <div className="border-t border-blue-200 px-4 py-4 bg-white">
                <div className="text-sm text-gray-800 leading-relaxed space-y-3">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {message.thinking.split('\n\n').map((paragraph, idx) => (
                      <p key={idx} className="whitespace-pre-wrap break-words mb-3 text-gray-900 font-normal">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Result Section */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-25 border border-gray-200 rounded-lg p-5">

          <div className="text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 leading-7">{children}</p>,
                h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-5 text-gray-900">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-bold mb-3 mt-4 text-gray-900">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3 text-gray-900">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-3 ml-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-3 ml-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="mb-1.5 ml-1">{children}</li>,
                code: ({ inline, children }: any) =>
                  inline ? (
                    <code className="bg-gray-200 px-2 py-1 rounded text-xs font-mono text-gray-900">{children}</code>
                  ) : (
                    <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg mb-3 overflow-x-auto text-xs font-mono border border-gray-700">
                      {children}
                    </code>
                  ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-700 my-3 bg-blue-50 py-2 pr-4 rounded-r">{children}</blockquote>
                ),
                a: ({ href, children }) => (
                  <a href={href} className="text-blue-600 hover:text-blue-700 underline hover:no-underline transition-colors" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <table className="border-collapse border border-gray-300 w-full mb-3 rounded-lg overflow-hidden">{children}</table>
                ),
                tr: ({ children }) => <tr className="border border-gray-300 hover:bg-gray-100">{children}</tr>,
                td: ({ children }) => <td className="border border-gray-300 px-3 py-2">{children}</td>,
                th: ({ children }) => <th className="border border-gray-300 px-3 py-2 bg-gray-200 font-bold text-left">{children}</th>,
                hr: () => <hr className="my-4 border-t border-gray-300" />,
                strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
              }}
            >
              {message.result}
            </ReactMarkdown>
          </div>
        </div>

        {/* Timestamp */}
        <p className="text-xs text-gray-400 text-right px-2">
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Compass Chat</h1>
          </div>
          <button
            onClick={clearMessages}
            disabled={dualMessages.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear chat history"
          >
            <FiTrash2 size={18} />
            <span className="text-sm">Clear</span>
          </button>
        </div>
      </div>

      {/* Messages Container - Two Columns */}
      <div className="flex-1 overflow-y-auto p-4">
        {dualMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Start a Conversation</h2>
              <p className="text-gray-500 max-w-md">
                Select a vertical and ask questions.
              </p>
            </div>
          </div>
        ) : (
          <>
            {dualMessages.map((dualMsg) => (
              <div key={dualMsg.id} className="mb-6">
                {/* User Message */}
                <div className="flex justify-end mb-4">
                  <div className="max-w-2xl rounded-lg p-4 bg-blue-600 text-white rounded-br-none shadow-sm">
                    <div>
                      {dualMsg.userMessage.vertical && (
                        <p className="text-xs opacity-75 mb-2">
                          Vertical: <span className="font-semibold">{dualMsg.userMessage.vertical}</span>
                        </p>
                      )}
                      <p className="text-sm break-words">{dualMsg.userMessage.result}</p>
                    </div>
                  </div>
                </div>

                {/* Two Column Responses */}
                <div className="grid grid-cols-2 gap-4 max-w-6xl">
                  {/* Left Column - With Database Context */}
                  <div className="flex flex-col">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="mb-4 pb-4 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                          <img src="/favicon.png" alt="Compass" className="w-6 h-6" />
                          <h3 className="text-sm font-semibold text-gray-900">
                            Using Capability Compass
                          </h3>
                        </div>
                      </div>
                      {renderMessage(
                        dualMsg.withDbResponse,
                        dualMsg.id,
                        'db'
                      )}
                    </div>
                  </div>

                  {/* Right Column - Independent Thinking */}
                  <div className="flex flex-col">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="mb-4 pb-4 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          Without Capability Compass
                        </h3>
                      </div>
                      {renderMessage(
                        dualMsg.independentResponse,
                        dualMsg.id,
                        'independent'
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="grid grid-cols-2 gap-4 max-w-6xl mt-6">
                <div className="bg-white border border-gray-200 rounded-lg rounded-bl-none shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-600">Analyzing with compass context...</p>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg rounded-bl-none shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-600">Independent analysis...</p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
        <form onSubmit={handleSendMessage} className="space-y-3">
          {/* Vertical Selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Vertical:</label>
            <div className="relative flex-1 max-w-sm">
              <select
                value={selectedVertical}
                onChange={(e) => setSelectedVertical(e.target.value)}
                disabled={isLoadingVerticals || verticals.length === 0}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 appearance-none cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Choose a vertical...</option>
                {verticals.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Message Input */}
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about capabilities, processes, or business operations..."
              disabled={isLoading || !selectedVertical}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={isLoading || !selectedVertical || !query.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <FiLoader className="animate-spin" size={18} />
                  <span className="hidden sm:inline">Analyzing...</span>
                </>
              ) : (
                <>
                  <FiSend size={18} />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-400 mt-2">
          Select a vertical to compare database-driven analysis with independent AI thinking
        </p>
      </div>
    </div>
  );
};

export default CompassChat;
