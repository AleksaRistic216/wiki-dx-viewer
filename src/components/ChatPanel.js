'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  Textarea,
  IconButton,
  Text,
  VStack,
  Select,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiSend, FiTrash2, FiSquare, FiRefreshCw } from 'react-icons/fi';

const AVAILABLE_MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'o4-mini', label: 'o4-mini' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { id: 'claude-opus-4', label: 'Claude Opus 4' },
  { id: 'claude-haiku-3.5', label: 'Claude Haiku 3.5' },
];

export default function ChatPanel({ wiki, currentPage, pageContent, onNavigate, onPageEdited }) {
  const storageKey = `chat:${wiki || ''}:${currentPage || ''}`;

  const [model, setModel] = useState(() => {
    if (typeof window === 'undefined') return 'gpt-4o';
    return localStorage.getItem('chat:model') || 'gpt-4o';
  });

  const [messages, setMessages] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const storageKeyRef = useRef(storageKey);
  const abortControllerRef = useRef(null);

  // Reload messages when wiki/page changes
  useEffect(() => {
    storageKeyRef.current = storageKey;
    try {
      const saved = localStorage.getItem(storageKey);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch { setMessages([]); }
  }, [storageKey]);

  // Persist messages on change only (storageKey tracked via ref to avoid
  // firing this effect when the key changes — which would write stale
  // messages from the previous page into the new page's slot)
  useEffect(() => {
    try {
      localStorage.setItem(storageKeyRef.current, JSON.stringify(messages));
    } catch {}
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const userBubble = useColorModeValue('brand.50', 'brand.900');
  const botBubble = useColorModeValue('green.50', 'gray.700');
  const exampleHoverBg = useColorModeValue('gray.50', 'gray.700');
  const exampleHoverColor = useColorModeValue('gray.700', 'gray.200');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function abort() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    const newMessages = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          wiki,
          currentPage,
          pageContent,
          enableEditing: true,
          model,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.error) {
        setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${data.error}` }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
        if (data.edited && onPageEdited) {
          onPageEdited();
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages([...newMessages, { role: 'assistant', content: '⏹️ Request cancelled.' }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${err.message}` }]);
      }
    }
    abortControllerRef.current = null;
    setLoading(false);
  }

  async function resend() {
    if (loading) return;
    // Find the last user message and remove the assistant reply after it
    const lastAssistantIdx = messages.length - 1;
    if (lastAssistantIdx < 1 || messages[lastAssistantIdx].role !== 'assistant') return;

    const messagesWithoutLastReply = messages.slice(0, lastAssistantIdx);
    setMessages(messagesWithoutLastReply);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesWithoutLastReply,
          wiki,
          currentPage,
          pageContent,
          enableEditing: true,
          model,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.error) {
        setMessages([...messagesWithoutLastReply, { role: 'assistant', content: `⚠️ ${data.error}` }]);
      } else {
        setMessages([...messagesWithoutLastReply, { role: 'assistant', content: data.reply }]);
        if (data.edited && onPageEdited) {
          onPageEdited();
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages([...messagesWithoutLastReply, { role: 'assistant', content: '⏹️ Request cancelled.' }]);
      } else {
        setMessages([...messagesWithoutLastReply, { role: 'assistant', content: `⚠️ ${err.message}` }]);
      }
    }
    abortControllerRef.current = null;
    setLoading(false);
  }

  function renderContent(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+\.md)\)/g, '<a href="#" class="chat-wiki-link" data-page="$2">$1</a>')
      .replace(/\n/g, '<br>');
  }

  return (
    <Flex
      direction="column"
      w="380px"
      minW="380px"
      h="100%"
      bg={bg}
      borderLeft="1px solid"
      borderColor={borderColor}
    >
      {/* Header */}
      <Flex align="center" justify="space-between" px={4} py={3} borderBottom="1px solid" borderColor={borderColor}>
        <Heading size="xs" fontWeight="600">🤖 Copilot Chat</Heading>
        <Flex align="center" gap={1}>
          <Select
            size="xs"
            w="130px"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              localStorage.setItem('chat:model', e.target.value);
            }}
            borderRadius="md"
          >
            {AVAILABLE_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </Select>
          {messages.length > 0 && (
            <IconButton
              icon={<FiTrash2 />}
              aria-label="Clear chat"
              size="xs"
              variant="ghost"
              colorScheme="red"
              onClick={() => setMessages([])}
            />
          )}
        </Flex>
      </Flex>

      {/* Messages */}
      <VStack
        flex={1}
        overflow="auto"
        p={4}
        spacing={3}
        align="stretch"
        onClick={(e) => {
          const link = e.target.closest('.chat-wiki-link');
          if (link) {
            e.preventDefault();
            const page = link.dataset.page;
            if (page && onNavigate) onNavigate(page);
          }
        }}
      >
        {messages.length === 0 && (
          <Box textAlign="center" py={8} px={4}>
            <Text fontSize="sm" color="gray.500" mb={4}>
              Ask anything about this wiki — I can search across all pages in the current section.
            </Text>
            <VStack spacing={2} align="stretch">
              {[
                'Find me the article about code review process',
                'Summarize what this page is about',
                'Fix the typo in the first paragraph',
              ].map((example, idx) => (
                <Box
                  key={idx}
                  px={3}
                  py={2}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor={borderColor}
                  cursor="pointer"
                  fontSize="13px"
                  color="gray.500"
                  _hover={{ bg: exampleHoverBg, color: exampleHoverColor }}
                  onClick={() => { setInput(example); }}
                >
                  &ldquo;{example}&rdquo;
                </Box>
              ))}
            </VStack>
          </Box>
        )}
        {messages.map((m, i) => (
          <Box key={i} alignSelf={m.role === 'user' ? 'flex-end' : 'flex-start'} maxW="90%">
            <Box
              bg={m.role === 'user' ? userBubble : botBubble}
              px={4}
              py={3}
              borderRadius="xl"
              borderBottomRightRadius={m.role === 'user' ? 'sm' : 'xl'}
              borderBottomLeftRadius={m.role === 'assistant' ? 'sm' : 'xl'}
              fontSize="14px"
              lineHeight="1.6"
              dangerouslySetInnerHTML={{ __html: renderContent(m.content) }}
              sx={{
                'pre': { bg: 'gray.800', color: 'gray.100', p: 3, borderRadius: 'md', my: 2, overflowX: 'auto', fontSize: '12px' },
                'code': { fontSize: '0.85em' },
                '.chat-wiki-link': { color: 'brand.400', cursor: 'pointer', textDecoration: 'underline', _hover: { color: 'brand.300' } },
              }}
            />
            {m.role === 'user' && i === messages.length - 2 && messages[messages.length - 1]?.role === 'assistant' && !loading && (
              <IconButton
                icon={<FiRefreshCw />}
                aria-label="Retry"
                size="xs"
                variant="ghost"
                colorScheme="gray"
                mt={1}
                alignSelf="flex-end"
                onClick={resend}
              />
            )}
          </Box>
        ))}
        {loading && (
          <Box alignSelf="flex-start" maxW="90%" bg={botBubble} px={4} py={3} borderRadius="xl" borderBottomLeftRadius="sm">
            <Text fontSize="sm" color="gray.500" fontStyle="italic">Thinking...</Text>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </VStack>

      {/* Input */}
      <Flex p={3} gap={2} borderTop="1px solid" borderColor={borderColor}>
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask about this wiki section..."
          size="sm"
          rows={2}
          resize="none"
          borderRadius="lg"
        />
        <IconButton
          icon={loading ? <FiSquare /> : <FiSend />}
          aria-label={loading ? 'Stop' : 'Send'}
          colorScheme={loading ? 'red' : 'brand'}
          size="sm"
          alignSelf="flex-end"
          onClick={loading ? abort : send}
        />
      </Flex>
    </Flex>
  );
}
