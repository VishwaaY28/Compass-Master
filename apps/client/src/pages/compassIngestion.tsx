import React, { useState, useRef } from 'react';
import {
  FiUpload,
  FiFile,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
  FiChevronDown,
} from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';

interface ExtractedCapabilityModel {
  id?: number;
  name: string;
  description: string;
  vertical: string;
  subvertical?: string;
  processes: ExtractedProcess[];
}

interface ExtractedProcess {
  id?: number;
  name: string;
  level: string;
  description: string;
  category?: string;
  subprocesses: ExtractedSubProcess[];
}

interface ExtractedSubProcess {
  id?: number;
  name: string;
  description: string;
  category?: string;
  data_entities?: unknown[];
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'extracting' | 'success' | 'error';
  progress: number;
  error?: string;
  extractedData?: ExtractedCapabilityModel;
}

interface ExtractionEvent {
  status: 'started' | 'loading' | 'extracting' | 'success' | 'error';
  progress?: number;
  message?: string;
  data?: ExtractedCapabilityModel;
  output_path?: string;
  filename?: string;
  error?: string;
  type?: string;
}

const CompassIngestion: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // removed expanded collapse UI in favor of modal popup
  const [importingFileId, setImportingFileId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalData, setModalData] = useState<ExtractedCapabilityModel | null>(null);
  const [modalFileId, setModalFileId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [thinkingMessage, setThinkingMessage] = useState<string>("");

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles) {
      handleFiles(droppedFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (fileList: FileList) => {
    const newFiles: UploadedFile[] = [];
    Array.from(fileList).forEach((file) => {
      const id = `${Date.now()}-${Math.random()}`;
      newFiles.push({
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending',
        progress: 0,
      });
    });
    setFiles((prev) => [...newFiles, ...prev]);
    toast.success(`${newFiles.length} file(s) added`);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const removeAllFiles = () => {
    setFiles([]);
  };


  /**
   * Upload file and stream extraction results back from server
   */
  const uploadAndExtractFile = async (file: UploadedFile) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === file.id ? { ...f, status: 'uploading', progress: 10 } : f
      )
    );

    const fileInputElement = fileInputRef.current;
    if (!fileInputElement || !fileInputElement.files) return;

    const formData = new FormData();
    
    // Find the actual file from the input element
    let actualFile: File | null = null;
    for (const f of fileInputElement.files) {
      if (f.name === file.name && f.size === file.size) {
        actualFile = f;
        break;
      }
    }
    
    if (!actualFile) return;
    
    formData.append('file', actualFile);

    try {
      const response = await fetch('/api/upload/pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      // Stream the JSONL response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Process complete lines
        for (let i = 0; i < lines.length - 1; i++) {
          if (lines[i].trim()) {
            try {
              const event: ExtractionEvent = JSON.parse(lines[i]);
              handleExtractionEvent(file.id, event);
                  // show agent thinking when extracting
                  if (event.status === 'extracting') {
                    setIsThinking(true);
                    if (event.message) setThinkingMessage(event.message);
                  }
                  // when success open modal popup with the extracted data
                  if (event.status === 'success' && event.data) {
                    setIsThinking(false);
                    setThinkingMessage('');
                    setModalData(event.data);
                    setModalFileId(file.id);
                    setShowModal(true);
                  }
            } catch (e) {
              console.error('Failed to parse event:', e);
            }
          }
        }

        // Keep incomplete line in buffer
        buffer = lines[lines.length - 1];
      }

      // Process any remaining data
      if (buffer.trim()) {
        try {
          const event: ExtractionEvent = JSON.parse(buffer);
          handleExtractionEvent(file.id, event);
        } catch (e) {
          console.error('Failed to parse final event:', e);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error occurred';
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? { ...f, status: 'error', error: errorMsg }
            : f
        )
      );
      toast.error(`Upload failed: ${errorMsg}`);
    }
  };

  const handleExtractionEvent = (
    fileId: string,
    event: ExtractionEvent
  ) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;

        switch (event.status) {
          case 'started':
            return { ...f, status: 'uploading', progress: 5 };

          case 'loading':
            return {
              ...f,
              status: 'extracting',
              progress: Math.min(event.progress || 30, 50),
            };

          case 'extracting':
            return {
              ...f,
              status: 'extracting',
              progress: Math.min(event.progress || 60, 95),
            };

          case 'success':
            if (event.data) {
              toast.success(`Extraction successful: ${f.name}`);
              // store the extracted data in file state; UI will show modal popup
              return {
                ...f,
                status: 'success',
                progress: 100,
                extractedData: event.data,
              };
            }
            return f;

          case 'error':
            toast.error(`Extraction failed: ${event.error}`);
            return { ...f, status: 'error', error: event.error };

          default:
            return f;
        }
      })
    );
  };

  const handleUploadAll = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) {
      toast.error('No files to upload');
      return;
    }

    setIsProcessing(true);
    try {
      await Promise.all(pendingFiles.map((f) => uploadAndExtractFile(f)));
    } catch (error) {
      console.error('Batch upload error:', error);
      toast.error('Failed to upload some files');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Import extracted model to graph database
   */
  const handleImportToGraph = async (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file || !file.extractedData) {
      toast.error('No extracted data to import');
      return;
    }

    setImportingFileId(fileId);
    try {
      const response = await fetch('/api/upload/import-to-graph', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_data: file.extractedData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Import failed');
      }

      const result = await response.json();
      toast.success('Successfully imported to graph database!');
      
      // Show import summary
      const summary = result.summary;
      console.log('Import Summary:', summary);
      toast.success(
        `Created ${summary.processes_created} processes with ${summary.subprocesses_created} subprocesses`,
        { duration: 4000 }
      );
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Import failed';
      toast.error(errorMsg);
      console.error('Import error:', error);
    } finally {
      setImportingFileId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container px-6 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-semibold">Compass Ingestion</h1>
              <p className="text-xs text-muted-foreground">
                Upload documents for AI-powered capability extraction and graph database import
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-6 grid lg:grid-cols-3 gap-6 px-6 max-w-7xl">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200 ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50'
              }`}
            >
              <div className="flex flex-col items-center">
                <div className="mb-4 p-3 bg-indigo-100 rounded-full">
                  <FiUpload className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {isDragging ? 'Drop files here' : 'Drag and drop your documents'}
                </h3>
                <p className="text-gray-600 mb-4">
                  Upload PDFs, Word documents, or text files for extraction
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Select Files
                </button>
                <p className="text-xs text-gray-500 mt-4">
                  Supported: PDF, DOCX, TXT (Max 100MB per file)
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
                accept=".pdf,.docx,.doc,.txt"
              />
            </div>

            {files.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-4 gap-3 mb-6">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {pendingCount}
                    </p>
                    <p className="text-sm text-gray-600">Pending</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">
                      {files.filter(
                        (f) => f.status === 'uploading' || f.status === 'extracting'
                      ).length}
                    </p>
                    <p className="text-sm text-gray-600">Processing</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{successCount}</p>
                    <p className="text-sm text-gray-600">Extracted</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                    <p className="text-sm text-gray-600">Failed</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleUploadAll}
                    disabled={pendingCount === 0 || isProcessing}
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <FiUpload size={18} />
                    Extract {pendingCount > 0 ? `${pendingCount} File(s)` : 'Files'}
                  </button>
                  <button
                    onClick={removeAllFiles}
                    disabled={isProcessing}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Files ({files.length})
            </h3>

            {files.length === 0 ? (
              <div className="text-center py-8">
                <FiFile className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No files selected</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden hover:bg-gray-100 transition-colors"
                  >
                    <div className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <FiFile className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {file.extractedData && (
                            <button
                              onClick={() => {
                                setModalData(file.extractedData || null);
                                setModalFileId(file.id);
                                setShowModal(true);
                              }}
                              className="p-1 hover:bg-gray-300 rounded transition-colors"
                              title="Show details"
                            >
                              <FiChevronDown className="w-4 h-4 text-gray-600" />
                            </button>
                          )}
                          {file.status !== 'uploading' &&
                            file.status !== 'extracting' && (
                              <button
                                onClick={() => removeFile(file.id)}
                                className="p-1 hover:bg-gray-300 rounded transition-colors"
                                title="Remove file"
                              >
                                <FiX className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                              </button>
                            )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        {file.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                            Pending
                          </span>
                        )}
                        {file.status === 'uploading' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                            <FiLoader className="w-3 h-3 animate-spin" />
                            Uploading
                          </span>
                        )}
                        {file.status === 'extracting' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                            <FiLoader className="w-3 h-3 animate-spin" />
                            Extracting ({file.progress}%)
                          </span>
                        )}
                        {file.status === 'success' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                            <FiCheckCircle className="w-3 h-3" />
                            Extracted
                          </span>
                        )}
                        {file.status === 'error' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                            <FiAlertCircle className="w-3 h-3" />
                            Error
                          </span>
                        )}
                      </div>

                      {(file.status === 'uploading' ||
                        file.status === 'extracting') && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      )}

                      {file.error && (
                        <p className="text-xs text-red-600 mt-2">{file.error}</p>
                      )}

                      {file.status === 'success' && file.extractedData && (
                        <button
                          onClick={() => handleImportToGraph(file.id)}
                          disabled={importingFileId === file.id}
                          className="mt-3 w-full px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {importingFileId === file.id ? (
                            <>
                              <FiLoader size={12} className="animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <FiUpload size={12} />
                              Import to Graph
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Extracted Data Details */}
                      {/* details are shown in modal popup now */}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Agent thinking overlay */}
      {isThinking && (
        <div className="fixed top-4 right-4 z-50 bg-white/90 backdrop-blur rounded-lg shadow px-4 py-2 flex items-center gap-3">
          <FiLoader className="animate-spin w-5 h-5 text-indigo-600" />
          <div className="text-sm text-gray-700">Thinking... {thinkingMessage}</div>
        </div>
      )}

      {/* Modal for extracted result */}
      {showModal && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-11/12 max-w-3xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Extracted Capability</h3>
                <p className="text-sm text-gray-500">{modalData.name}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-800">Close</button>
            </div>

            <div className="space-y-3 text-sm text-gray-700">
              <div>
                <p className="font-semibold">Description</p>
                <p>{modalData.description || 'N/A'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold">Vertical</p>
                  <p>{modalData.vertical}</p>
                </div>
                <div>
                  <p className="font-semibold">SubVertical</p>
                  <p>{modalData.subvertical || 'N/A'}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">Processes ({modalData.processes.length})</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {modalData.processes.map((proc, idx) => (
                    <div key={idx} className="p-2 border rounded">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{proc.name}</p>
                        <p className="text-xs text-gray-500">{proc.level}</p>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{proc.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{(proc.subprocesses || []).length} subprocesses</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  if (modalFileId) handleImportToGraph(modalFileId);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Import to Graph
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompassIngestion;
