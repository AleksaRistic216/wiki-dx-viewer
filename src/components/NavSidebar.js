'use client';

import { useState } from 'react';
import {
  Box,
  Text,
  Icon,
  Collapse,
  useColorModeValue,
  VStack,
} from '@chakra-ui/react';
import { FiChevronDown, FiChevronRight, FiFileText } from 'react-icons/fi';

function NavItem({ title, pagePath, onSelect, isActive }) {
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  const activeBg = useColorModeValue('brand.50', 'brand.900');
  const activeColor = useColorModeValue('brand.700', 'brand.200');

  return (
    <Box
      as="button"
      display="flex"
      alignItems="center"
      gap={2}
      w="100%"
      textAlign="left"
      px={3}
      py={1.5}
      borderRadius="md"
      fontSize="13px"
      bg={isActive ? activeBg : 'transparent'}
      color={isActive ? activeColor : undefined}
      fontWeight={isActive ? '600' : '400'}
      _hover={{ bg: isActive ? activeBg : hoverBg }}
      transition="all 0.15s"
      onClick={() => onSelect(pagePath)}
    >
      <Icon as={FiFileText} boxSize={3} opacity={0.6} />
      <Text noOfLines={1}>{title}</Text>
    </Box>
  );
}

function NavFolder({ title, children, onSelect, currentPage, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  const folderColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Box>
      <Box
        as="button"
        display="flex"
        alignItems="center"
        gap={2}
        w="100%"
        textAlign="left"
        px={3}
        py={2}
        borderRadius="md"
        fontSize="12px"
        fontWeight="700"
        textTransform="uppercase"
        letterSpacing="0.5px"
        color={folderColor}
        _hover={{ bg: hoverBg, color: useColorModeValue('gray.800', 'gray.200') }}
        transition="all 0.15s"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon as={isOpen ? FiChevronDown : FiChevronRight} boxSize={3} />
        <Text>{title}</Text>
      </Box>
      <Collapse in={isOpen} animateOpacity>
        <Box pl={3} borderLeft="2px solid" borderColor={useColorModeValue('gray.200', 'gray.600')} ml={3}>
          <NavTree nav={children} onSelect={onSelect} currentPage={currentPage} />
        </Box>
      </Collapse>
    </Box>
  );
}

function NavTree({ nav, onSelect, currentPage, depth = 0 }) {
  if (!nav || !Array.isArray(nav)) return null;

  return (
    <VStack align="stretch" spacing={0}>
      {nav.map((item, i) => {
        if (typeof item === 'string') {
          const title = item.replace(/\.md$/, '').replace(/\//g, ' / ').replace(/-/g, ' ');
          return (
            <NavItem
              key={i}
              title={title}
              pagePath={item}
              onSelect={onSelect}
              isActive={currentPage === item}
            />
          );
        }
        if (typeof item === 'object') {
          return Object.entries(item).map(([title, value]) => {
            if (typeof value === 'string') {
              return (
                <NavItem
                  key={`${i}-${title}`}
                  title={title}
                  pagePath={value}
                  onSelect={onSelect}
                  isActive={currentPage === value}
                />
              );
            }
            if (Array.isArray(value)) {
              return (
                <NavFolder
                  key={`${i}-${title}`}
                  title={title}
                  children={value}
                  onSelect={onSelect}
                  currentPage={currentPage}
                  defaultOpen={depth === 0}
                />
              );
            }
            return null;
          });
        }
        return null;
      })}
    </VStack>
  );
}

export default function NavSidebar({ nav, onSelectPage, currentPage }) {
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box
      w="280px"
      minW="280px"
      h="100%"
      overflowY="auto"
      bg={bg}
      borderRight="1px solid"
      borderColor={borderColor}
      py={4}
      px={2}
      css={{
        '&::-webkit-scrollbar': { width: '6px' },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.15)', borderRadius: '3px' },
      }}
    >
      {nav ? (
        <NavTree nav={nav.nav} onSelect={onSelectPage} currentPage={currentPage} />
      ) : (
        <Box px={3} py={4}>
          <Text fontSize="sm" color="gray.500">Select a wiki to browse.</Text>
        </Box>
      )}
    </Box>
  );
}
