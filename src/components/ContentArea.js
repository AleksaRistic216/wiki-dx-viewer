'use client';

import { Box, Heading, Text, useColorModeValue } from '@chakra-ui/react';

export default function ContentArea({ page }) {
  const bg = useColorModeValue('gray.50', 'gray.900');
  const contentBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  if (!page) {
    return (
      <Box flex={1} overflow="auto" bg={bg} display="flex" alignItems="center" justifyContent="center">
        <Box textAlign="center" p={10}>
          <Heading size="2xl" mb={4}>📚</Heading>
          <Heading size="lg" mb={2} fontWeight="600">Wiki DX Viewer</Heading>
          <Text color="gray.500" fontSize="lg">Select a wiki from the dropdown to get started.</Text>
        </Box>
      </Box>
    );
  }

  if (page.error) {
    return (
      <Box flex={1} overflow="auto" bg={bg} display="flex" alignItems="center" justifyContent="center">
        <Box textAlign="center" p={10}>
          <Heading size="md" color="red.400">Page not found</Heading>
          <Text color="gray.500" mt={2}>{page.error}</Text>
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
        borderRadius="xl"
        border="1px solid"
        borderColor={borderColor}
        p={{ base: 6, md: 10 }}
        shadow="sm"
        className="wiki-content"
        dangerouslySetInnerHTML={{ __html: page.html }}
        sx={{
          'h1': { fontSize: '2em', fontWeight: '700', mb: 4, pb: 3, borderBottom: '2px solid', borderColor: borderColor },
          'h2': { fontSize: '1.5em', fontWeight: '600', mt: 8, mb: 3 },
          'h3': { fontSize: '1.25em', fontWeight: '600', mt: 6, mb: 2 },
          'h4': { fontSize: '1.1em', fontWeight: '600', mt: 5, mb: 2 },
          'p': { my: 3, lineHeight: 1.8 },
          'ul, ol': { my: 3, pl: 6, lineHeight: 1.8 },
          'li': { my: 1 },
          'pre': {
            bg: useColorModeValue('gray.900', 'gray.950'),
            color: 'gray.100',
            borderRadius: 'lg',
            p: 4,
            my: 4,
            overflowX: 'auto',
            fontSize: '13px',
            border: '1px solid',
            borderColor: useColorModeValue('gray.200', 'gray.600'),
          },
          'code': { fontFamily: 'mono', fontSize: '0.88em' },
          ':not(pre) > code': {
            bg: useColorModeValue('gray.100', 'gray.700'),
            px: 1.5,
            py: 0.5,
            borderRadius: 'md',
            fontSize: '0.85em',
          },
          'a': { color: 'brand.500', textDecoration: 'none', _hover: { textDecoration: 'underline' } },
          'table': { w: '100%', my: 4, fontSize: '14px', borderCollapse: 'collapse' },
          'th, td': { border: '1px solid', borderColor: borderColor, px: 3, py: 2, textAlign: 'left' },
          'th': { bg: useColorModeValue('gray.50', 'gray.700'), fontWeight: '600' },
          'blockquote': {
            borderLeft: '4px solid',
            borderColor: 'brand.400',
            pl: 4,
            py: 2,
            my: 4,
            color: 'gray.500',
            bg: useColorModeValue('brand.50', 'gray.800'),
            borderRadius: '0 8px 8px 0',
          },
          'img': { maxW: '100%', borderRadius: 'lg', my: 3 },
          'hr': { my: 6, borderColor: borderColor },
        }}
      />
    </Box>
  );
}
