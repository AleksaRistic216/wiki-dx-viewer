'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Text,
  VStack,
  Badge,
  useColorModeValue,
  useToast,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverHeader,
  PopoverCloseButton,
  Divider,
} from '@chakra-ui/react';
import { FiInfo, FiCopy } from 'react-icons/fi';

const MAX_LOGS = 200;
const MAX_NETWORK = 100;

const APP_VERSION = '2.0.0';

// Global log stores (persist across re-renders)
const consoleLogs = [];
const networkLogs = [];
let interceptInstalled = false;

function installIntercepts() {
  if (interceptInstalled || typeof window === 'undefined') return;
  interceptInstalled = true;

  // Intercept console methods
  const methods = ['log', 'warn', 'error', 'info', 'debug'];
  for (const method of methods) {
    const original = console[method];
    console[method] = (...args) => {
      consoleLogs.push({
        level: method,
        time: new Date().toISOString(),
        message: args.map(a => {
          try {
            return typeof a === 'object' ? JSON.stringify(a, null, 0) : String(a);
          } catch { return String(a); }
        }).join(' '),
      });
      if (consoleLogs.length > MAX_LOGS) consoleLogs.shift();
      original.apply(console, args);
    };
  }

  // Intercept fetch for network logging
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || String(input);
    const method = init?.method || 'GET';
    const startTime = Date.now();
    const entry = {
      method,
      url,
      time: new Date().toISOString(),
      status: null,
      duration: null,
      error: null,
      requestBody: null,
      responseBody: null,
    };

    // Capture request body for API calls
    if (init?.body && url.startsWith('/api')) {
      try {
        const body = typeof init.body === 'string' ? init.body : null;
        if (body) {
          const parsed = JSON.parse(body);
          // Truncate large fields
          if (parsed.pageContent && parsed.pageContent.length > 200) {
            parsed.pageContent = parsed.pageContent.slice(0, 200) + '...[truncated]';
          }
          if (parsed.messages) {
            parsed.messages = parsed.messages.map(m => ({
              role: m.role,
              content: m.content?.length > 200 ? m.content.slice(0, 200) + '...' : m.content,
            }));
          }
          entry.requestBody = JSON.stringify(parsed);
        }
      } catch { /* ignore */ }
    }

    try {
      const res = await originalFetch(input, init);
      entry.status = res.status;
      entry.duration = Date.now() - startTime;

      // Capture response body for API errors
      if (url.startsWith('/api') && !res.ok) {
        try {
          const clone = res.clone();
          const text = await clone.text();
          entry.responseBody = text.length > 500 ? text.slice(0, 500) + '...' : text;
        } catch { /* ignore */ }
      }

      networkLogs.push(entry);
      if (networkLogs.length > MAX_NETWORK) networkLogs.shift();
      return res;
    } catch (err) {
      entry.error = err.message;
      entry.duration = Date.now() - startTime;
      networkLogs.push(entry);
      if (networkLogs.length > MAX_NETWORK) networkLogs.shift();
      throw err;
    }
  };
}

export default function DiagnosticsPanel() {
  const toast = useToast();
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    installIntercepts();
  }, []);

  const copyLogs = useCallback(() => {
    const sections = [];

    sections.push(`=== Wiki DX Viewer Diagnostics ===`);
    sections.push(`Version: ${APP_VERSION}`);
    sections.push(`Time: ${new Date().toISOString()}`);
    sections.push(`URL: ${window.location.href}`);
    sections.push(`UserAgent: ${navigator.userAgent}`);
    sections.push('');

    sections.push(`=== Console Logs (last ${consoleLogs.length}) ===`);
    for (const log of consoleLogs) {
      sections.push(`[${log.time}] [${log.level.toUpperCase()}] ${log.message}`);
    }
    sections.push('');

    sections.push(`=== Network Requests (last ${networkLogs.length}) ===`);
    for (const req of networkLogs) {
      let line = `[${req.time}] ${req.method} ${req.url} → ${req.status || 'ERR'} (${req.duration}ms)`;
      if (req.error) line += ` ERROR: ${req.error}`;
      sections.push(line);
      if (req.requestBody) sections.push(`  Request: ${req.requestBody}`);
      if (req.responseBody) sections.push(`  Response: ${req.responseBody}`);
    }

    const text = sections.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Diagnostics copied to clipboard', status: 'success', duration: 2000, isClosable: true });
    }).catch(() => {
      toast({ title: 'Failed to copy', status: 'error', duration: 2000, isClosable: true });
    });
  }, [toast]);

  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <IconButton
          icon={<FiInfo />}
          aria-label="Diagnostics"
          variant="ghost"
          size="sm"
        />
      </PopoverTrigger>
      <PopoverContent w="320px" bg={bg} borderColor={borderColor}>
        <PopoverCloseButton />
        <PopoverHeader fontWeight="600" fontSize="sm">
          Diagnostics
        </PopoverHeader>
        <PopoverBody>
          <VStack align="stretch" spacing={3}>
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" color="gray.500">Version</Text>
              <Badge colorScheme="blue" fontSize="xs">{APP_VERSION}</Badge>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" color="gray.500">Console logs</Text>
              <Text fontSize="xs">{consoleLogs.length} captured</Text>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" color="gray.500">Network requests</Text>
              <Text fontSize="xs">{networkLogs.length} captured</Text>
            </Flex>
            <Divider />
            <Button
              leftIcon={<FiCopy />}
              size="sm"
              colorScheme="blue"
              onClick={copyLogs}
            >
              Copy all logs to clipboard
            </Button>
            <Text fontSize="xs" color="gray.500">
              Copies version info, last {MAX_LOGS} console logs, and last {MAX_NETWORK} network requests.
            </Text>
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
