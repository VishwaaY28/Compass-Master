import { useState, useCallback, useRef, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  type: 'user' | 'agent';
  thinking?: string;
  result: string;
  timestamp: string; // Store as string for JSON serialization
  vertical?: string;
}

export interface DualColumnMessage {
  id: string;
  userMessage: ChatMessage;
  withDbResponse?: ChatMessage;
  independentResponse?: ChatMessage;
}

export interface UseCompassChatReturn {
  messages: ChatMessage[];
  dualMessages: DualColumnMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (query: string, vertical: string) => Promise<void>;
  sendDualMessage: (query: string, vertical: string) => Promise<void>;
  clearMessages: () => void;
  removeMessage: (id: string) => void;
}

const COMPASS_CHAT_STORAGE_KEY = 'compass_chat_messages';
const COMPASS_DUAL_CHAT_STORAGE_KEY = 'compass_dual_chat_messages';
const COMPASS_MESSAGE_COUNT_KEY = 'compass_message_count';

export const useCompassChat = (): UseCompassChatReturn => {
  // Initialize state from localStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(COMPASS_CHAT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  const [dualMessages, setDualMessages] = useState<DualColumnMessage[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(COMPASS_DUAL_CHAT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messageCountRef = useRef(0);

  // Initialize message count from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(COMPASS_MESSAGE_COUNT_KEY);
      messageCountRef.current = stored ? parseInt(stored, 10) : 0;
    }
  }, []);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(COMPASS_CHAT_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Persist dual messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(COMPASS_DUAL_CHAT_STORAGE_KEY, JSON.stringify(dualMessages));
    }
  }, [dualMessages]);

  // Persist message count to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(COMPASS_MESSAGE_COUNT_KEY, messageCountRef.current.toString());
    }
  });

  const sendMessage = useCallback(
    async (query: string, vertical: string) => {
      if (!query.trim() || !vertical) {
        setError('Query and vertical are required');
        return;
      }

      const messageId = `msg-${++messageCountRef.current}`;
      setIsLoading(true);
      setError(null);

      try {
        // Add user message immediately
        const userMessage: ChatMessage = {
          id: `user-${messageId}`,
          type: 'user',
          result: query,
          timestamp: new Date().toISOString(),
          vertical,
        };
        setMessages((prev) => [...prev, userMessage]);

        // Call the Compass Chat API
        const response = await fetch('/api/chat/compass', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            vertical,
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.detail || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data = await response.json();

        // Add agent response with thinking and result
        const agentMessage: ChatMessage = {
          id: `agent-${messageId}`,
          type: 'agent',
          thinking: data.thinking,
          result: data.result,
          timestamp: new Date().toISOString(),
          vertical,
        };
        setMessages((prev) => [...prev, agentMessage]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        console.error('[useCompassChat] Error:', errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const sendDualMessage = useCallback(
    async (query: string, vertical: string) => {
      if (!query.trim() || !vertical) {
        setError('Query and vertical are required');
        return;
      }

      const messageId = `msg-${++messageCountRef.current}`;
      setIsLoading(true);
      setError(null);

      try {
        // Add user message immediately
        const userMessage: ChatMessage = {
          id: `user-${messageId}`,
          type: 'user',
          result: query,
          timestamp: new Date().toISOString(),
          vertical,
        };
        
        const dualMessage: DualColumnMessage = {
          id: messageId,
          userMessage,
        };
        
        setDualMessages((prev) => [...prev, dualMessage]);

        // Send both requests in parallel
        const [withDbResponse, independentResponse] = await Promise.all([
          // Request WITH database context
          fetch('/api/chat/compass', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query,
              vertical,
              temperature: 0.7,
              max_tokens: 2000,
            }),
          }),
          // Request WITHOUT database context (independent thinking)
          fetch('/api/chat/compass/independent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query,
              vertical,
              temperature: 0.7,
              max_tokens: 2000,
            }),
          }),
        ]);

        if (!withDbResponse.ok) {
          const errorData = await withDbResponse.json();
          throw new Error(
            errorData.detail || `HTTP ${withDbResponse.status}: ${withDbResponse.statusText}`
          );
        }

        if (!independentResponse.ok) {
          const errorData = await independentResponse.json();
          throw new Error(
            errorData.detail || `HTTP ${independentResponse.status}: ${independentResponse.statusText}`
          );
        }

        const withDbData = await withDbResponse.json();
        const independentData = await independentResponse.json();

        // Create agent messages for both responses
        const withDbMessage: ChatMessage = {
          id: `agent-with-db-${messageId}`,
          type: 'agent',
          thinking: withDbData.thinking,
          result: withDbData.result,
          timestamp: new Date().toISOString(),
          vertical,
        };

        const independentAgentMessage: ChatMessage = {
          id: `agent-independent-${messageId}`,
          type: 'agent',
          thinking: independentData.thinking,
          result: independentData.result,
          timestamp: new Date().toISOString(),
          vertical,
        };

        // Update dual message with both responses
        setDualMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  withDbResponse: withDbMessage,
                  independentResponse: independentAgentMessage,
                }
              : msg
          )
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        console.error('[useCompassChat] Error:', errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setDualMessages([]);
    setError(null);
    messageCountRef.current = 0;
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
    setDualMessages((prev) => prev.filter((msg) => msg.id !== id));
  }, []);

  return {
    messages,
    dualMessages,
    isLoading,
    error,
    sendMessage,
    sendDualMessage,
    clearMessages,
    removeMessage,
  };
};
