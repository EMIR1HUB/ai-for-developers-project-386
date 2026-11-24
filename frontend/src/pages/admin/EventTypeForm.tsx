import { Alert, Button, NativeSelect, Stack, Textarea, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { useId, useState, type FormEvent } from 'react';
import { errorMessage, fieldErrors, isApiError, type FieldErrors } from '../../api/errors.ts';
import { eventTypesCreate } from '../../api/generated/sdk.gen';
import { paths } from '../../paths.ts';

// Длительность 15–240 минут с шагом 15 (спецификация #11): выбор из списка не даёт ввести другое
const DURATION_STEP = 15;
const DURATION_OPTIONS = Array.from({ length: 240 / DURATION_STEP }, (_, index) => {
  const minutes = (index + 1) * DURATION_STEP;
  return { value: String(minutes), label: `${minutes} мин` };
});

interface FormValues {
  id: string;
  title: string;
  description: string;
  durationMinutes: string;
}

const EMPTY_FORM: FormValues = { id: '', title: '', description: '', durationMinutes: '30' };

/** Форма создания типа встречи. Поля проверяет сервер, ошибки показываются под полями */
export function EventTypeForm({ onCreated }: { onCreated: () => void }) {
  const titleId = useId();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const change = (field: keyof FormValues) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      await eventTypesCreate({
        body: { ...values, durationMinutes: Number(values.durationMinutes) },
        throwOnError: true,
      });
      notifications.show({ color: 'green', message: 'Тип встречи создан' });
      setValues(EMPTY_FORM);
      onCreated();
    } catch (error) {
      if (isApiError(error) && error.code === 'EVENT_TYPE_ID_TAKEN') {
        setErrors({ id: error.message });
      } else if (isApiError(error) && error.code === 'VALIDATION_ERROR') {
        setErrors(fieldErrors(error));
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const bookingPath = `${paths.catalog}/${values.id.trim() || '<id>'}`;

  return (
    <form aria-labelledby={titleId} onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <Title order={3} size="h4" id={titleId}>
          Новый тип встречи
        </Title>
        {formError && (
          <Alert color="red" variant="light" icon={<IconAlertCircle />}>
            {formError}
          </Alert>
        )}
        <TextInput
          label="Идентификатор"
          description={`Строчные латинские буквы, цифры и дефис, 3–50 символов. Адрес страницы: ${bookingPath}`}
          value={values.id}
          onChange={(event) => change('id')(event.currentTarget.value)}
          error={errors.id}
          required
        />
        <TextInput
          label="Название"
          value={values.title}
          onChange={(event) => change('title')(event.currentTarget.value)}
          error={errors.title}
          required
        />
        <Textarea
          label="Описание"
          value={values.description}
          onChange={(event) => change('description')(event.currentTarget.value)}
          error={errors.description}
          rows={3}
        />
        <NativeSelect
          label="Длительность"
          data={DURATION_OPTIONS}
          value={values.durationMinutes}
          onChange={(event) => change('durationMinutes')(event.currentTarget.value)}
          error={errors.durationMinutes}
          required
        />
        <Button type="submit" color="orange" loading={submitting} style={{ alignSelf: 'start' }}>
          Создать тип встречи
        </Button>
      </Stack>
    </form>
  );
}
