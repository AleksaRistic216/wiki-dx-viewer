'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Flex,
  IconButton,
  Select,
  Input,
  InputGroup,
  InputLeftElement,
  Button,
  Badge,
  HStack,
  useColorMode,
  useColorModeValue,
  Tooltip,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Link,
  Text,
} from '@chakra-ui/react';
import { FiMenu, FiMessageSquare, FiSearch, FiSun, FiMoon, FiRefreshCw, FiEdit2, FiGitBranch } from 'react-icons/fi';
import NavSidebar from '@/components/NavSidebar';
import ContentArea from '@/components/ContentArea';
import ChatPanel from '@/components/ChatPanel';

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const params = useParams();
  const toast = useToast();

  // Parse wiki and page from URL path: /wiki/page/subpage/...
  const slug = params.slug || [];
  const urlWiki = slug[0] || '';
  const urlPage = slug.length > 1 ? slug.slice(1).join('/') : null;

  const [wikis, setWikis] = useState([]);
  const [currentWiki, setCurrentWiki] = useState(urlWiki);
  const [nav, setNav] = useState(null);
  const [page, setPage] = useState(null);
  const [currentPagePath, setCurrentPagePath] = useState(urlPage);
  const [currentPageMarkdown, setCurrentPageMarkdown] = useState(null);
  const [navOpen, setNavOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { colorMode, toggleColorMode } = useColorMode();
  const searchTimeout = useRef(null);
  const initialLoadDone = useRef(false);

  // Editing session state
  const [editSession, setEditSession] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [prUrl, setPrUrl] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  const bgBar = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const searchHoverBg = useColorModeValue('gray.100', 'gray.700');

  // Check editing session status on mount
  useEffect(() => {
    fetch('/api/edit/status')
      .then(r => r.json())
      .then(data => {
        if (data.active) setEditSession(data);
      })
      .catch(() => {});
  }, []);

  async function startEditing() {
    setEditLoading(true);
    try {
      const res = await fetch('/api/edit/start', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEditSession(data);
      toast({ title: 'Editing session started', description: `Branch: ${data.branch}`, status: 'success', duration: 3000 });
    } catch (err) {
      toast({ title: 'Failed to start editing', description: err.message, status: 'error', duration: 5000 });
    }
    setEditLoading(false);
  }

  async function discardEditing() {
    setEditLoading(true);
    try {
      const res = await fetch('/api/edit/discard', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEditSession(null);
      setEditing(false);
      toast({ title: 'Editing session discarded', status: 'info', duration: 3000 });
    } catch (err) {
      toast({ title: 'Failed to discard', description: err.message, status: 'error', duration: 5000 });
    }
    setEditLoading(false);
  }

  async function completeEditing() {
    setEditLoading(true);
    try {
      const res = await fetch('/api/edit/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitMessage: commitMessage || undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEditSession(null);
      setEditing(false);
      setPrUrl(data.prUrl);
      setShowCompleteModal(false);
      setCommitMessage('');
      toast({ title: 'PR created!', description: data.prUrl, status: 'success', duration: 10000 });
    } catch (err) {
      toast({ title: 'Failed to complete', description: err.message, status: 'error', duration: 5000 });
    }
    setEditLoading(false);
  }

  function startPageEdit() {
    if (!editSession) {
      startEditing().then(() => {
        setEditing(true);
        setEditContent(currentPageMarkdown || '');
      });
    } else {
      setEditing(true);
      setEditContent(currentPageMarkdown || '');
    }
  }

  async function savePageEdit() {
    setEditSaving(true);
    try {
      const res = await fetch('/api/edit/save-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wiki: currentWiki, pagePath: currentPagePath, content: editContent }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEditing(false);
      setCurrentPageMarkdown(editContent);
      loadPage(currentPagePath);
      toast({ title: 'Page saved', status: 'success', duration: 2000 });
    } catch (err) {
      toast({ title: 'Failed to save', description: err.message, status: 'error', duration: 5000 });
    }
    setEditSaving(false);
  }

  function cancelPageEdit() {
    setEditing(false);
    setEditContent('');
  }

  const updateUrl = useCallback((wiki, pagePath) => {
    let path = '/';
    if (wiki) {
      path = `/${wiki}`;
      if (pagePath) path += `/${pagePath}`;
    }
    window.history.replaceState(null, '', path);
  }, []);

  useEffect(() => {
    fetch('/api/wikis')
      .then(r => r.json())
      .then(setWikis)
      .catch(() => {});
  }, []);

  // Restore state from URL on initial load
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    if (urlWiki) {
      fetch(`/api/wikis/${urlWiki}/nav`)
        .then(r => r.json())
        .then(data => {
          setNav(data);
          if (urlPage) {
            fetch(`/api/wikis/${urlWiki}/page/${urlPage}`)
              .then(r => r.ok ? r.json() : null)
              .then(pageData => {
                if (pageData) {
                  setPage(pageData);
                  setCurrentPageMarkdown(pageData.markdown);
                }
              });
          }
        })
        .catch(() => {});
    }
  }, [urlWiki, urlPage]);

  async function selectWiki(wikiId) {
    setCurrentWiki(wikiId);
    setPage(null);
    setCurrentPagePath(null);
    setCurrentPageMarkdown(null);
    updateUrl(wikiId, null);
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
    updateUrl(currentWiki, pagePath);
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
                  _hover={{ bg: searchHoverBg }}
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

        {/* Editing session controls / Sync button */}
        {editSession ? (
          <HStack spacing={2}>
            <Badge colorScheme="purple" variant="subtle" px={2} py={1} borderRadius="md" fontSize="xs">
              <HStack spacing={1}>
                <FiGitBranch />
                <Text>{editSession.branch}</Text>
              </HStack>
            </Badge>
            <Button
              size="xs"
              colorScheme="red"
              variant="outline"
              onClick={discardEditing}
              isLoading={editLoading}
            >
              Discard
            </Button>
            <Button
              size="xs"
              colorScheme="green"
              onClick={() => setShowCompleteModal(true)}
              isLoading={editLoading}
            >
              Complete
            </Button>
          </HStack>
        ) : (
          <HStack spacing={1}>
            {prUrl && (
              <Link href={prUrl} isExternal fontSize="xs" color="green.500" fontWeight="600" mr={2}>
                PR ↗
              </Link>
            )}
            <Tooltip label="Start editing session">
              <IconButton
                icon={<FiEdit2 />}
                aria-label="Start editing"
                variant="ghost"
                size="sm"
                isLoading={editLoading}
                onClick={startEditing}
              />
            </Tooltip>
            <Tooltip label="Sync wiki branch">
              <IconButton
                icon={<FiRefreshCw />}
                aria-label="Sync wiki branch"
                variant="ghost"
                size="sm"
                isLoading={syncing}
                onClick={async () => {
                  setSyncing(true);
                  try {
                    await fetch('/api/sync', { method: 'POST' });
                  } catch {}
                  setSyncing(false);
                }}
              />
            </Tooltip>
          </HStack>
        )}

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
        <ContentArea
          page={page}
          editing={editing}
          editContent={editContent}
          onEditContentChange={setEditContent}
          onSave={savePageEdit}
          onCancelEdit={cancelPageEdit}
          editSaving={editSaving}
          editSession={editSession}
          onStartEdit={startPageEdit}
          hasPage={!!currentPagePath}
        />
        {chatOpen && (
          <ChatPanel
            wiki={currentWiki}
            currentPage={currentPagePath}
            pageContent={currentPageMarkdown}
            onNavigate={loadPage}
          />
        )}
      </Flex>

      {/* Complete editing modal */}
      <Modal isOpen={showCompleteModal} onClose={() => setShowCompleteModal(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Complete Editing Session</ModalHeader>
          <ModalBody>
            <Text mb={3} fontSize="sm" color="gray.500">
              This will commit all changes, push the branch, and create a PR.
            </Text>
            <Input
              placeholder="Commit message (optional)"
              value={commitMessage}
              onChange={e => setCommitMessage(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setShowCompleteModal(false)}>Cancel</Button>
            <Button colorScheme="green" onClick={completeEditing} isLoading={editLoading}>
              Create PR
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
}
