import { Container, Title } from '@mantine/core';
import { EventTypesSection } from './admin/EventTypesSection.tsx';

export function AdminPage() {
  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="lg">
        Админка
      </Title>
      <EventTypesSection />
    </Container>
  );
}
