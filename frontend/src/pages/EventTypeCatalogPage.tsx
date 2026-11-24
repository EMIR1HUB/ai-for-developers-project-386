import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconClock } from '@tabler/icons-react';
import { errorMessage } from '../api/errors.ts';
import { eventTypesList } from '../api/generated/sdk.gen';
import type { EventType } from '../api/generated/types.gen';
import { useApiQuery } from '../api/useApiQuery.ts';

const SKELETON_CARDS = 3;

function EventTypeCard({ eventType }: { eventType: EventType }) {
  return (
    <Card component="article" withBorder radius="lg" padding="lg" shadow="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap" mb="xs">
        <Title order={3} size="h4">
          {eventType.title}
        </Title>
        <Badge variant="light" color="orange" leftSection={<IconClock size={12} />}>
          {eventType.durationMinutes} мин
        </Badge>
      </Group>
      <Text c="dimmed" size="sm">
        {eventType.description}
      </Text>
    </Card>
  );
}

function EventTypeSkeletons() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} role="status" aria-label="Загрузка типов встреч">
      {Array.from({ length: SKELETON_CARDS }, (_, index) => (
        <Card key={index} withBorder radius="lg" padding="lg">
          <Skeleton height={20} width="60%" mb="sm" />
          <Skeleton height={12} mb={6} />
          <Skeleton height={12} width="80%" />
        </Card>
      ))}
    </SimpleGrid>
  );
}

export function EventTypeCatalogPage() {
  const eventTypes = useApiQuery(
    async () => (await eventTypesList({ throwOnError: true })).data,
    [],
  );

  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="lg">
        Каталог типов встреч
      </Title>
      {eventTypes.status === 'loading' && <EventTypeSkeletons />}
      {eventTypes.status === 'error' && (
        <Alert
          color="red"
          variant="light"
          title="Не удалось загрузить типы встреч"
          icon={<IconAlertCircle />}
        >
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{errorMessage(eventTypes.error)}</Text>
            <Button variant="light" color="red" size="xs" onClick={eventTypes.retry}>
              Повторить
            </Button>
          </Stack>
        </Alert>
      )}
      {eventTypes.status === 'success' && (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {eventTypes.data.map((eventType) => (
            <EventTypeCard key={eventType.id} eventType={eventType} />
          ))}
        </SimpleGrid>
      )}
    </Container>
  );
}
