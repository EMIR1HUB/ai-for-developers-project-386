import { Button, Card, Container, Grid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { isApiError } from '../../api/errors.ts';
import { eventTypesGet, eventTypesListSlots, ownerGet } from '../../api/generated/sdk.gen';
import type { Slot } from '../../api/generated/types.gen';
import { useApiQuery } from '../../api/useApiQuery.ts';
import { LoadErrorAlert } from '../../components/LoadErrorAlert.tsx';
import { paths } from '../../paths.ts';
import { TimeSelectionStep } from './TimeSelectionStep.tsx';

function EventTypeNotFound() {
  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="sm">
        Тип встречи не найден
      </Title>
      <Text c="dimmed" mb="lg">
        Проверьте адрес или выберите тип встречи в каталоге.
      </Text>
      <Button component={Link} to={paths.catalog} variant="default">
        К каталогу
      </Button>
    </Container>
  );
}

function BookingPageSkeleton() {
  return (
    <Grid gap="lg" role="status" aria-label="Загрузка типа встречи">
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Card withBorder radius="lg" padding="lg">
          <Skeleton height={16} width="50%" mb="md" />
          <Skeleton height={24} width="80%" mb="sm" />
          <Skeleton height={12} />
        </Card>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Skeleton height={320} radius="lg" />
      </Grid.Col>
    </Grid>
  );
}

/**
 * Шаги страницы бронирования на одном адресе. Тип встречи, профиль владельца, слоты
 * и выбор гостя живут здесь, а шаги только показывают их и сообщают о действиях гостя.
 */
function BookingFlow({ eventTypeId }: { eventTypeId: string }) {
  const details = useApiQuery(async () => {
    const [eventType, owner] = await Promise.all([
      eventTypesGet({ path: { id: eventTypeId }, throwOnError: true }),
      ownerGet({ throwOnError: true }),
    ]);
    return { eventType: eventType.data, owner: owner.data };
  }, [eventTypeId]);
  // Слоты грузятся отдельно: их перезагружают (`slots.retry`), не трогая остальную страницу
  const slots = useApiQuery(
    async () => (await eventTypesListSlots({ path: { id: eventTypeId }, throwOnError: true })).data,
    [eventTypeId],
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  if (
    details.status === 'error' &&
    isApiError(details.error) &&
    details.error.code === 'EVENT_TYPE_NOT_FOUND'
  ) {
    return <EventTypeNotFound />;
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        {details.status === 'loading' && <BookingPageSkeleton />}
        {details.status === 'error' && (
          <LoadErrorAlert
            title="Не удалось загрузить тип встречи"
            error={details.error}
            onRetry={details.retry}
          />
        )}
        {details.status === 'success' && (
          <TimeSelectionStep
            eventType={details.data.eventType}
            owner={details.data.owner}
            slots={slots}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            // Следующий шаг «данные гостя» добавляет #16
            onContinue={() => {}}
          />
        )}
      </Stack>
    </Container>
  );
}

export function BookingPage() {
  const { eventTypeId = '' } = useParams();
  // Другой тип встречи — новое бронирование: выбор гостя не переносится
  return <BookingFlow key={eventTypeId} eventTypeId={eventTypeId} />;
}
