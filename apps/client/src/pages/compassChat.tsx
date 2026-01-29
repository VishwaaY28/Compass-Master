import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiTrash2, FiChevronDown, FiLoader, FiDownload } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import { useCompassChat, type ChatMessage } from '../hooks/useCompassChat';
import { useCapabilityApi } from '../hooks/useCapability';
import favicon from '../assets/favicon.png';

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

  const exportToPDF = () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      let yPosition = 20;
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const maxWidth = pageWidth - 2 * margin;
      const lineHeight = 7;

      // Helper function to clean and normalize text for PDF export
      const cleanTextForPDF = (text: string): string => {
        if (!text) return '';
        
        // First, decode HTML entities
        const textArea = document.createElement('textarea');
        textArea.innerHTML = text;
        let decoded = textArea.value;
        
        // Remove any remaining HTML entities
        decoded = decoded
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&[a-z]+;/g, ' ')
          // Remove zero-width characters and other invisible characters
          .replace(/[\u200B-\u200D\uFEFF]/g, '')
          // Normalize whitespace but preserve meaningful spaces
          .replace(/\s+/g, ' ')
          .trim();
        
        return decoded;
      };

      // Helper function to safely split text for PDF
      const splitTextSafely = (text: string, width: number): string[] => {
        const cleanedText = cleanTextForPDF(text);
        
        // Use jsPDF's splitTextToSize but with better handling
        try {
          const lines = pdf.splitTextToSize(cleanedText, width);
          // Ensure we don't have weird character splitting
          return lines.map((line: string) => {
            // If a line has excessive spaces/weird formatting, rejoin it
            if (line.length > 2 && line.split(' ').some((word: string) => word.length === 1 && word !== 'a' && word !== 'I')) {
              // This looks like character-by-character splitting, try to fix it
              return line.split(' ').filter((w: string) => w.length > 0).join(' ');
            }
            return line;
          });
        } catch (e) {
          console.warn('Error splitting text, returning as single line', e);
          return [cleanedText];
        }
      };

      // Title
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('Compass Chat Export', margin, yPosition);
      yPosition += 15;

      // Timestamp
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100);
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, margin, yPosition);
      yPosition += 12;

      // Add separator line
      pdf.setDrawColor(200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;

      // Add messages
      dualMessages.forEach((dualMsg, msgIndex) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = 20;
        }

        // User message
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('You:', margin, yPosition);
        yPosition += 7;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(50);
        const userLines = splitTextSafely(dualMsg.userMessage.result, maxWidth);
        pdf.text(userLines, margin + 5, yPosition);
        yPosition += userLines.length * lineHeight + 3;

        if (dualMsg.userMessage.vertical) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(120);
          pdf.text(`Vertical: ${cleanTextForPDF(dualMsg.userMessage.vertical)}`, margin + 5, yPosition);
          yPosition += 7;
        }

        yPosition += 5;

        // DB Response
        if (dualMsg.withDbResponse) {
          if (yPosition > pageHeight - 30) {
            pdf.addPage();
            yPosition = 20;
          }

          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 102, 204);
          pdf.text('Using Capability Compass', margin + 5, yPosition);
          yPosition += 7;

          if (dualMsg.withDbResponse.thinking) {
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(59, 130, 246);
            pdf.text('Thinking Process:', margin + 10, yPosition);
            yPosition += 6;

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80);
            const thinkingLines = splitTextSafely(dualMsg.withDbResponse.thinking, maxWidth - 10);
            
            // Handle page breaks for long thinking content
            for (let i = 0; i < thinkingLines.length; i++) {
              if (yPosition > pageHeight - 15) {
                pdf.addPage();
                yPosition = 20;
              }
              pdf.text(thinkingLines[i], margin + 10, yPosition);
              yPosition += lineHeight - 1;
            }
            yPosition += 3;
          }

          if (dualMsg.withDbResponse.result) {
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(5, 150, 105);
            pdf.text('Analysis:', margin + 10, yPosition);
            yPosition += 6;

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80);
            const resultLines = splitTextSafely(dualMsg.withDbResponse.result, maxWidth - 10);
            
            // Handle page breaks for long result content
            for (let i = 0; i < resultLines.length; i++) {
              if (yPosition > pageHeight - 15) {
                pdf.addPage();
                yPosition = 20;
              }
              pdf.text(resultLines[i], margin + 10, yPosition);
              yPosition += lineHeight - 1;
            }
            yPosition += 3;
          }

          yPosition += 5;
        }

        // Independent Response
        if (dualMsg.independentResponse) {
          if (yPosition > pageHeight - 30) {
            pdf.addPage();
            yPosition = 20;
          }

          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(139, 92, 246);
          pdf.text('Without Capability Compass', margin + 5, yPosition);
          yPosition += 7;

          if (dualMsg.independentResponse.thinking) {
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(59, 130, 246);
            pdf.text('Thinking Process:', margin + 10, yPosition);
            yPosition += 6;

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80);
            const thinkingLines = splitTextSafely(dualMsg.independentResponse.thinking, maxWidth - 10);
            
            // Handle page breaks for long thinking content
            for (let i = 0; i < thinkingLines.length; i++) {
              if (yPosition > pageHeight - 15) {
                pdf.addPage();
                yPosition = 20;
              }
              pdf.text(thinkingLines[i], margin + 10, yPosition);
              yPosition += lineHeight - 1;
            }
            yPosition += 3;
          }

          if (dualMsg.independentResponse.result) {
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(5, 150, 105);
            pdf.text('Analysis:', margin + 10, yPosition);
            yPosition += 6;

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80);
            const resultLines = splitTextSafely(dualMsg.independentResponse.result, maxWidth - 10);
            
            // Handle page breaks for long result content
            for (let i = 0; i < resultLines.length; i++) {
              if (yPosition > pageHeight - 15) {
                pdf.addPage();
                yPosition = 20;
              }
              pdf.text(resultLines[i], margin + 10, yPosition);
              yPosition += lineHeight - 1;
            }
            yPosition += 3;
          }
        }

        // Message separator
        yPosition += 8;
        if (msgIndex < dualMessages.length - 1) {
          pdf.setDrawColor(230);
          pdf.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 8;
        }
      });

      // Save PDF
      pdf.save(`compass-chat-${new Date().toLocaleString()}.pdf`);
      toast.success('Chat exported to PDF successfully!');
    } catch (err) {
      console.error('Failed to export PDF:', err);
      toast.error('Failed to export chat to PDF');
    }
  };

  const renderMessage = (message: ChatMessage | undefined, messageId: string, side: 'db' | 'independent') => {
    if (!message) {
      return (
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-blue-50 to-blue-25 border border-blue-200 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <FiLoader className="animate-spin text-blue-600" size={16} />
              <p className="text-sm text-gray-600 font-medium">
                {side === 'db' ? 'LLM answering using Capability Compass context...' : 'LLM answering without using Capability Compass context...'}
              </p>
            </div>
          </div>
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
<span className="text-sm font-bold text-black-700 group-hover:text-blue-800">
                  LLM Response
                </span>
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
                    <code className="text-gray-900 font-semibold">{children}</code>
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
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
           {/* <img src={favicon} width={40} height={40} alt="favicon" /> */}
          <div>
              <h1 className="text-xl font-semibold">Compass Chat</h1>
               <p className="text-xs text-muted-foreground">
                  Resolve Your Organizational Queries
               </p>
          </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToPDF}
              disabled={dualMessages.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export chat to PDF"
            >
              <FiDownload size={18} />
              <span className="text-sm">Export PDF</span>
            </button>
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

            {/* Loading Indicator - Show only if there are no messages (first request) */}
            {isLoading && dualMessages.length === 0 && (
              <div className="grid grid-cols-2 gap-4 max-w-6xl mt-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-25 border border-blue-200 rounded-lg shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <FiLoader className="animate-spin text-blue-600" size={18} />
                    <p className="text-sm text-gray-700 font-medium">LLM answering using Capability Compass context...</p>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-purple-25 border border-purple-200 rounded-lg shadow-sm p-4">
                  <div className="flex items-center gap-2">
                    <FiLoader className="animate-spin text-purple-600" size={18} />
                    <p className="text-sm text-gray-700 font-medium">LLM answering without using Capability Compass context...</p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 md:p-5">
        <form onSubmit={handleSendMessage}>
          <div className="max-w-4xl mx-auto">
            {/* Main Input Container */}
            <div className="relative bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-lg hover:border-gray-300 transition-all duration-200 focus-within:shadow-xl focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 flex items-center">
              {/* Vertical Selector - Left Side */}
              <div className="flex items-center h-full px-4 border-r border-gray-200">
                <div className="relative">
                  <select
                    value={selectedVertical}
                    onChange={(e) => setSelectedVertical(e.target.value)}
                    disabled={isLoadingVerticals || verticals.length === 0}
                    className="appearance-none bg-transparent text-gray-900 font-medium cursor-pointer pr-6 focus:outline-none text-sm md:text-base min-w-max hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select Vertical</option>
                    {verticals.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <FiChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-sm" />
                </div>
              </div>

              {/* Input Field - Left Start */}
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={selectedVertical ? "Ask about capabilities, processes, or business operations..." : "Select a vertical to start..."}
                disabled={isLoading || !selectedVertical}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isLoading && selectedVertical && query.trim()) {
                    handleSendMessage(e as any);
                  }
                }}
                className="w-full px-4 py-4 pl-4 pr-16 bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none text-sm md:text-base disabled:placeholder-gray-300 disabled:cursor-not-allowed"
              />

              {/* Send Button - Right Side */}
              <button
                type="submit"
                disabled={isLoading || !selectedVertical || !query.trim()}
                className="px-4 py-2 text-gray-400 hover:text-blue-600 disabled:text-gray-300 disabled:hover:text-gray-300 transition-colors duration-200 disabled:cursor-not-allowed hover:bg-blue-50 rounded-lg mr-2"
                title={isLoading ? "Analyzing..." : "Send message (Enter)"}
              >
                {isLoading ? (
                  <FiLoader className="animate-spin" size={20} />
                ) : (
                  <FiSend size={20} className={`${!selectedVertical || !query.trim() ? 'opacity-50' : 'opacity-100'}`} />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompassChat;
