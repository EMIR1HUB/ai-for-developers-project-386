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
