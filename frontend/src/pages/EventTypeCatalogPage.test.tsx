import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, mockApiNetworkError, server } from '../test/mockApi.ts';
import { renderApp } from '../test/renderApp.tsx';

const INTRO = {
  id: 'intro-15',
  title: 'Встреча 15 минут',
  description: 'Короткое знакомство',
  durationMinutes: 15,
};
const CALL = {
  id: 'call-30',
  title: 'Встреча 30 минут',
  description: 'Подробный разговор',
  durationMinutes: 30,
};

describe('Каталог типов встреч', () => {
  it('should show event type cards in server order when catalog is opened', async () => {
    // given
    server.use(mockApi('eventTypesList', 200, [INTRO, CALL]));

    // when
    renderApp('/book');

    // then
    const [first, second] = await screen.findAllByRole('article');
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(within(first).getByRole('heading', { name: 'Встреча 15 минут' })).toBeInTheDocument();
    expect(within(first).getByText('Короткое знакомство')).toBeInTheDocument();
    expect(within(first).getByText('15 мин')).toBeInTheDocument();
    expect(within(second).getByRole('heading', { name: 'Встреча 30 минут' })).toBeInTheDocument();
    expect(within(second).getByText('Подробный разговор')).toBeInTheDocument();
    expect(within(second).getByText('30 мин')).toBeInTheDocument();
  });

  it('should show skeleton while event types are loading', async () => {
    // given
    server.use(mockApi('eventTypesList', 200, [INTRO]));

    // when
    renderApp('/book');

    // then
    expect(screen.getByRole('status', { name: 'Загрузка типов встреч' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Встреча 15 минут' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Загрузка типов встреч' })).not.toBeInTheDocument();
  });

  it('should show server message and reload on retry when loading fails', async () => {
    // given
    server.use(
      mockApi('eventTypesList', 500, {
        code: 'INTERNAL_ERROR',
        message: 'Внутренняя ошибка сервера. Попробуйте позже',
      }),
    );
    const user = userEvent.setup();
    renderApp('/book');
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Не удалось загрузить типы встреч')).toBeInTheDocument();
    expect(
      within(alert).getByText('Внутренняя ошибка сервера. Попробуйте позже'),
    ).toBeInTheDocument();

    // when
    server.use(mockApi('eventTypesList', 200, [CALL]));
    await user.click(within(alert).getByRole('button', { name: 'Повторить' }));

    // then
    expect(await screen.findByRole('heading', { name: 'Встреча 30 минут' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should show connection error when server is unreachable', async () => {
    // given
    server.use(mockApiNetworkError('eventTypesList'));

    // when
    renderApp('/book');

    // then
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Не удалось связаться с сервером')).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});
