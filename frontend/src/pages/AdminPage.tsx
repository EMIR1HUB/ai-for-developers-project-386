import { Container, Text, Title } from '@mantine/core';

export function AdminPage() {
  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="sm">
        Админка
      </Title>
      <Text c="dimmed">Скоро здесь появятся создание типов встреч и предстоящие бронирования.</Text>
    </Container>
  );
}
