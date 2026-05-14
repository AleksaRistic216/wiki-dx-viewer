'use client';

import { useEffect } from 'react';
import { Box, Heading, Text, useColorModeValue } from '@chakra-ui/react';

export default function ContentArea({ page }) {
  useEffect(() => {
    if (!page?.html) return;
    const container = document.querySelector('.wiki-content');
    if (!container) return;

    const handleTabClick = (e) => {
      const btn = e.target.closest('.wiki-tab-btn');
      if (!btn) return;
      const group = btn.dataset.tabGroup;
      const index = btn.dataset.tabIndex;

      container.querySelectorAll(`.wiki-tab-btn[data-tab-group="${group}"]`).forEach(b => b.classList.remove('active'));
      container.querySelectorAll(`.wiki-tab-panel[data-tab-group="${group}"]`).forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      container.querySelector(`.wiki-tab-panel[data-tab-group="${group}"][data-tab-index="${index}"]`)?.classList.add('active');
    };

    container.addEventListener('click', handleTabClick);
    return () => container.removeEventListener('click', handleTabClick);
  }, [page?.html]);
  const bg = useColorModeValue('gray.50', 'gray.900');
  const contentBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtleBg = useColorModeValue('gray.50', 'gray.750');

  if (!page) {
    return (
      <Box flex={1} overflow="auto" bg={bg} display="flex" alignItems="center" justifyContent="center">
        <Box textAlign="center" p={10} opacity={0.8}>
          <Heading size="2xl" mb={4}>📚</Heading>
          <Heading size="lg" mb={2} fontWeight="600">Wiki DX Viewer</Heading>
          <Text color="gray.500" fontSize="md">Select a wiki from the dropdown to get started.</Text>
        </Box>
      </Box>
    );
  }

  if (page.error) {
    return (
      <Box flex={1} overflow="auto" bg={bg} display="flex" alignItems="center" justifyContent="center">
        <Box
          textAlign="center"
          p={8}
          bg={contentBg}
          borderRadius="xl"
          border="1px solid"
          borderColor="red.200"
          shadow="sm"
        >
          <Heading size="md" color="red.400" mb={2}>Page not found</Heading>
          <Text color="gray.500" fontSize="sm">{page.error}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flex={1} overflow="auto" bg={bg} p={{ base: 4, md: 8 }}>
      <Box
        maxW="860px"
        mx="auto"
        bg={contentBg}
        borderRadius="2xl"
        border="1px solid"
        borderColor={borderColor}
        px={{ base: 5, md: 10 }}
        py={{ base: 6, md: 8 }}
        shadow="xs"
        className="wiki-content"
        dangerouslySetInnerHTML={{ __html: page.html }}
        sx={{
          'h1': {
            fontSize: '2em',
            fontWeight: '700',
            mb: 5,
            pb: 4,
            borderBottom: '1px solid',
            borderColor: borderColor,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          },
          'h2': {
            fontSize: '1.5em',
            fontWeight: '600',
            mt: 10,
            mb: 4,
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
          },
          'h3': {
            fontSize: '1.2em',
            fontWeight: '600',
            mt: 8,
            mb: 3,
            lineHeight: 1.4,
          },
          'h4': {
            fontSize: '1.05em',
            fontWeight: '600',
            mt: 6,
            mb: 2,
            color: useColorModeValue('gray.700', 'gray.300'),
          },
          'p': {
            my: 4,
            lineHeight: 1.8,
            color: useColorModeValue('gray.700', 'gray.300'),
          },
          'ul, ol': {
            my: 4,
            pl: 6,
            lineHeight: 1.8,
            color: useColorModeValue('gray.700', 'gray.300'),
          },
          'li': { my: 1.5 },
          'li::marker': { color: useColorModeValue('gray.400', 'gray.500') },
          'pre': {
            bg: useColorModeValue('gray.900', 'gray.950'),
            color: 'gray.100',
            borderRadius: '0',
            px: { base: 5, md: 10 },
            py: 5,
            mx: { base: -5, md: -10 },
            my: 6,
            overflowX: 'auto',
            fontSize: '13px',
            lineHeight: 1.7,
            borderTop: '1px solid',
            borderBottom: '1px solid',
            borderColor: useColorModeValue('gray.200', 'gray.600'),
          },
          'code': { fontFamily: 'mono', fontSize: '0.87em' },
          ':not(pre) > code': {
            bg: useColorModeValue('gray.100', 'gray.700'),
            color: useColorModeValue('brand.700', 'brand.200'),
            px: 1.5,
            py: 0.5,
            borderRadius: 'md',
            fontSize: '0.84em',
            fontWeight: '500',
          },
          'a': {
            color: 'brand.500',
            textDecoration: 'none',
            fontWeight: '500',
            transition: 'color 0.15s',
            _hover: { color: 'brand.600', textDecoration: 'underline' },
          },
          'table': {
            w: '100%',
            my: 6,
            fontSize: '14px',
            borderCollapse: 'collapse',
            borderRadius: 'lg',
            overflow: 'hidden',
            border: '1px solid',
            borderColor: borderColor,
          },
          'th, td': {
            borderBottom: '1px solid',
            borderColor: borderColor,
            px: 4,
            py: 3,
            textAlign: 'left',
          },
          'th': {
            bg: useColorModeValue('gray.50', 'gray.700'),
            fontWeight: '600',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: useColorModeValue('gray.600', 'gray.300'),
          },
          'tr:last-child td': { borderBottom: 'none' },
          'tr:hover td': { bg: useColorModeValue('gray.25', 'gray.750') },
          'blockquote': {
            borderLeft: '3px solid',
            borderColor: 'brand.400',
            pl: 5,
            py: 3,
            my: 6,
            color: useColorModeValue('gray.600', 'gray.400'),
            bg: useColorModeValue('brand.50', 'whiteAlpha.50'),
            borderRadius: '0 12px 12px 0',
            fontStyle: 'italic',
          },
          'img': {
            maxW: '100%',
            borderRadius: 'xl',
            my: 6,
            border: '1px solid',
            borderColor: borderColor,
          },
          'hr': {
            my: 8,
            border: 'none',
            borderTop: '1px solid',
            borderColor: borderColor,
          },
          '& > *:first-child': { mt: 0 },
          '& > *:last-child': { mb: 0 },
          '.wiki-tabs': {
            my: 6,
            borderRadius: 'xl',
            border: '1px solid',
            borderColor: borderColor,
            overflow: 'hidden',
          },
          '.wiki-tabs-nav': {
            display: 'flex',
            gap: 0,
            bg: useColorModeValue('gray.100', 'gray.700'),
            borderBottom: '1px solid',
            borderColor: borderColor,
          },
          '.wiki-tab-btn': {
            px: 5,
            py: 2.5,
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            border: 'none',
            bg: 'transparent',
            color: useColorModeValue('gray.600', 'gray.400'),
            borderBottom: '2px solid transparent',
            transition: 'all 0.15s',
            _hover: {
              color: useColorModeValue('gray.800', 'gray.200'),
              bg: useColorModeValue('gray.200', 'gray.600'),
            },
          },
          '.wiki-tab-btn.active': {
            color: 'brand.500',
            borderBottomColor: 'brand.500',
            bg: useColorModeValue('white', 'gray.800'),
          },
          '.wiki-tab-panel': {
            display: 'none',
            p: 5,
          },
          '.wiki-tab-panel.active': {
            display: 'block',
          },
        }}
      />
    </Box>
  );
}
