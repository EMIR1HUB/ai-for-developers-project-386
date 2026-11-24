import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { NewEventType } from '../api/generated/types.gen';
import { mockApi, server } from '../test/mockApi.ts';
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

function eventTypesSection() {
  return screen.getByRole('region', { name: 'Типы встреч' });
}

// Поле формы по подписи; звёздочка обязательного поля скрыта от вспомогательных технологий
function field(label: 'Идентификатор' | 'Название' | 'Описание' | 'Длительность') {
  return screen.getByRole(label === 'Длительность' ? 'combobox' : 'textbox', { name: label });
}

async function fillEventTypeForm(
  user: ReturnType<typeof userEvent.setup>,
  { id, title, description, durationLabel }: Record<string, string>,
) {
  await user.type(field('Идентификатор'), id);
  await user.type(field('Название'), title);
  if (description) {
    await user.type(field('Описание'), description);
  }
  await user.selectOptions(field('Длительность'), durationLabel);
}

describe('Админка: типы встреч', () => {
  it('should create event type, notify and refresh the list when form is valid', async () => {
    // given
    server.use(mockApi('eventTypesList', 200, [INTRO]));
    const user = userEvent.setup();
    renderApp('/admin');
    expect(
      await within(eventTypesSection()).findByRole('heading', { name: 'Встреча 15 минут' }),
    ).toBeInTheDocument();
    await fillEventTypeForm(user, {
      id: 'call-30',
      title: 'Встреча 30 минут',
      description: 'Подробный разговор',
      durationLabel: '30 мин',
    });
    const sent: NewEventType[] = [];
    server.use(
      mockApi('eventTypesCreate', 201, CALL, (body) => sent.push(body)),
      mockApi('eventTypesList', 200, [INTRO, CALL]),
    );

    // when
    await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }));

    // then
    expect(await screen.findByText('Тип встречи создан')).toBeInTheDocument();
    expect(sent).toEqual([
      {
        id: 'call-30',
        title: 'Встреча 30 минут',
        description: 'Подробный разговор',
        durationMinutes: 30,
      },
    ]);
    const items = await within(eventTypesSection()).findAllByRole('listitem');
    expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual([
      'Встреча 15 минут',
      'Встреча 30 минут',
    ]);
    expect(within(items[1]).getByText('/book/call-30')).toBeInTheDocument();
    expect(field('Идентификатор')).toHaveValue('');
  });

  it('should show conflict message under id field when id is taken', async () => {
    // given
    const user = userEvent.setup();
    renderApp('/admin');
    await fillEventTypeForm(user, {
      id: 'intro-15',
      title: 'Ещё одна встреча',
      description: '',
      durationLabel: '15 мин',
    });
    server.use(
      mockApi('eventTypesCreate', 409, {
        code: 'EVENT_TYPE_ID_TAKEN',
        message: 'Идентификатор уже занят. Выберите другой',
      }),
    );

    // when
    await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }));

    // then
    const idInput = field('Идентификатор');
    await waitFor(() => expect(idInput).toHaveAttribute('aria-invalid', 'true'));
    expect(idInput).toHaveAccessibleDescription(
      expect.stringContaining('Идентификатор уже занят. Выберите другой'),
    );
    expect(idInput).toHaveValue('intro-15');
    expect(screen.queryByText('Тип встречи создан')).not.toBeInTheDocument();
  });

  it('should show validation messages under each field when server rejects fields', async () => {
    // given
    const user = userEvent.setup();
    renderApp('/admin');
    await fillEventTypeForm(user, {
      id: 'Intro',
      title: ' ',
      description: 'Описание',
      durationLabel: '15 мин',
    });
    server.use(
      mockApi('eventTypesCreate', 422, {
        code: 'VALIDATION_ERROR',
        message: 'Поля заполнены неверно',
        fields: [
          { field: 'id', message: 'Только строчные латинские буквы, цифры и дефис' },
          { field: 'title', message: 'Обязательное поле' },
          { field: 'description', message: 'Не длиннее 500 символов' },
          { field: 'durationMinutes', message: 'От 15 до 240 минут с шагом 15' },
        ],
      }),
    );

    // when
    await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }));

    // then
    await waitFor(() =>
      expect(field('Идентификатор')).toHaveAccessibleDescription(
        expect.stringContaining('Только строчные латинские буквы, цифры и дефис'),
      ),
    );
    expect(field('Название')).toHaveAccessibleDescription('Обязательное поле');
    expect(field('Описание')).toHaveAccessibleDescription('Не длиннее 500 символов');
    expect(field('Длительность')).toHaveAccessibleDescription('От 15 до 240 минут с шагом 15');
  });

  it('should show server message above the form when creation fails unexpectedly', async () => {
    // given
    const user = userEvent.setup();
    renderApp('/admin');
    await fillEventTypeForm(user, {
      id: 'call-30',
      title: 'Встреча 30 минут',
      description: '',
      durationLabel: '30 мин',
    });
    server.use(
      mockApi('eventTypesCreate', 500, {
        code: 'INTERNAL_ERROR',
        message: 'Внутренняя ошибка сервера. Попробуйте позже',
      }),
    );

    // when
    await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }));

    // then
    const form = screen.getByRole('form', { name: 'Новый тип встречи' });
    expect(
      await within(form).findByText('Внутренняя ошибка сервера. Попробуйте позже'),
    ).toBeInTheDocument();
    expect(field('Идентификатор')).toHaveValue('call-30');
  });
});
