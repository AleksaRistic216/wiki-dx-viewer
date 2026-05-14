'use client';

import { Box, Heading, Text, useColorModeValue } from '@chakra-ui/react';

export default function ContentArea({ page }) {
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
            borderRadius: 'xl',
            p: 5,
            my: 6,
            overflowX: 'auto',
            fontSize: '13px',
            lineHeight: 1.7,
            border: '1px solid',
            borderColor: useColorModeValue('gray.200', 'gray.600'),
            shadow: 'inner',
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
        }}
      />
    </Box>
  );
}
