# ParticleText: встраивание на внешний сайт (handoff для агента)

Документ описывает, как корректно встроить эту статическую демо-страницу в другой проект. Целевая страница без панели настроек — `**embed.html**`.

## Инварианты (обязательно соблюдать)

1. **Не открывать `index.html` как «embed»** — там есть UI (`#controls`, переключатель, монитор FPS). Для встраивания используется только `**embed.html`**.
2. **Корень документа**: в `embed.html` на элементе `<html>` задан атрибут `**data-particle-embed="true"`**. Его **нельзя удалять** — `js/main.js` определяет `isParticleEmbed` по `document.documentElement.dataset.particleEmbed === 'true'` и отключает UI, `localStorage` для кривой загрузки и тяжёлый FPS-монитор.
3. **Протокол**: страница грузит Three.js через **ES modules** и **import map** с `cdn.jsdelivr.net`. Нужен **HTTP(S)** с корректными MIME для `.js` (не `file://` для основного сценария).
4. **Относительные пути**: скрипт и стили подключаются как `js/main.js`, `css/style.css`. SVG для текста задаётся в коде (пресеты) относительно корня сайта — при деплое должны лежать **рядом с `embed.html`** те же файлы, что и у полной версии (в т.ч. `**Break the Shape.svg**` или путь из `PRESETS` в `main.js`).

## Минимальный набор файлов для хостинга

Скопируйте/деплойте в одну директорию (как на GitHub Pages — корень репозитория):

- `embed.html`
- `index.html` (опционально, если нужна версия с панелью)
- `js/main.js`
- `css/style.css`
- SVG из пресета (сейчас в коде: `**Break the Shape.svg**` в корне — проверьте `PRESETS` / `svgPath` в `js/main.js`)

## Встраивание через iframe (рекомендуется)

Хостинг должен отдавать `embed.html` по **тому же origin**, с которого открыта родительская страница, **или** вы явно контролируете CORS/политики — иначе относительные пути внутри iframe разрешатся относительно URL `embed.html` (это нормально).

Пример:

```html
<iframe
  src="https://YOUR_DOMAIN/path/to/embed.html"
  title="ParticleText"
  style="width:100%;min-height:100vh;border:0;display:block"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
```

- Высоту/`min-height` подберите под макет; у `body` во встроенном документе задан `**min-height: 400vh**`, чтобы сохранился эффект скролла из основной версии.
- Если iframe очень низкий, скролл будет внутри iframe — это ожидаемо.

## Встраивание без iframe (не поддержано «из коробки»)

Текущая сборка — **одна страница + один модуль `main.js`**, который вешает WebGL на `document.body`. Для вставки «кусок DOM в React/Vue» потребовался бы отдельный рефактор (контейнер + параметры монтирования). Агенту: **не обещать shadow-DOM mount без изменений кода**.

## Поведение во `embed.html` (что уже сделано в коде)

- Нет элементов `#controls`, `#toggleControls`, `#performanceMonitor`, `#curveEditor`.
- Не читается и не пишется `**localStorage`** ключ `particleConfig` (настройки кривой/длительности загрузки только из констант в `DESKTOP_PRESET_CONFIG` / дефолтов).
- Пресет **Desktop/Mobile** по-прежнему может переключаться по ширине окна (в т.ч. ширине iframe) — логика в `resize` в `main.js`.

## Локальная проверка

```bash
python3 server.py
# открыть http://localhost:8000/embed.html
```

Если порт 8000 занят — остановить старый процесс или временно изменить `PORT` в `server.py`.

## Куда смотреть при правках


| Задача                                | Файл                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| Числовые дефолты сцены                | `js/main.js` → `DESKTOP_PRESET_CONFIG`, `MOBILE_PRESET_CONFIG`                         |
| Кривая анимации загрузки по умолчанию | `js/main.js` → `DEFAULT_LOAD_ANIMATION_EASING_CURVE`, версия `PARTICLE_CONFIG_VERSION` |
| Разметка без UI                       | `embed.html`                                                                           |
| Стили + высота body для embed         | `css/style.css` → селектор `html[data-particle-embed="true"] body`                     |
| Флаг встраивания                      | `data-particle-embed="true"` на `<html>` + проверки `isParticleEmbed` в `js/main.js`   |


## Краткий чеклист для агента-исполнителя

- Использовать `**embed.html**`, не подменять на `index.html` без согласования.
- Сохранить `**data-particle-embed="true"**` на `<html>`.
- Задеплоить **все** статические зависимости (`js/`, `css/`, SVG) с сохранением путей.
- Проверить загрузку по **HTTPS** с сервера, не с `file://`.
- При изменении дефолтов синхронизировать начальные `value` в `**index.html`** (для dev с панелью); `embed.html` панели не содержит.

