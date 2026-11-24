import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconClock } from '@tabler/icons-react';
import { useId } from 'react';
import { errorMessage } from '../../api/errors.ts';
import { eventTypesList } from '../../api/generated/sdk.gen';
import type { EventType } from '../../api/generated/types.gen';
import { useApiQuery, type QueryState } from '../../api/useApiQuery.ts';
import { paths } from '../../paths.ts';
import { EventTypeForm } from './EventTypeForm.tsx';

const SKELETON_ITEMS = 2;

function EventTypeItem({ eventType }: { eventType: EventType }) {
  return (
    <Card component="li" withBorder radius="md" padding="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap" mb={4}>
        <Title order={3} size="h5">
          {eventType.title}
        </Title>
        <Badge variant="light" color="orange" leftSection={<IconClock size={12} />}>
          {eventType.durationMinutes} мин
        </Badge>
      </Group>
      <Text size="sm" ff="monospace" c="dimmed">
        {`${paths.catalog}/${eventType.id}`}
      </Text>
      {eventType.description && (
        <Text size="sm" mt={4}>
          {eventType.description}
        </Text>
      )}
    </Card>
  );
}

function EventTypeList({ query }: { query: QueryState<EventType[]> & { retry: () => void } }) {
  if (query.status === 'loading') {
    return (
      <Stack gap="sm" role="status" aria-label="Загрузка типов встреч">
        {Array.from({ length: SKELETON_ITEMS }, (_, index) => (
          <Card key={index} withBorder radius="md" padding="md">
            <Skeleton height={16} width="50%" mb="sm" />
            <Skeleton height={12} width="30%" />
          </Card>
        ))}
      </Stack>
    );
  }
  if (query.status === 'error') {
    return (
      <Alert
        color="red"
        variant="light"
        title="Не удалось загрузить типы встреч"
        icon={<IconAlertCircle />}
      >
        <Stack gap="sm" align="flex-start">
          <Text size="sm">{errorMessage(query.error)}</Text>
          <Button variant="light" color="red" size="xs" onClick={query.retry}>
            Повторить
          </Button>
        </Stack>
      </Alert>
    );
  }
  if (query.data.length === 0) {
    return <Text c="dimmed">Типов встреч пока нет. Создайте первый в форме.</Text>;
  }
  return (
    <Stack component="ul" gap="sm" p={0} m={0} style={{ listStyle: 'none' }}>
      {query.data.map((eventType) => (
        <EventTypeItem key={eventType.id} eventType={eventType} />
      ))}
    </Stack>
  );
}

/** Раздел админки «Типы встреч»: список в порядке создания и форма создания */
export function EventTypesSection() {
  const headingId = useId();
  const eventTypes = useApiQuery(
    async () => (await eventTypesList({ throwOnError: true })).data,
    [],
  );

  return (
    <section aria-labelledby={headingId}>
      <Title order={2} id={headingId} mb="md">
        Типы встреч
      </Title>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        <EventTypeList query={eventTypes} />
        <EventTypeForm onCreated={eventTypes.retry} />
      </SimpleGrid>
    </section>
  );
}
