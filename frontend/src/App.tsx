import '@mantine/core/styles.css';
import { Container, MantineProvider, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { healthCheckCheck } from './api/generated';

type ApiStatus = 'loading' | 'ok' | 'error';

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('loading');

  useEffect(() => {
    healthCheckCheck()
      .then(({ data }) => setApiStatus(data?.status === 'ok' ? 'ok' : 'error'))
      .catch(() => setApiStatus('error'));
  }, []);

  return (
    <MantineProvider>
      <Container size="sm" py="xl">
        <Title order={1}>Calendar</Title>
        <Text c="dimmed">API: {apiStatus}</Text>
      </Container>
    </MantineProvider>
  );
}
