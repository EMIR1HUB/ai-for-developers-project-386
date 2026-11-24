import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, server } from '../../test/mockApi.ts';
import { renderApp } from '../../test/renderApp.tsx';

const OWNER = {
  name: 'Алия Нурланова',
  subtitle: 'Продуктовый дизайнер',
  timeZone: 'Asia/Almaty',
};

const CALL = {
  id: 'call-30',
  title: 'Встреча 30 минут',
  description: 'Подробный разговор о проекте',
  durationMinutes: 30,
};

function slot(start: string, end: string, available: boolean) {
  return { start: `${start}:00+05:00`, end: `${end}:00+05:00`, available };
}

// Окно записи с 24 ноября по 1 декабря: в первый день свободных слотов нет
const SLOTS = [
  slot('2026-11-24T17:00', '2026-11-24T17:30', false),
  slot('2026-11-24T17:30', '2026-11-24T18:00', false),
  slot('2026-11-25T09:00', '2026-11-25T09:30', true),
  slot('2026-11-25T09:30', '2026-11-25T10:00', false),
  slot('2026-11-25T10:00', '2026-11-25T10:30', true),
  slot('2026-11-30T09:00', '2026-11-30T09:30', true),
  slot('2026-12-01T09:00', '2026-12-01T09:30', true),
];

function mockBookingPage() {
  server.use(
    mockApi('ownerGet', 200, OWNER),
    mockApi('eventTypesGet', 200, CALL),
    mockApi('eventTypesListSlots', 200, SLOTS),
  );
}

function slotsColumn() {
  return screen.getByRole('region', { name: 'Слоты дня' });
}

function summaryCard() {
  return screen.getByRole('region', { name: 'Тип встречи' });
}

describe('Страница бронирования: выбор времени', () => {
  it('should show event type card with owner, duration and description when page is opened', async () => {
    // given
    mockBookingPage();

    // when
    renderApp('/book/call-30');

    // then
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Встреча 30 минут' }),
    ).toBeInTheDocument();
    const summary = summaryCard();
    expect(within(summary).getByText('Алия Нурланова')).toBeInTheDocument();
    expect(within(summary).getByText('30 мин')).toBeInTheDocument();
    expect(within(summary).getByText('Подробный разговор о проекте')).toBeInTheDocument();
    expect(screen.getByText('Время указано по Алматы (UTC+5)')).toBeInTheDocument();
  });

  it('should select first day with free slots by default when first window day is fully taken', async () => {
    // given
    mockBookingPage();

    // when
    renderApp('/book/call-30');

    // then
    const day = await screen.findByRole('button', { name: '25 ноября, свободных слотов: 2' });
    expect(day).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(slotsColumn()).getByRole('heading', { name: 'среда, 25 ноября' }),
    ).toBeInTheDocument();
    expect(within(slotsColumn()).getAllByRole('button')).toHaveLength(3);
  });

  it('should show taken slots as disabled and free slots as enabled', async () => {
    // given
    mockBookingPage();

    // when
    renderApp('/book/call-30');

    // then
    const column = await screen.findByRole('region', { name: 'Слоты дня' });
    expect(within(column).getByRole('button', { name: '09:00–09:30 Свободно' })).toBeEnabled();
    expect(within(column).getByRole('button', { name: '09:30–10:00 Занято' })).toBeDisabled();
    expect(within(column).getByRole('button', { name: '10:00–10:30 Свободно' })).toBeEnabled();
  });

  it('should show number of free slots for window days and disable days outside window', async () => {
    // given
    mockBookingPage();

    // when
    renderApp('/book/call-30');

    // then
    expect(
      await screen.findByRole('button', { name: '24 ноября, свободных слотов: 0' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: '30 ноября, свободных слотов: 1' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '23 ноября' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '27 ноября' })).toBeDisabled();
  });

  it('should show slots of chosen day when another day is clicked in calendar', async () => {
    // given
    mockBookingPage();
    const user = userEvent.setup();
    renderApp('/book/call-30');

    // when
    await user.click(await screen.findByRole('button', { name: '30 ноября, свободных слотов: 1' }));

    // then
    expect(
      within(slotsColumn()).getByRole('heading', { name: 'понедельник, 30 ноября' }),
    ).toBeInTheDocument();
    expect(within(slotsColumn()).getAllByRole('button')).toHaveLength(1);
    expect(
      within(slotsColumn()).getByRole('button', { name: '09:00–09:30 Свободно' }),
    ).toBeInTheDocument();
  });

  it('should show december days when next month arrow is clicked and window spans two months', async () => {
    // given
    mockBookingPage();
    const user = userEvent.setup();
    renderApp('/book/call-30');
    await screen.findByRole('button', { name: '25 ноября, свободных слотов: 2' });
    expect(
      screen.queryByRole('button', { name: '1 декабря, свободных слотов: 1' }),
    ).not.toBeInTheDocument();

    // when
    await user.click(screen.getByRole('button', { name: 'Следующий месяц' }));

    // then
    expect(screen.getByRole('button', { name: '1 декабря, свободных слотов: 1' })).toBeEnabled();
  });

  it('should show chosen date and time in card and enable continue when free slot is chosen', async () => {
    // given
    mockBookingPage();
    const user = userEvent.setup();
    renderApp('/book/call-30');
    const column = await screen.findByRole('region', { name: 'Слоты дня' });
    const continueButton = screen.getByRole('button', { name: 'Продолжить' });
    expect(continueButton).toBeDisabled();

    // when
    await user.click(within(column).getByRole('button', { name: '10:00–10:30 Свободно' }));

    // then
    expect(within(column).getByRole('button', { name: '10:00–10:30 Свободно' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(summaryCard()).getByText('среда, 25 ноября')).toBeInTheDocument();
    expect(within(summaryCard()).getByText('10:00–10:30')).toBeInTheDocument();
    expect(continueButton).toBeEnabled();
  });

  it('should lead back to catalog when back is clicked', async () => {
    // given
    mockBookingPage();
    const user = userEvent.setup();
    renderApp('/book/call-30');

    // when
    await user.click(await screen.findByRole('link', { name: 'Назад' }));

    // then
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Выберите тип встречи' }),
    ).toBeInTheDocument();
  });

  it('should show not found message with link to catalog when event type is unknown', async () => {
    // given
    const notFound = { code: 'EVENT_TYPE_NOT_FOUND', message: 'Тип встречи не найден' } as const;
    server.use(
      mockApi('ownerGet', 200, OWNER),
      mockApi('eventTypesGet', 404, notFound),
      mockApi('eventTypesListSlots', 404, notFound),
    );

    // when
    renderApp('/book/unknown-type');

    // then
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Тип встречи не найден' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'К каталогу' })).toHaveAttribute('href', '/book');
  });
});
