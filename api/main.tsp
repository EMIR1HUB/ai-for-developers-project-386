import "@typespec/http";

using Http;

@service(#{ title: "Calendar API" })
namespace CalendarApi;

model Health {
  status: "ok";
}

@route("/api/health")
@tag("Health")
interface HealthCheck {
  /** Проверка, что сервис запущен и отвечает */
  @get check(): Health;
}

/** Код ошибки: закрытое перечисление, клиент различает ошибки по нему */
enum ErrorCode {
  /** 422: поля запроса невалидны, все ошибочные поля перечислены в `fields` */
  VALIDATION_ERROR,

  /** 422: начало бронирования не совпадает с началом предлагаемого слота */
  SLOT_NOT_OFFERED,

  /** 404: тип встречи с таким идентификатором не найден */
  EVENT_TYPE_NOT_FOUND,

  /** 404: неизвестный адрес под `/api` */
  NOT_FOUND,

  /** 409: идентификатор типа встречи уже занят */
  EVENT_TYPE_ID_TAKEN,

  /** 409: время пересекается с существующим бронированием */
  SLOT_TAKEN,

  /** 400: тело запроса не читается как JSON */
  MALFORMED_REQUEST,

  /** 500: непредвиденная ошибка, подробности только в логе сервера */
  INTERNAL_ERROR,
}

/** Ошибка одного поля запроса */
model FieldError {
  /** Имя поля, вложенные поля через точку */
  field: string;

  /** Текст ошибки для пользователя */
  message: string;
}

/** Тело любой ошибки API */
@error
model ApiError {
  code: ErrorCode;

  /** Текст для пользователя на русском, фронтенд показывает его как есть */
  message: string;

  /** Все ошибочные поля, только для `422 VALIDATION_ERROR` */
  fields?: FieldError[];
}

/** Ответ с ошибкой: статус и общее тело ошибки */
@error
model ErrorResponse<Status extends int32> {
  @statusCode statusCode: Status;
  @body body: ApiError;
}

/** Непредвиденная ошибка сервера (`INTERNAL_ERROR`) */
alias InternalError = ErrorResponse<500>;

/** Профиль владельца, который видит гость. Задан в конфиге бэкенда */
model OwnerProfile {
  name: string;

  /** Подпись под именем, например род занятий */
  subtitle: string;

  /** Часовой пояс владельца в формате IANA, например `Asia/Almaty` */
  timeZone: string;
}

@route("/api/owner")
@tag("Owner")
interface Owner {
  /** Профиль владельца */
  @get get(): OwnerProfile | InternalError;
}

/** Шаблон встречи владельца. После создания не меняется и не удаляется */
model EventType {
  /** Идентификатор, который задаёт владелец: строчные латинские буквы, цифры и дефис (не в начале, не в конце и не подряд) */
  @minLength(3)
  @maxLength(50)
  @pattern("^[a-z0-9]+(-[a-z0-9]+)*$")
  id: string;

  @minLength(1)
  @maxLength(100)
  title: string;

  /** Может быть пустым */
  @maxLength(500)
  description: string;

  /** Длительность в минутах, кратна 15 */
  @minValue(15)
  @maxValue(240)
  durationMinutes: int32;
}

@route("/api/event-types")
@tag("EventTypes")
interface EventTypes {
  /** Типы встреч в порядке создания */
  @get list(): EventType[] | InternalError;
}
