import { ApiFailure } from './errors.ts';
import type { FieldError } from './generated/types.gen.ts';

export const MALFORMED_BODY_MESSAGE = 'Тело запроса должно быть JSON-объектом';
const VALIDATION_MESSAGE = 'Поля заполнены неверно';
const REQUIRED_MESSAGE = 'Обязательное поле';
const NOT_STRING_MESSAGE = 'Должно быть строкой';
const NOT_INTEGER_MESSAGE = 'Должно быть целым числом';

export interface StringRules {
  /** По умолчанию 0: пустая строка допустима */
  minLength?: number;
  maxLength: number;
  pattern?: RegExp;
  /** Текст ошибки, если строка не подходит под `pattern` */
  patternMessage?: string;
}

export interface IntegerRules {
  min: number;
  max: number;
  /** Значение должно быть кратно шагу */
  step: number;
  /** Текст ошибки при выходе за границы или шаг */
  message: string;
}

/**
 * Читает поля тела запроса и копит ошибки, не прерываясь на первой: ответ `422` перечисляет
 * все ошибочные поля сразу. Имя поля — путь через точку (`guest.name`), он же попадает в `field`.
 * При ошибке метод возвращает заглушку; `parseBody` всё равно не отдаст результат дальше.
 */
export interface FieldReader {
  /** Обязательная строка. Пробелы по краям обрезаются до проверки, строка из пробелов — пустая */
  string(field: string, rules: StringRules): string;
  /** Обязательное целое число */
  integer(field: string, rules: IntegerRules): number;
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valueAt(body: JsonObject, field: string): unknown {
  let value: unknown = body;
  for (const key of field.split('.')) {
    value = isJsonObject(value) ? value[key] : undefined;
  }
  return value;
}

function lengthMessage(minLength: number, maxLength: number): string {
  return minLength > 1
    ? `Длина от ${minLength} до ${maxLength} символов`
    : `Не длиннее ${maxLength} символов`;
}

/**
 * Проверяет тело запроса и возвращает то, что собрала `read`.
 * Тело не JSON-объект — `ApiFailure` `MALFORMED_REQUEST` (400); хотя бы одно поле невалидно —
 * `ApiFailure` `VALIDATION_ERROR` (422) со всеми ошибочными полями.
 */
export function parseBody<T>(body: unknown, read: (fields: FieldReader) => T): T {
  if (!isJsonObject(body)) {
    throw new ApiFailure('MALFORMED_REQUEST', MALFORMED_BODY_MESSAGE);
  }

  const errors: FieldError[] = [];
  const reject = (field: string, message: string) => {
    errors.push({ field, message });
  };

  const reader: FieldReader = {
    string(field, { minLength = 0, maxLength, pattern, patternMessage }) {
      const raw = valueAt(body, field);
      if (raw === undefined || raw === null) {
        reject(field, REQUIRED_MESSAGE);
        return '';
      }
      if (typeof raw !== 'string') {
        reject(field, NOT_STRING_MESSAGE);
        return '';
      }
      const value = raw.trim();
      // Длина в символах Unicode, как `maxLength` в JSON Schema, а не в UTF-16
      const length = [...value].length;
      if (length === 0 && minLength > 0) {
        reject(field, REQUIRED_MESSAGE);
      } else if (length < minLength || length > maxLength) {
        reject(field, lengthMessage(minLength, maxLength));
      } else if (pattern && !pattern.test(value)) {
        reject(field, patternMessage ?? 'Неверный формат');
      }
      return value;
    },

    integer(field, { min, max, step, message }) {
      const raw = valueAt(body, field);
      if (raw === undefined || raw === null) {
        reject(field, REQUIRED_MESSAGE);
        return 0;
      }
      if (typeof raw !== 'number' || !Number.isInteger(raw)) {
        reject(field, NOT_INTEGER_MESSAGE);
        return 0;
      }
      if (raw < min || raw > max || raw % step !== 0) {
        reject(field, message);
      }
      return raw;
    },
  };

  const result = read(reader);
  if (errors.length > 0) {
    throw new ApiFailure('VALIDATION_ERROR', VALIDATION_MESSAGE, errors);
  }
  return result;
}
