import {
  Alert,
  Avatar,
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
import { IconAlertCircle, IconCalendarOff, IconClock } from '@tabler/icons-react';
import { errorMessage } from '../api/errors.ts';
import { eventTypesList, ownerGet } from '../api/generated/sdk.gen';
import type { EventType, OwnerProfile } from '../api/generated/types.gen';
import { useApiQuery } from '../api/useApiQuery.ts';

const SKELETON_CARDS = 3;
// Аватар владельца — статичная картинка фронтенда, в профиле владельца его нет
const OWNER_AVATAR_URL = '/owner-avatar.svg';

function LoadErrorAlert({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Alert color="red" variant="light" title={title} icon={<IconAlertCircle />}>
      <Stack gap="sm" align="flex-start">
        <Text size="sm">{errorMessage(error)}</Text>
        <Button variant="light" color="red" size="xs" onClick={onRetry}>
          Повторить
        </Button>
      </Stack>
    </Alert>
  );
}

function OwnerCard({ owner }: { owner: OwnerProfile }) {
  return (
    <Card component="section" aria-label="Профиль владельца" withBorder radius="lg" padding="lg">
      <Group wrap="nowrap">
        <Avatar src={OWNER_AVATAR_URL} alt={owner.name} size="lg" radius="xl" color="orange" />
        <div>
          <Text fw={600} size="lg">
            {owner.name}
          </Text>
          <Text c="dimmed" size="sm">
            {owner.subtitle}
          </Text>
        </div>
      </Group>
    </Card>
  );
}

function OwnerSkeleton() {
  return (
    <Card withBorder radius="lg" padding="lg" role="status" aria-label="Загрузка профиля владельца">
      <Group wrap="nowrap">
        <Skeleton height={56} circle />
        <div style={{ flex: 1 }}>
          <Skeleton height={16} width="40%" mb="xs" />
          <Skeleton height={12} width="30%" />
        </div>
      </Group>
    </Card>
  );
}

function OwnerSection() {
  const owner = useApiQuery(async () => (await ownerGet({ throwOnError: true })).data, []);

  switch (owner.status) {
    case 'loading':
      return <OwnerSkeleton />;
    case 'error':
      return (
        <LoadErrorAlert
          title="Не удалось загрузить профиль владельца"
          error={owner.error}
          onRetry={owner.retry}
        />
      );
    case 'success':
      return <OwnerCard owner={owner.data} />;
  }
}

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

function EmptyCatalog() {
  return (
    <Card withBorder radius="lg" padding="xl">
      <Stack align="center" gap="xs">
        <IconCalendarOff size={32} color="var(--mantine-color-dimmed)" aria-hidden />
        <Text c="dimmed" ta="center">
          Владелец пока не создал ни одного типа встречи
        </Text>
      </Stack>
    </Card>
  );
}

function EventTypeList() {
  const eventTypes = useApiQuery(
    async () => (await eventTypesList({ throwOnError: true })).data,
    [],
  );

  switch (eventTypes.status) {
    case 'loading':
      return <EventTypeSkeletons />;
    case 'error':
      return (
        <LoadErrorAlert
          title="Не удалось загрузить типы встреч"
          error={eventTypes.error}
          onRetry={eventTypes.retry}
        />
      );
    case 'success':
      if (eventTypes.data.length === 0) {
        return <EmptyCatalog />;
      }
      return (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {eventTypes.data.map((eventType) => (
            <EventTypeCard key={eventType.id} eventType={eventType} />
          ))}
        </SimpleGrid>
      );
  }
}

export function EventTypeCatalogPage() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <OwnerSection />
        <Title order={1}>Выберите тип встречи</Title>
        <EventTypeList />
      </Stack>
    </Container>
  );
}
