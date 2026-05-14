'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Flex,
  IconButton,
  Select,
  Input,
  InputGroup,
  InputLeftElement,
  useColorMode,
  useColorModeValue,
  Tooltip,
} from '@chakra-ui/react';
import { FiMenu, FiMessageSquare, FiSearch, FiSun, FiMoon } from 'react-icons/fi';
import NavSidebar from '@/components/NavSidebar';
import ContentArea from '@/components/ContentArea';
import ChatPanel from '@/components/ChatPanel';

export default function HomePage() {
  const [wikis, setWikis] = useState([]);
  const [currentWiki, setCurrentWiki] = useState('');
  const [nav, setNav] = useState(null);
  const [page, setPage] = useState(null);
  const [currentPagePath, setCurrentPagePath] = useState(null);
  const [currentPageMarkdown, setCurrentPageMarkdown] = useState(null);
  const [navOpen, setNavOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const { colorMode, toggleColorMode } = useColorMode();
  const searchTimeout = useRef(null);

  const bgBar = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  useEffect(() => {
    fetch('/api/wikis')
      .then(r => r.json())
      .then(setWikis)
      .catch(() => {});
  }, []);

  async function selectWiki(wikiId) {
    setCurrentWiki(wikiId);
    setPage(null);
    setCurrentPagePath(null);
    setCurrentPageMarkdown(null);
    if (!wikiId) { setNav(null); return; }
    const res = await fetch(`/api/wikis/${wikiId}/nav`);
    const data = await res.json();
    setNav(data);
  }

  async function loadPage(pagePath) {
    const res = await fetch(`/api/wikis/${currentWiki}/page/${pagePath}`);
    if (!res.ok) { setPage({ error: 'Page not found' }); return; }
    const data = await res.json();
    setPage(data);
    setCurrentPagePath(pagePath);
    setCurrentPageMarkdown(data.markdown);
  }

  function handleSearch(q) {
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim() || !currentWiki) { setShowSearch(false); return; }
    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/wikis/${currentWiki}/search?q=${encodeURIComponent(q)}`);
      const results = await res.json();
      setSearchResults(results);
      setShowSearch(true);
    }, 300);
  }

  return (
    <Flex direction="column" h="100vh">
      {/* Top Bar */}
      <Flex
        as="header"
        align="center"
        h="56px"
        px={4}
        gap={3}
        bg={bgBar}
        borderBottom="1px solid"
        borderColor={borderColor}
        flexShrink={0}
        zIndex={10}
        shadow="sm"
      >
        <Tooltip label="Toggle navigation">
          <IconButton
            icon={<FiMenu />}
            aria-label="Toggle nav"
            variant="ghost"
            size="sm"
            onClick={() => setNavOpen(!navOpen)}
          />
        </Tooltip>

        <Select
          size="sm"
          maxW="200px"
          placeholder="— Select Wiki —"
          value={currentWiki}
          onChange={e => selectWiki(e.target.value)}
          fontWeight="500"
        >
          {wikis.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </Select>

        <Box flex={1} maxW="480px" mx="auto" position="relative">
          <InputGroup size="sm">
            <InputLeftElement pointerEvents="none">
              <FiSearch color="gray" />
            </InputLeftElement>
            <Input
              placeholder="Search wiki..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              borderRadius="lg"
            />
          </InputGroup>
          {showSearch && searchResults.length > 0 && (
            <Box
              position="absolute"
              top="100%"
              left={0}
              right={0}
              mt={1}
              bg={bgBar}
              border="1px solid"
              borderColor={borderColor}
              borderRadius="lg"
              shadow="lg"
              maxH="400px"
              overflowY="auto"
              zIndex={100}
            >
              {searchResults.map((r, i) => (
                <Box
                  key={i}
                  px={4}
                  py={2}
                  cursor="pointer"
                  _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
                  borderBottom="1px solid"
                  borderColor={borderColor}
                  onClick={() => { loadPage(r.path); setShowSearch(false); setSearchQuery(''); }}
                >
                  <Box fontWeight="600" fontSize="sm">{r.title}</Box>
                  <Box fontSize="xs" color="gray.500" noOfLines={1}>{r.snippet}</Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Tooltip label="Toggle color mode">
          <IconButton
            icon={colorMode === 'dark' ? <FiSun /> : <FiMoon />}
            aria-label="Toggle color mode"
            variant="ghost"
            size="sm"
            onClick={toggleColorMode}
          />
        </Tooltip>

        <Tooltip label="Toggle AI chat">
          <IconButton
            icon={<FiMessageSquare />}
            aria-label="Toggle chat"
            variant="ghost"
            size="sm"
            onClick={() => setChatOpen(!chatOpen)}
            color={chatOpen ? 'brand.500' : undefined}
          />
        </Tooltip>
      </Flex>

      {/* Main Area */}
      <Flex flex={1} overflow="hidden">
        {navOpen && (
          <NavSidebar nav={nav} onSelectPage={loadPage} currentPage={currentPagePath} />
        )}
        <ContentArea page={page} />
        {chatOpen && (
          <ChatPanel
            wiki={currentWiki}
            currentPage={currentPagePath}
            pageContent={currentPageMarkdown}
          />
        )}
      </Flex>
    </Flex>
  );
}
