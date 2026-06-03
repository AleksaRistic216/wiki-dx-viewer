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
  Button,
  Badge,
  Spinner,
  useColorModeValue,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  HStack,
} from '@chakra-ui/react';
import { FiSend, FiTrash2, FiSquare, FiRefreshCw, FiCpu } from 'react-icons/fi';

const GITHUB_MODELS = [
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

const RECOMMENDED_OLLAMA_MODELS = [
  { id: 'llama3.1:8b', label: 'Llama 3.1 8B', size: '4.7 GB' },
  { id: 'mistral:7b', label: 'Mistral 7B', size: '4.1 GB' },
  { id: 'gemma2:9b', label: 'Gemma 2 9B', size: '5.4 GB' },
  { id: 'qwen2.5:7b', label: 'Qwen 2.5 7B', size: '4.4 GB' },
  { id: 'deepseek-r1:8b', label: 'DeepSeek R1 8B', size: '4.9 GB' },
];

function ModelPicker({ source, model, onSelect }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [ollamaModels, setOllamaModels] = useState([]);
  const [ollamaError, setOllamaError] = useState(null);
  const [loadingOllama, setLoadingOllama] = useState(false);
  const [pulling, setPulling] = useState(null);
  const [pullProgress, setPullProgress] = useState('');

  const btnBg = useColorModeValue('gray.100', 'gray.700');

  const fetchOllamaModels = async () => {
    setLoadingOllama(true);
    setOllamaError(null);
    try {
      const res = await fetch('/api/ollama');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOllamaModels(data.models || []);
    } catch (err) {
      setOllamaError(err.message);
      setOllamaModels([]);
    }
    setLoadingOllama(false);
  };

  useEffect(() => {
    if (isOpen) fetchOllamaModels();
  }, [isOpen]);

  const handlePull = async (modelId) => {
    setPulling(modelId);
    setPullProgress('Starting download...');
    try {
      const res = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', model: modelId }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj.status) setPullProgress(obj.status);
          } catch {}
        }
      }
      setPullProgress('Done!');
      await fetchOllamaModels();
    } catch (err) {
      setPullProgress(`Error: ${err.message}`);
    }
    setTimeout(() => { setPulling(null); setPullProgress(''); }, 2000);
  };

  const shortLabel = source === 'ollama' ? model.split(':')[0] : model;

  return (
    <>
      <Button
        size="xs"
        variant="ghost"
        leftIcon={<FiCpu />}
        onClick={onOpen}
        bg={btnBg}
        borderRadius="md"
        maxW="130px"
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
        title={`${source}: ${model}`}
      >
        {shortLabel}
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="md">Model Settings</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Tabs defaultIndex={source === 'ollama' ? 1 : 0}>
              <TabList>
                <Tab fontSize="sm">GitHub Models</Tab>
                <Tab fontSize="sm">Ollama (Local)</Tab>
              </TabList>
              <TabPanels>
                <TabPanel px={0}>
                  <VStack align="stretch" spacing={1}>
                    {GITHUB_MODELS.map(m => (
                      <Button
                        key={m.id}
                        size="sm"
                        variant={source === 'github' && model === m.id ? 'solid' : 'ghost'}
                        colorScheme={source === 'github' && model === m.id ? 'blue' : 'gray'}
                        justifyContent="flex-start"
                        onClick={() => { onSelect('github', m.id); onClose(); }}
                      >
                        {m.label}
                      </Button>
                    ))}
                  </VStack>
                </TabPanel>
                <TabPanel px={0}>
                  {loadingOllama && <Spinner size="sm" />}
                  {ollamaError && (
                    <Text fontSize="sm" color="red.400">
                      Ollama not available: {ollamaError}
                    </Text>
                  )}
                  {!loadingOllama && !ollamaError && (
                    <VStack align="stretch" spacing={3}>
                      {ollamaModels.length > 0 && (
                        <Box>
                          <Text fontSize="xs" fontWeight="bold" mb={1} color="gray.500">INSTALLED</Text>
                          <VStack align="stretch" spacing={1}>
                            {ollamaModels.map(m => (
                              <Button
                                key={m.id}
                                size="sm"
                                variant={source === 'ollama' && model === m.id ? 'solid' : 'ghost'}
                                colorScheme={source === 'ollama' && model === m.id ? 'green' : 'gray'}
                                justifyContent="flex-start"
                                onClick={() => { onSelect('ollama', m.id); onClose(); }}
                              >
                                <HStack justify="space-between" w="100%">
                                  <Text>{m.id}</Text>
                                  <Badge fontSize="xs" colorScheme="gray">{(m.size / 1e9).toFixed(1)} GB</Badge>
                                </HStack>
                              </Button>
                            ))}
                          </VStack>
                        </Box>
                      )}
                      <Box>
                        <Text fontSize="xs" fontWeight="bold" mb={1} color="gray.500">RECOMMENDED</Text>
                        <VStack align="stretch" spacing={1}>
                          {RECOMMENDED_OLLAMA_MODELS.map(m => {
                            const installed = ollamaModels.some(om => om.id === m.id || om.id.startsWith(m.id.split(':')[0]));
                            return (
                              <HStack key={m.id} justify="space-between">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  justifyContent="flex-start"
                                  flex={1}
                                  isDisabled={!installed}
                                  onClick={() => { if (installed) { onSelect('ollama', m.id); onClose(); } }}
                                >
                                  {m.label} <Badge ml={2} fontSize="xs">{m.size}</Badge>
                                </Button>
                                {!installed && (
                                  <Button
                                    size="xs"
                                    colorScheme="blue"
                                    isLoading={pulling === m.id}
                                    onClick={() => handlePull(m.id)}
                                  >
                                    Pull
                                  </Button>
                                )}
                                {installed && <Badge colorScheme="green" fontSize="xs">✓</Badge>}
                              </HStack>
                            );
                          })}
                        </VStack>
                        {pullProgress && (
                          <Text fontSize="xs" mt={2} color="blue.300">{pullProgress}</Text>
                        )}
                      </Box>
                    </VStack>
                  )}
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

export default function ChatPanel({ wiki, currentPage, pageContent, onNavigate, onPageEdited }) {
  const storageKey = `chat:${wiki || ''}`;

  const [source, setSource] = useState(() => {
    if (typeof window === 'undefined') return 'github';
    return localStorage.getItem('chat:source') || 'github';
  });
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
      // Strip transient status field before persisting
      const toSave = messages.map(({ status, ...rest }) => rest);
      localStorage.setItem(storageKeyRef.current, JSON.stringify(toSave));
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
          source,
        }),
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedText = '';
      let edited = false;
      let statusText = '';

      // Add a placeholder assistant message that will be updated
      setMessages(prev => [...prev, { role: 'assistant', content: '', status: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'token';
        for (let li = 0; li < lines.length; li++) {
          const line = lines[li];
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
            continue;
          }
          if (!line.startsWith('data: ')) {
            if (line.trim() === '') currentEvent = 'token';
            continue;
          }

          const eventType = currentEvent;
          currentEvent = 'token'; // reset after consuming

          try {
            const data = JSON.parse(line.slice(6));

            if (eventType === 'status') {
              statusText = data.text;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, status: statusText };
                }
                return updated;
              });
            } else if (eventType === 'token') {
              streamedText += data.token;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: streamedText, status: '' };
                }
                return updated;
              });
            } else if (eventType === 'done') {
              edited = !!data.edited;
              if (data.reply && data.reply !== '__streamed__') {
                streamedText = data.reply;
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, content: streamedText, status: '' };
                  }
                  return updated;
                });
              } else {
                // Clear status on completion
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, status: '' };
                  }
                  return updated;
                });
              }
              if (edited && onPageEdited) {
                onPageEdited();
              }
            } else if (eventType === 'error') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: `⚠️ ${data.error}`, status: '' };
                }
                return updated;
              });
            }
          } catch {
            // skip malformed data
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: '⏹️ Request cancelled.', status: '' };
          } else {
            updated.push({ role: 'assistant', content: '⏹️ Request cancelled.' });
          }
          return updated;
        });
      } else {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: `⚠️ ${err.message}`, status: '' };
          } else {
            updated.push({ role: 'assistant', content: `⚠️ ${err.message}` });
          }
          return updated;
        });
      }
    }
    abortControllerRef.current = null;
    setLoading(false);
  }

  async function resend() {
    if (loading) return;
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
          source,
        }),
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedText = '';
      let edited = false;

      setMessages(prev => [...prev, { role: 'assistant', content: '', status: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'token';
        for (let li = 0; li < lines.length; li++) {
          const line = lines[li];
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
            continue;
          }
          if (!line.startsWith('data: ')) {
            if (line.trim() === '') currentEvent = 'token';
            continue;
          }

          const eventType = currentEvent;
          currentEvent = 'token';

          try {
            const data = JSON.parse(line.slice(6));
            if (eventType === 'status') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, status: data.text };
                }
                return updated;
              });
            } else if (eventType === 'token') {
              streamedText += data.token;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: streamedText, status: '' };
                }
                return updated;
              });
            } else if (eventType === 'done') {
              edited = !!data.edited;
              if (data.reply && data.reply !== '__streamed__') {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, content: data.reply, status: '' };
                  }
                  return updated;
                });
              } else {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, status: '' };
                  }
                  return updated;
                });
              }
              if (edited && onPageEdited) {
                onPageEdited();
              }
            } else if (eventType === 'error') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: `⚠️ ${data.error}`, status: '' };
                }
                return updated;
              });
            }
          } catch {
            // skip malformed data
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: '⏹️ Request cancelled.', status: '' };
          } else {
            updated.push({ role: 'assistant', content: '⏹️ Request cancelled.' });
          }
          return updated;
        });
      } else {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: `⚠️ ${err.message}`, status: '' };
          } else {
            updated.push({ role: 'assistant', content: `⚠️ ${err.message}` });
          }
          return updated;
        });
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
      .replace(/\[([^\]]+)\]\(([^)]+\.md)\)/g, (_, text, href) => {
        const colonIdx = href.indexOf(':');
        if (colonIdx > 0 && !href.startsWith('/') && !href.includes('//')) {
          const wikiId = href.slice(0, colonIdx);
          const page = href.slice(colonIdx + 1);
          return `<a href="#" class="chat-wiki-link" data-wiki="${wikiId}" data-page="${page}">${text}</a>`;
        }
        return `<a href="#" class="chat-wiki-link" data-page="${href}">${text}</a>`;
      })
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
          <ModelPicker
            source={source}
            model={model}
            onSelect={(newSource, newModel) => {
              setSource(newSource);
              setModel(newModel);
              localStorage.setItem('chat:source', newSource);
              localStorage.setItem('chat:model', newModel);
            }}
          />
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
            const linkWiki = link.dataset.wiki;
            if (page && onNavigate) onNavigate(page, linkWiki || null);
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
              sx={{
                'pre': { bg: 'gray.800', color: 'gray.100', p: 3, borderRadius: 'md', my: 2, overflowX: 'auto', fontSize: '12px' },
                'code': { fontSize: '0.85em' },
                '.chat-wiki-link': { color: 'brand.400', cursor: 'pointer', textDecoration: 'underline', _hover: { color: 'brand.300' } },
              }}
            >
              {m.content && (
                <Box dangerouslySetInnerHTML={{ __html: renderContent(m.content) }} />
              )}
              {m.status && (
                <Text fontSize="xs" color="gray.500" fontStyle="italic" mt={m.content ? 2 : 0}>
                  ⏳ {m.status}
                </Text>
              )}
              {m.role === 'assistant' && !m.content && !m.status && loading && i === messages.length - 1 && (
                <Text fontSize="sm" color="gray.500" fontStyle="italic">Connecting...</Text>
              )}
            </Box>
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
