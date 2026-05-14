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
  useColorModeValue,
} from '@chakra-ui/react';
import { FiSend } from 'react-icons/fi';

export default function ChatPanel({ wiki, currentPage, pageContent, onNavigate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const userBubble = useColorModeValue('brand.50', 'brand.900');
  const botBubble = useColorModeValue('green.50', 'gray.700');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    const newMessages = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          wiki,
          currentPage,
          pageContent,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${data.error}` }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      }
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    }
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
      <Flex align="center" px={4} py={3} borderBottom="1px solid" borderColor={borderColor}>
        <Heading size="xs" fontWeight="600">🤖 Copilot Chat</Heading>
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
          <Box textAlign="center" py={8}>
            <Text fontSize="sm" color="gray.500">
              Ask anything about the current wiki page.
            </Text>
          </Box>
        )}
        {messages.map((m, i) => (
          <Box
            key={i}
            alignSelf={m.role === 'user' ? 'flex-end' : 'flex-start'}
            maxW="90%"
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
          placeholder="Ask about this wiki..."
          size="sm"
          rows={2}
          resize="none"
          borderRadius="lg"
        />
        <IconButton
          icon={<FiSend />}
          aria-label="Send"
          colorScheme="brand"
          size="sm"
          alignSelf="flex-end"
          onClick={send}
          isLoading={loading}
        />
      </Flex>
    </Flex>
  );
}
