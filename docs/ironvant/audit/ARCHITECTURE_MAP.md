# Architecture Map

| Слой | Папка | Содержимое |
|---|---|---|
| Маршруты | `src/app/` | Экраны Expo Router, в них нет бизнес-правил |
| Фичи | `src/features/` | Составные части экранов: анкета, тренировка, питание, Coach, восстановление |
| Домены | `src/domains/` | Правила и хранение, без React |
| Данные приложения | `src/app-data/` | Открытие базы, общий контекст, чтение данных экранами |
| Дизайн-система | `src/design-system/` | Токены, темы, цифры табло, списки iOS, иконки, переключатели разделов |
| Общие компоненты | `src/components/` | Линейка, колесо, графики, схема мышц, знак бренда |
| Утилиты | `src/lib/` | Формат, язык, подтверждения, отклик, звук |

## Домены

| Домен | Владеет | Главные файлы |
|---|---|---|
| Data Platform | Порт базы, очередь, миграции, копии | `migrations.ts`, `data-transfer.ts`, `backup-crypto.ts` |
| Workout | Единственная запись тренировочных фактов, журнал событий | `workout-engine.ts`, `state-machine.ts`, `progression.ts` |
| Exercises | Каталог, памятки, свои упражнения | `catalog.ts`, `technique.ts` |
| Program | Генерация и правка плана | `generate-plan.ts`, `program-repository.ts` |
| Coach | Предложения, защитные правила, версии плана, память | `proposals.ts`, `coach-repository.ts`, `coach-facts.ts` |
| Recovery | Отметки, шаги, оценка готовности | `recovery.ts`, `recovery-repository.ts` |
| Nutrition | Дневник, база, штрихкод, блюда, цели | `nutrition-repository.ts`, `food-catalog.ts`, `product-lookup.ts`, `targets.ts` |
| Progress | История, рекорды, аналитика, экспорт | `progress-repository.ts`, `analytics.ts`, `workout-csv.ts` |
| Profile | Анкета и профиль | `profile.ts`, `complete-onboarding.ts` |

## Границы

- Coach не пишет факты тренировок: он меняет только план и настройки, а завершённая история остаётся нетронутой.
- Сеть используется в одном месте: `lookupProduct`, и только номер штрихкода.
- Весь текст проходит через `t()`, ключом служит русская строка. Тест не пропускает строки без перевода.
