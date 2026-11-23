import { Container, Text, Title } from '@mantine/core';

export function EventTypeCatalogPage() {
  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="sm">
        Каталог типов встреч
      </Title>
      <Text c="dimmed">Скоро здесь появятся типы встреч, на которые можно записаться.</Text>
    </Container>
  );
}
