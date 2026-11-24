import { http, HttpResponse, type HttpHandler } from 'msw';
import { setupServer } from 'msw/node';
import type {
  EventTypesGetData,
  EventTypesGetErrors,
  EventTypesGetResponses,
  EventTypesListData,
  EventTypesListErrors,
  EventTypesListResponses,
  EventTypesListSlotsData,
  EventTypesListSlotsErrors,
  EventTypesListSlotsResponses,
  OwnerGetData,
  OwnerGetErrors,
  OwnerGetResponses,
} from '../api/generated/types.gen';

/**
 * Операции контракта, которые подменяют тесты. Типы берутся из сгенерированного SDK, поэтому
 * обработчик с неверным адресом, статусом или телом не пройдёт проверку типов.
 * Новая операция добавляется сюда и в `OPERATIONS`.
 */
interface ApiOperations {
  eventTypesList: {
    data: EventTypesListData;
    responses: EventTypesListResponses;
    errors: EventTypesListErrors;
  };
  eventTypesGet: {
    data: EventTypesGetData;
    responses: EventTypesGetResponses;
    errors: EventTypesGetErrors;
  };
  eventTypesListSlots: {
    data: EventTypesListSlotsData;
    responses: EventTypesListSlotsResponses;
    errors: EventTypesListSlotsErrors;
  };
  ownerGet: {
    data: OwnerGetData;
    responses: OwnerGetResponses;
    errors: OwnerGetErrors;
  };
}

type OperationName = keyof ApiOperations;
type Method = 'get' | 'post';
type StatusMap<Name extends OperationName> = ApiOperations[Name]['responses'] &
  ApiOperations[Name]['errors'];

const OPERATIONS: {
  [Name in OperationName]: { method: Method; url: ApiOperations[Name]['data']['url'] };
} = {
  eventTypesList: { method: 'get', url: '/api/event-types' },
  eventTypesGet: { method: 'get', url: '/api/event-types/{id}' },
  eventTypesListSlots: { method: 'get', url: '/api/event-types/{id}/slots' },
  ownerGet: { method: 'get', url: '/api/owner' },
};

// Hey API пишет параметры пути как `{id}`, MSW ждёт `:id`
function toMswPath(url: string): string {
  return url.replace(/\{(\w+)\}/g, ':$1');
}

/** Обработчик MSW, который отвечает на операцию контракта заданным статусом и телом */
export function mockApi<Name extends OperationName, Status extends keyof StatusMap<Name> & number>(
  name: Name,
  status: Status,
  body: StatusMap<Name>[Status],
): HttpHandler {
  const { method, url } = OPERATIONS[name];
  return http[method](toMswPath(url), () => HttpResponse.json(body as object, { status }));
}

/** Обработчик MSW, имитирующий сетевую ошибку (сервер недоступен) */
export function mockApiNetworkError(name: OperationName): HttpHandler {
  const { method, url } = OPERATIONS[name];
  return http[method](toMswPath(url), () => HttpResponse.error());
}

/**
 * Сеть по умолчанию: пустые ответы, чтобы страницы рендерились в любом тесте.
 * Тест переопределяет нужную операцию через `server.use(mockApi(...))`.
 */
export const server = setupServer(
  mockApi('eventTypesList', 200, []),
  mockApi('ownerGet', 200, { name: 'Владелец', subtitle: '', timeZone: 'Asia/Almaty' }),
);
