import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Обработка ошибок загрузки
window.addEventListener('error', (event) => {
    console.error('Глобальная ошибка:', event.error);
    const isModuleError = event.error && event.error.message && (
        event.error.message.includes('import') || 
        event.error.message.includes('CORS') || 
        event.error.message.includes('Failed to fetch') ||
        event.error.message.includes('module')
    );
    if (isModuleError) {
        const protocol = window.location.protocol;
        let errorMsg = 'Ошибка загрузки модулей. ';
        if (protocol === 'file:') {
            errorMsg += 'Вы открыли файл через file:// протокол. ES модули не работают через file:// из-за CORS ограничений.<br><br>Используйте локальный сервер:<br>';
            errorMsg += '• Python: <code>python -m http.server 8000</code><br>';
            errorMsg += '• Node.js: <code>npx http-server</code><br>';
            errorMsg += '• Затем откройте <code>http://localhost:8000</code>';
        } else {
            errorMsg += 'Убедитесь, что ваш браузер поддерживает ES модули и import maps.';
        }
        errorMsg += '<br><br>Проверьте консоль браузера (F12) для деталей.';
        document.body.innerHTML = '<div style="color: white; padding: 20px; font-family: monospace; background: #222; position: fixed; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; z-index: 10000;">' + errorMsg + '</div>';
    }
});

// Также ловим unhandled promise rejections (могут быть при загрузке модулей)
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// ========== ПАРАМЕТРЫ ==========
// Функция загрузки настроек из localStorage
function loadConfigFromStorage() {
    const saved = localStorage.getItem('particleConfig');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.warn('Ошибка загрузки настроек из localStorage:', e);
        }
    }
    return null;
}

// Функция сохранения настроек в localStorage
function saveConfigToStorage() {
    try {
        const configToSave = {
            loadAnimationDuration: CONFIG.loadAnimationDuration,
            loadAnimationEasingCurve: CONFIG.loadAnimationEasingCurve
        };
        localStorage.setItem('particleConfig', JSON.stringify(configToSave));
    } catch (e) {
        console.warn('Ошибка сохранения настроек в localStorage:', e);
    }
}

// Загружаем сохраненные настройки
const savedConfig = loadConfigFromStorage();

let CONFIG = {
    particleCount: 10000,
    outsideParticleCount: 200, // Количество частиц вне SVG формы (независимо от particleCount)
    outsideInvisiblePercentage: 0, // Процент невидимых точек вне формы (0-100)
    sphereRadius: 3.0, // Увеличиваем размер текста
    forceStrength: 100.0,
    interactionRadius: 5.0,
    returnSpeed: 0.030, // Оставляем для обратной совместимости, но используем springConstant
    springConstant: 0.35, // Жёсткость пружины (сила возврата)
    damping: 0.90, // Коэффициент демпфирования (затухание колебаний, чем ближе к 1, тем сильнее затухание)
    timeScale: 0.90, // Глобальный множитель скорости анимации (0.5 = в 2 раза медленнее)
    pointSize: 4, // Размер точек
    sizeVariation: 0.5, // Максимальная разница размера точек (50% по умолчанию)
    autonomousMotionStrength: 0.04, // Сила автономного движения точек
    chaosAngle: 45, // Максимальный угол отклонения направления (градусы)
    chaosStrength: 0.8, // Сила хаотичности (0-1)
    tangentialForceRatio: 0.4, // Соотношение тангенциальной силы
    zAxisStrength: 0.6, // Сила Z-компоненты (глубина)
    scrollSpreadForce: 75, // Сила разлёта при скролле
    scrollDepth: 300, // Глубина скролла (vh) - скрыт в UI
    isLoadingAnimation: true, // Флаг активной анимации загрузки
    loadAnimationStartTime: null, // Время начала анимации
    loadAnimationDuration: savedConfig?.loadAnimationDuration ?? 4000, // Длительность анимации (4 секунды)
    loadAnimationEasingCurve: savedConfig?.loadAnimationEasingCurve ?? { p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 }, // Кривая Безье для управления скоростью (по умолчанию ease-in-out)
    // Параметры волны
    waveEnabled: false, // Флаг включения/выключения волны
    waveInterval: 8000, // Интервал между волнами (мс)
    waveSpeed: 6.0, // Скорость распространения волны (единиц в секунду) - быстрое прохождение
    waveWidth: 1.6, // Ширина волны (расстояние от переднего края до заднего) - толще волна
    waveForce: 0.001, // Сила воздействия на точки (очень subtle - едва заметное движение)
    waveGlowIntensity: 0.75, // Интенсивность свечения точек в волне (0-1)
    waveForceFalloff: 0.5, // Крутизна затухания силы волны от центра к краям (0.1-2.0)
    lastWaveTime: null, // Время последней волны
    waves: [], // Массив активных волн: { radius: number, startTime: number, id: number }
    maxBrightness: 1.0, // Максимальная яркость точек (0-1, где 1.0 = 100% белый цвет)
    depthDarkeningStrength: 1.85, // Сила затемнения по глубине (0 = нет эффекта, 1 = максимум)
    // Параметры свечения точек
    glowBrightness: 0.19, // Яркость свечения (0 = нет свечения, 1 = максимум)
    glowRadius: 50.0, // Радиус свечения (прямой множитель размера, 1-50)
    velocityGlowMultiplier: 0.10, // Множитель свечения от скорости движения точки (0 = нет эффекта, 2 = сильный эффект)
    // Параметры взрыва по клику
    explosionEnabled: true, // Флаг включения/выключения взрыва
    explosionForce: 10.0, // Сила разлёта (дальность)
    explosionSpeed: 0.20, // Скорость разлёта (множитель, 0.1-2.0)
    explosionReturnDelay: 1200, // Задержка перед возвратом точек (мс) - чем больше, тем дольше точки остаются разлетевшимися
    explosionGlowIntensity: 0.8, // Интенсивность подсветки (0-1)
    explosionGlowDuration: 500, // Длительность подсветки (мс)
    explosions: [], // Массив активных взрывов: { position: Vector3, startTime: number, id: number }
    // Параметры отступов формы от краёв viewport (в долях, 0.15 = 15%)
    paddingX: 0.15, // Отступ слева и справа (15%)
    paddingY: 0.30  // Отступ сверху и снизу (30%)
};

// ========== НАСТРОЙКА SVG ==========
// Путь к SVG файлу
const SVG_PATH = 'Starting Point.svg';

// ========== СОЗДАНИЕ КРУГЛОЙ ТЕКСТУРЫ ==========
function createCircleTexture(size = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    const center = size / 2;
    // Уменьшаем радиус чтобы создать прозрачную границу - это предотвращает артефакты
    // при масштабировании координат в шейдере (гипотеза F)
    const radius = center - 2;
    
    // Очищаем canvas прозрачным цветом
    ctx.clearRect(0, 0, size, size);
    
    // Сплошной белый круг с уменьшенным радиусом
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
    
    
    const texture = new THREE.CanvasTexture(canvas);
    // Устанавливаем premultipliedAlpha в false для правильного смешивания прозрачности
    texture.premultipliedAlpha = false;
    return texture;
}

// ========== СОЗДАНИЕ ТЕКСТУРЫ ТОЛЬКО СВЕЧЕНИЯ (без ядра) ==========
function createGlowTexture(size = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    const center = size / 2;
    
    // Очищаем canvas прозрачным цветом
    ctx.clearRect(0, 0, size, size);
    
    // Создаём радиальный градиент ТОЛЬКО для glow (без твёрдого ядра)
    // Свечение начинается от центра и плавно затухает к краям
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    
    // Контрастное свечение - очень яркое в центре, быстро затухает
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.25)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.03)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, center, 0, Math.PI * 2);
    ctx.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.premultipliedAlpha = false;
    return texture;
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Ортографическая камера для устранения перспективных искажений
const viewSize = 20; // Размер видимой области
const aspect = window.innerWidth / window.innerHeight;
const left = -viewSize * aspect / 2;
const right = viewSize * aspect / 2;
const top = viewSize / 2;
const bottom = -viewSize / 2;

const camera = new THREE.OrthographicCamera(
    left,
    right,
    top,
    bottom,
    0.1,
    1000
);
camera.position.z = 12;
camera.position.y = 0;
camera.position.x = 0;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Настраиваем рендерер для правильного смешивания прозрачности
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);

// ========== ЧАСТИЦЫ ==========
let geometry = null;
let positions = new Float32Array(CONFIG.particleCount * 3);
let originalPositions = new Float32Array(CONFIG.particleCount * 3);
let baseOriginalPositions = new Float32Array(CONFIG.particleCount * 3); // Базовые исходные позиции без скролла
let startPositions = new Float32Array(CONFIG.particleCount * 3); // Начальные позиции для анимации загрузки
let scrollDirections = new Float32Array(CONFIG.particleCount * 3); // Случайные направления разлёта для каждой частицы
let velocities = new Float32Array(CONFIG.particleCount * 3);
let colors = new Float32Array(CONFIG.particleCount * 3); // Цвета для каждой точки (RGB)
let sizes = new Float32Array(CONFIG.particleCount); // Индивидуальные размеры каждой точки
let baseSizes = new Float32Array(CONFIG.particleCount); // Базовые размеры точек (без эффектов волны)
let glows = new Float32Array(CONFIG.particleCount); // Интенсивность glow эффекта для каждой точки (0-1)
let explosionGlowEndTimes = new Float32Array(CONFIG.particleCount); // Время окончания подсветки взрыва для каждой точки
let explosionReturnTimes = new Float32Array(CONFIG.particleCount); // Время начала возврата после взрыва для каждой точки
let distanceBuffer = new Float32Array(CONFIG.particleCount); // Буфер расстояний для расчёта яркости без аллокаций
let cachedGlowBrightness = CONFIG.glowBrightness;
let cachedVelocityGlowMultiplier = CONFIG.velocityGlowMultiplier;
let glowStaticNeedsUpdate = true;
let wasWaveActive = false;
let points = null;
let svgGeometry = null;
let cloudCenter = new THREE.Vector3(0, 0, 0); // Центр облака частиц
let totalParticleCount = CONFIG.particleCount; // Общее количество точек (внутри + снаружи SVG)

const circleTexture = createCircleTexture(64);
const glowTexture = createGlowTexture(128);

// Функция генерации размеров частиц
function generateParticleSizes() {
    const baseSize = CONFIG.pointSize;
    const variation = CONFIG.sizeVariation;
    const minSize = baseSize * (1 - variation);
    const maxSize = baseSize * (1 + variation);
    
    // Убеждаемся, что массив sizes имеет правильный размер
    if (sizes.length !== totalParticleCount) {
        sizes = new Float32Array(totalParticleCount);
    }
    
    for (let i = 0; i < totalParticleCount; i++) {
        // Сохраняем невидимость точек вне формы (baseSizes[i] === 0)
        if (i >= CONFIG.particleCount && baseSizes && baseSizes[i] === 0) {
            sizes[i] = 0;
        } else {
            sizes[i] = minSize + Math.random() * (maxSize - minSize);
        }
    }
}

// Генерируем начальные размеры
generateParticleSizes();


// Вершинный шейдер для точек с поддержкой индивидуальных размеров и glow
const vertexShader = `
    attribute float size;
    attribute vec3 color;
    attribute float glow;
    uniform float sizeScale;
    uniform float glowRadiusMultiplier;
    varying vec3 vColor;
    varying float vGlow;
    
    void main() {
        vColor = color;
        vGlow = glow;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        
        // Для ортографической камеры используем простую формулу
        // sizeScale уже содержит правильный масштаб для viewport
        // Увеличиваем размер точки при glow для создания ореола (радиус контролируется glowRadiusMultiplier)
        float glowSize = 1.0 + glow * glowRadiusMultiplier;
        gl_PointSize = size * sizeScale * glowSize;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

// Фрагментный шейдер для точек с поддержкой текстуры, цветов и glow эффекта
const fragmentShader = `
    uniform sampler2D pointTexture;
    uniform sampler2D glowTexture;
    uniform float glowRadiusMultiplier;
    uniform float glowBrightnessMultiplier;
    varying vec3 vColor;
    varying float vGlow;
    
    void main() {
        // Масштабируем координаты для ядра точки (оно меньше из-за увеличенного размера при glow)
        // Используем glowRadiusMultiplier для согласованности с вершинным шейдером
        float coreScale = 1.0 + vGlow * glowRadiusMultiplier;
        
        // Центрируем и масштабируем координаты для ядра
        vec2 coreCoord = (gl_PointCoord - 0.5) * coreScale + 0.5;
        
        // Вычисляем расстояние от центра для определения видимости ядра
        // Используем smoothstep для плавного затухания вместо ClampToEdge (гипотеза H)
        vec2 centered = coreCoord - 0.5;
        float dist = length(centered) * 2.0; // 0 в центре, 1 на краях
        
        // Плавное затухание ядра к краям (от 0.9 до 1.0)
        float coreMask = 1.0 - smoothstep(0.9, 1.0, dist);
        
        // Получаем цвет glow (на полных координатах точки)
        vec4 glowColor = texture2D(glowTexture, gl_PointCoord);
        
        // Получаем цвет ядра только если координаты в допустимых пределах
        vec4 coreColor = vec4(0.0);
        if (coreCoord.x >= 0.0 && coreCoord.x <= 1.0 && coreCoord.y >= 0.0 && coreCoord.y <= 1.0) {
            coreColor = texture2D(pointTexture, coreCoord);
        }
        
        // Применяем маску затухания к ядру
        coreColor.a *= coreMask;
        
        // Простое аддитивное комбинирование (яркость контролируется glowBrightnessMultiplier)
        vec3 glowContrib = glowColor.rgb * vGlow * glowBrightnessMultiplier;
        vec3 coreContrib = coreColor.rgb * coreColor.a;
        
        // Финальный цвет = ядро + glow
        vec3 finalColor = coreContrib + glowContrib;
        
        // Альфа: максимум из ядра и glow
        float finalAlpha = max(coreColor.a, glowColor.a * vGlow);
        
        gl_FragColor = vec4(vColor * finalColor, finalAlpha);
    }
`;

// Вычисляем масштаб размера для ортографической камеры
// Для ортографической камеры размер точек должен быть простым
// Используем коэффициент, который дает правильный размер
const calculateSizeScale = () => {
    const viewportHeight = window.innerHeight;
    // Для ортографической камеры используем простой коэффициент
    // который дает размер примерно равный базовому size в пикселях
    // Уменьшаем в 2 раза, так как пользователь сказал, что точки в 2 раза крупнее
    return viewportHeight / 400.0;
};

const sizeScale = calculateSizeScale();

const material = new THREE.ShaderMaterial({
    uniforms: {
        pointTexture: { value: circleTexture },
        glowTexture: { value: glowTexture },
        sizeScale: { value: sizeScale },
        glowRadiusMultiplier: { value: CONFIG.glowRadius }, // Прямой множитель радиуса свечения
        glowBrightnessMultiplier: { value: 1.5 } // Множитель яркости свечения
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

// Обновляем sizeScale при изменении размера окна
window.addEventListener('resize', () => {
    material.uniforms.sizeScale.value = calculateSizeScale();
});

console.log('Three.js загружен:', typeof THREE !== 'undefined');
console.log('SVGLoader загружен:', typeof SVGLoader !== 'undefined');

// Функция для проверки, находится ли точка внутри mesh (оптимизированная версия)
// Использует меньше направлений для ускорения, но сохраняет точность
function isPointInsideMesh(point, mesh, raycaster) {
    try {
        // Используем только 3 направления для ускорения (вместо 6)
        // Это достаточно для определения, находится ли точка внутри объёма
        const directions = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 1)
        ];
        
        let insideCount = 0;
        let totalChecks = 0;
        
        // Проверяем по каждому направлению
        for (const direction of directions) {
            raycaster.set(point, direction);
            const intersects = raycaster.intersectObject(mesh, false);
            // Если нечётное число пересечений, точка внутри по этому направлению
            const isInside = intersects.length % 2 === 1;
            if (isInside) {
                insideCount++;
            }
            totalChecks++;
        }
        
        // Точка считается внутри, если она внутри по большинству направлений (минимум 2 из 3)
        const threshold = Math.ceil(totalChecks * 0.6); // Минимум 2 из 3
        return insideCount >= threshold;
    } catch (error) {
        console.error('Ошибка в isPointInsideMesh:', error);
        return false;
    }
}

// Функция для получения точек для закрашивания SVG формы (2D плоскость)
// Генерирует точки на поверхности SVG для их закрашивания
function getShapeVolumePoints(shapeGeometry, count, raycaster) {
    const points = [];
    const positions = shapeGeometry.attributes.position;
    const indices = shapeGeometry.index;
    const tempEdge1 = new THREE.Vector3();
    const tempEdge2 = new THREE.Vector3();
    const tempNormal = new THREE.Vector3();
    
    // Получаем все вершины из геометрии текста
    const vertices = [];
    for (let i = 0; i < positions.count; i++) {
        const v = new THREE.Vector3(
            positions.getX(i),
            positions.getY(i),
            positions.getZ(i)
        );
        vertices.push(v);
    }
    
    // Вычисляем площади треугольников для равномерного распределения
    const triangles = [];
    let totalArea = 0;
    
    if (indices && indices.count > 0) {
        // Используем существующие индексы
        for (let i = 0; i < indices.count; i += 3) {
            const i1 = indices.getX(i);
            const i2 = indices.getX(i + 1);
            const i3 = indices.getX(i + 2);
            
            const v1 = vertices[i1];
            const v2 = vertices[i2];
            const v3 = vertices[i3];
            
            // Вычисляем площадь треугольника
            tempEdge1.subVectors(v2, v1);
            tempEdge2.subVectors(v3, v1);
            const area = tempEdge1.cross(tempEdge2).length() * 0.5;
            
            // Игнорируем вырожденные треугольники (слишком маленькие)
            if (area > 0.0001) {
                triangles.push({ v1, v2, v3, area });
                totalArea += area;
            }
        }
    } else {
        // Если нет индексов, создаем треугольники из позиций напрямую
        for (let i = 0; i < vertices.length - 2; i += 3) {
            const v1 = vertices[i];
            const v2 = vertices[i + 1];
            const v3 = vertices[i + 2];
            
            // Вычисляем площадь треугольника
            tempEdge1.subVectors(v2, v1);
            tempEdge2.subVectors(v3, v1);
            const area = tempEdge1.cross(tempEdge2).length() * 0.5;
            
            if (area > 0.0001) {
                triangles.push({ v1, v2, v3, area });
                totalArea += area;
            }
        }
    }
    
    if (triangles.length === 0) {
        // Fallback: используем вершины
        if (vertices.length <= count) {
            return vertices.map(v => v.clone());
        }
        const step = vertices.length / count;
        for (let i = 0; i < count; i++) {
            const index = Math.floor(i * step);
            points.push(vertices[index].clone());
        }
        return points;
    }
    
    // Вычисляем накопленные площади для взвешенного выбора треугольников
    const cumulativeAreas = [];
    let cumulativeSum = 0;
    for (const tri of triangles) {
        cumulativeSum += tri.area;
        cumulativeAreas.push(cumulativeSum);
    }
    
    // Фильтруем треугольники: используем только те, что обращены "вверх" (нормаль с положительным Z)
    // Это исключает внутренние грани отверстий
    const frontFacingTriangles = [];
    let frontFacingArea = 0;
    
    for (const tri of triangles) {
        // Вычисляем нормаль треугольника
        tempEdge1.subVectors(tri.v2, tri.v1);
        tempEdge2.subVectors(tri.v3, tri.v1);
        const normal = tempNormal.crossVectors(tempEdge1, tempEdge2);
        
        // Используем только треугольники с нормалью, направленной вверх (Z > 0)
        // Это исключает внутренние грани отверстий
        if (normal.z > 0 && normal.length() > 0.0001) {
            frontFacingTriangles.push({ ...tri, area: tri.area });
            frontFacingArea += tri.area;
        }
    }
    
    // Если нет треугольников, обращённых вверх, используем все
    const trianglesToUse = frontFacingTriangles.length > 0 ? frontFacingTriangles : triangles;
    const areaToUse = frontFacingTriangles.length > 0 ? frontFacingArea : totalArea;
    
    // Вычисляем накопленные площади для выбранных треугольников
    const filteredCumulativeAreas = [];
    let filteredCumulativeSum = 0;
    for (const tri of trianglesToUse) {
        filteredCumulativeSum += tri.area;
        filteredCumulativeAreas.push(filteredCumulativeSum);
    }
    
    // Генерируем точки на поверхности букв (2D плоскость)
    const surfacePoints = [];
    
    
    // Генерируем точки на поверхности треугольников
    for (let i = 0; i < count; i++) {
        // Выбираем треугольник взвешенно по площади
        const randomArea = Math.random() * areaToUse;
        let triangleIndex = 0;
        for (let j = 0; j < filteredCumulativeAreas.length; j++) {
            if (randomArea <= filteredCumulativeAreas[j]) {
                triangleIndex = j;
                break;
            }
        }
        
        const triangle = trianglesToUse[triangleIndex];
        
        // Генерируем случайную точку на поверхности треугольника
        let u = Math.random();
        let v = Math.random();
        if (u + v > 1) {
            u = 1 - u;
            v = 1 - v;
        }
        const w = 1 - u - v;
        
        const surfacePoint = new THREE.Vector3();
        surfacePoint.addScaledVector(triangle.v1, u);
        surfacePoint.addScaledVector(triangle.v2, v);
        surfacePoint.addScaledVector(triangle.v3, w);
        
        // Устанавливаем Z в 0 для плоского текста (проецируем на плоскость Z=0)
        surfacePoint.z = 0;
        
        surfacePoints.push(surfacePoint);
    }
    
    
    
    // Если точек недостаточно, дублируем существующие
    if (surfacePoints.length === 0) {
        console.error('Не удалось сгенерировать точки! triangles:', triangles.length, 'vertices:', vertices.length);
    } else if (surfacePoints.length < count) {
        // Если точек меньше нужного, дублируем существующие
        const needed = count - surfacePoints.length;
        for (let i = 0; i < needed; i++) {
            const index = i % surfacePoints.length;
            surfacePoints.push(surfacePoints[index].clone());
        }
    }
    
    // Возвращаем сгенерированные точки
    return surfacePoints.map(p => p.clone());
    
    return points;
}

// Кэш для загруженного SVG
let cachedSVGData = null;
let svgLoadPromise = null;

// Функция загрузки SVG (с кэшированием)
function loadSVG() {
    // Если SVG уже загружен, возвращаем его сразу
    if (cachedSVGData) {
        return Promise.resolve(cachedSVGData);
    }
    
    // Если SVG уже загружается, возвращаем существующий промис
    if (svgLoadPromise) {
        return svgLoadPromise;
    }
    
    // Создаем новый промис для загрузки SVG
    svgLoadPromise = new Promise((resolve, reject) => {
        const loader = new SVGLoader();
        
        loader.load(
            SVG_PATH,
            (data) => {
                cachedSVGData = data; // Кэшируем загруженный SVG
                svgLoadPromise = null; // Сбрасываем промис после успешной загрузки
                resolve(data);
            },
            undefined,
            (error) => {
                svgLoadPromise = null; // Сбрасываем промис при ошибке
                reject(new Error(`Не удалось загрузить SVG: ${error}`));
            }
        );
    });
    
    return svgLoadPromise;
}

// Функция создания геометрии из SVG
async function createSVGGeometry(size = 2) {
    // Загружаем SVG (используем кэш, если он уже загружен)
    const svgData = await loadSVG();
    
    // Получаем paths из SVG
    if (!svgData.paths || svgData.paths.length === 0) {
        throw new Error('SVG не содержит path элементов');
    }
    
    // Собираем все shapes из всех paths
    const allShapes = [];
    
    for (const path of svgData.paths) {
        const shapesFromPath = SVGLoader.createShapes(path);
        allShapes.push(...shapesFromPath);
    }
    
    if (allShapes.length === 0) {
        throw new Error('Не удалось создать shapes из SVG paths');
    }
    
    // Создаем геометрию из всех shapes
    const geometries = [];
    
    for (const shape of allShapes) {
        const geometry = new THREE.ShapeGeometry(shape);
        geometries.push(geometry);
    }
    
    // Объединяем все геометрии в одну
    let mergedGeometry;
    if (geometries.length === 1) {
        mergedGeometry = geometries[0];
    } else {
        // Используем BufferGeometryUtils.mergeGeometries() вместо несуществующего метода merge()
        mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
    }
    
    // Вычисляем bounding box для масштабирования
    mergedGeometry.computeBoundingBox();
    const bbox = mergedGeometry.boundingBox;
    const svgWidth = bbox.max.x - bbox.min.x;
    const svgHeight = bbox.max.y - bbox.min.y;
    const svgMaxDimension = Math.max(svgWidth, svgHeight);
    
    // Масштабируем геометрию
    const scale = size / svgMaxDimension;
    mergedGeometry.scale(scale, -scale, 1); // Отрицательный Y для инверсии (SVG origin top-left, Three.js bottom-left)
    
    // Центрируем геометрию
    mergedGeometry.computeBoundingBox();
    mergedGeometry.center();
    mergedGeometry.computeBoundingBox();
    
    return mergedGeometry;
}

// Кэш для базового размера SVG (чтобы не вычислять каждый раз)
let cachedSVGBaseSize = null;
let cachedSVGWidth = null;
let cachedSVGHeight = null;

// Функция вычисления оптимального размера SVG
// Использует алгоритм "contain" — масштабирует SVG так, чтобы он помещался целиком
// с учётом минимальных отступов по X и Y
async function calculateOptimalSVGSize(baseSize = 1.0) {
    if (cachedSVGBaseSize === null) {
        // Создаем временную геометрию для вычисления bounding box
        const tempGeometry = await createSVGGeometry(baseSize);
        tempGeometry.computeBoundingBox();
        
        // Вычисляем размеры SVG
        const bbox = tempGeometry.boundingBox;
        cachedSVGWidth = bbox.max.x - bbox.min.x;
        cachedSVGHeight = bbox.max.y - bbox.min.y;
        cachedSVGBaseSize = Math.max(cachedSVGWidth, cachedSVGHeight);
        
        // Освобождаем память
        tempGeometry.dispose();
    }
    
    // Для ортографической камеры вычисляем видимую область
    const visibleWidth = camera.right - camera.left;
    const visibleHeight = camera.top - camera.bottom;
    
    // Доступная область с учётом отступов (paddingX и paddingY в долях)
    const availableWidth = visibleWidth * (1 - 2 * CONFIG.paddingX);
    const availableHeight = visibleHeight * (1 - 2 * CONFIG.paddingY);
    
    // Вычисляем масштаб по каждому измерению
    const scaleByWidth = availableWidth / cachedSVGWidth;
    const scaleByHeight = availableHeight / cachedSVGHeight;
    
    // Выбираем минимальный масштаб (contain) — чтобы форма помещалась целиком
    const baseScaleFactor = Math.min(scaleByWidth, scaleByHeight);
    
    return baseScaleFactor;
}

// Асинхронная генерация точек снаружи SVG батчами для избежания блокировки UI
async function generateOutsidePointsAsync(svgMesh, raycaster, targetCount, viewportBounds, batchSize = 500) {
    const outsidePoints = [];
    // Уменьшаем количество кандидатов с 10x до 5x для оптимизации
    const candidateCount = targetCount * 5;
    
    let processed = 0;
    
    return new Promise((resolve) => {
        function processBatch() {
            const batchEnd = Math.min(processed + batchSize, candidateCount);
            
            // Обрабатываем батч кандидатов
            for (let i = processed; i < batchEnd; i++) {
                const x = viewportBounds.left + Math.random() * (viewportBounds.right - viewportBounds.left);
                const y = viewportBounds.bottom + Math.random() * (viewportBounds.top - viewportBounds.bottom);
                const z = 0; // На той же плоскости, что и SVG
                
                const point = new THREE.Vector3(x, y, z);
                
                // Проверяем, что точка НЕ внутри SVG
                if (!isPointInsideMesh(point, svgMesh, raycaster)) {
                    outsidePoints.push(point);
                }
            }
            
            processed = batchEnd;
            
            // Продолжаем обработку или завершаем
            if (processed < candidateCount) {
                requestAnimationFrame(processBatch);
            } else {
                // Фильтруем точки для получения нужной плотности
                const filteredOutsidePoints = [];
                const outsideCount = outsidePoints.length;
                const selected = new Uint8Array(outsideCount);
                
                // Оставляем каждую 5-ю точку (т.к. кандидатов в 5 раз больше)
                for (let i = 0; i < outsideCount; i += 5) {
                    if (filteredOutsidePoints.length >= targetCount) break;
                    filteredOutsidePoints.push(outsidePoints[i]);
                    selected[i] = 1;
                }
                
                // Если не набрали достаточно точек, добавляем оставшиеся
                if (filteredOutsidePoints.length < targetCount && outsideCount > 0) {
                    const remaining = targetCount - filteredOutsidePoints.length;
                    const step = Math.max(1, Math.floor(outsideCount / remaining));
                    
                    let index = 0;
                    while (filteredOutsidePoints.length < targetCount && index < outsideCount) {
                        if (!selected[index]) {
                            selected[index] = 1;
                            filteredOutsidePoints.push(outsidePoints[index]);
                        }
                        index += step;
                    }
                    
                    // Fallback: добираем точки линейно, если шаг дал дубликаты
                    if (filteredOutsidePoints.length < targetCount) {
                        for (let i = 0; i < outsideCount && filteredOutsidePoints.length < targetCount; i++) {
                            if (!selected[i]) {
                                selected[i] = 1;
                                filteredOutsidePoints.push(outsidePoints[i]);
                            }
                        }
                    }
                }
                
                resolve(filteredOutsidePoints);
            }
        }
        
        // Запускаем обработку
        processBatch();
    });
}

// Функция генерации частиц на основе SVG
async function generateParticlesFromSVG() {
    // Вычисляем оптимальный масштаб для SVG с учётом padding (алгоритм contain)
    // baseScaleFactor — максимальный размер, при котором форма помещается с отступами
    const baseScaleFactor = await calculateOptimalSVGSize();
    
    // Применяем sphereRadius как множитель, но ограничиваем baseScaleFactor
    // (это максимум, который помещается с учётом padding)
    const scaleFactor = Math.min(baseScaleFactor * CONFIG.sphereRadius, baseScaleFactor);
    const finalSize = scaleFactor;
    
    // Создаем финальную геометрию с правильным размером
    svgGeometry = await createSVGGeometry(finalSize);
    svgGeometry.computeBoundingBox();
    
    // Используем raycaster для проверки точек внутри объёма
    const tempRaycaster = new THREE.Raycaster();
    const volumePoints = getShapeVolumePoints(svgGeometry, CONFIG.particleCount, tempRaycaster);
    
    // Создаем временные массивы только для точек внутри SVG
    // НЕ перезаписываем глобальные массивы, если они уже имеют правильный размер для totalParticleCount
    const tempPositions = new Float32Array(CONFIG.particleCount * 3);
    const tempOriginalPositions = new Float32Array(CONFIG.particleCount * 3);
    const tempBaseOriginalPositions = new Float32Array(CONFIG.particleCount * 3);
    const tempStartPositions = new Float32Array(CONFIG.particleCount * 3);
    const tempScrollDirections = new Float32Array(CONFIG.particleCount * 3);
    const tempVelocities = new Float32Array(CONFIG.particleCount * 3);
    const tempColors = new Float32Array(CONFIG.particleCount * 3);
    const tempSizes = new Float32Array(CONFIG.particleCount);
    const tempBaseSizes = new Float32Array(CONFIG.particleCount);
    
    // Генерируем размеры частиц для временных массивов
    const baseSize = CONFIG.pointSize;
    const variation = CONFIG.sizeVariation;
    const minSize = baseSize * (1 - variation);
    const maxSize = baseSize * (1 + variation);
    for (let i = 0; i < CONFIG.particleCount; i++) {
        tempSizes[i] = minSize + Math.random() * (maxSize - minSize);
    }
    tempBaseSizes.set(tempSizes);
    
    let particlesCreated = 0;
    let posMinX=Infinity,posMaxX=-Infinity,posMinY=Infinity,posMaxY=-Infinity,posMinZ=Infinity,posMaxZ=-Infinity;
    for (let i = 0; i < CONFIG.particleCount && i < volumePoints.length; i++) {
        const i3 = i * 3;
        const point = volumePoints[i];
        
        tempPositions[i3] = point.x;
        tempPositions[i3 + 1] = point.y;
        tempPositions[i3 + 2] = point.z;
        
        posMinX=Math.min(posMinX,point.x);posMaxX=Math.max(posMaxX,point.x);
        posMinY=Math.min(posMinY,point.y);posMaxY=Math.max(posMaxY,point.y);
        posMinZ=Math.min(posMinZ,point.z);posMaxZ=Math.max(posMaxZ,point.z);
        
        tempOriginalPositions[i3] = point.x;
        tempOriginalPositions[i3 + 1] = point.y;
        tempOriginalPositions[i3 + 2] = point.z;
        
        // Сохраняем базовые исходные позиции
        tempBaseOriginalPositions[i3] = point.x;
        tempBaseOriginalPositions[i3 + 1] = point.y;
        tempBaseOriginalPositions[i3 + 2] = point.z;
        
        // Генерируем случайное направление разлёта для каждой частицы (один раз при инициализации)
        const theta = Math.random() * Math.PI * 2; // Азимутальный угол (0 до 2π)
        const phi = Math.acos(2 * Math.random() - 1); // Полярный угол (равномерное распределение на сфере)
        tempScrollDirections[i3] = Math.sin(phi) * Math.cos(theta);
        tempScrollDirections[i3 + 1] = Math.sin(phi) * Math.sin(theta);
        tempScrollDirections[i3 + 2] = Math.cos(phi);
        
        tempVelocities[i3] = 0;
        tempVelocities[i3 + 1] = 0;
        tempVelocities[i3 + 2] = 0;
        
        // Инициализируем цвета как белые (1, 1, 1)
        tempColors[i3] = 1.0;
        tempColors[i3 + 1] = 1.0;
        tempColors[i3 + 2] = 1.0;
        particlesCreated++;
    }
    
    // Вычисляем центр облака частиц
    cloudCenter.set(0, 0, 0);
    for (let i = 0; i < particlesCreated; i++) {
        const i3 = i * 3;
        cloudCenter.x += tempBaseOriginalPositions[i3];
        cloudCenter.y += tempBaseOriginalPositions[i3 + 1];
        cloudCenter.z += tempBaseOriginalPositions[i3 + 2];
    }
    if (particlesCreated > 0) {
        cloudCenter.divideScalar(particlesCreated);
    }
    
    // Вычисляем радиус разлёта на основе размера формы
    const bbox = svgGeometry.boundingBox;
    const maxDimension = Math.max(
        bbox.max.x - bbox.min.x,
        bbox.max.y - bbox.min.y,
        bbox.max.z - bbox.min.z
    );
    const spreadRadius = maxDimension * 7.5; // Среднее между 5x и 10x
    
    // Генерируем случайные начальные позиции для анимации загрузки
    for (let i = 0; i < particlesCreated; i++) {
        const i3 = i * 3;
        
        // Генерируем случайное направление (единичный вектор на сфере)
        const theta = Math.random() * Math.PI * 2; // Азимутальный угол (0 до 2π)
        const phi = Math.acos(2 * Math.random() - 1); // Полярный угол (равномерное распределение на сфере)
        const direction = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        );
        
        // Генерируем случайное расстояние от 5x до 10x размера формы
        const distance = maxDimension * (5 + Math.random() * 5);
        
        // Вычисляем начальную позицию: центр + направление * расстояние
        const startPos = new THREE.Vector3()
            .copy(cloudCenter)
            .addScaledVector(direction, distance);
        
        // Сохраняем начальную позицию
        tempStartPositions[i3] = startPos.x;
        tempStartPositions[i3 + 1] = startPos.y;
        tempStartPositions[i3 + 2] = startPos.z;
        
        // Устанавливаем начальную позицию в positions (для анимации загрузки)
        tempPositions[i3] = startPos.x;
        tempPositions[i3 + 1] = startPos.y;
        tempPositions[i3 + 2] = startPos.z;
    }
    
    // ========== ГЕНЕРАЦИЯ ТОЧЕК ВОКРУГ SVG ==========
    // Создаем временный mesh для проверки точек внутри SVG
    const tempMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const svgMesh = new THREE.Mesh(svgGeometry, tempMaterial);
    
    // Генерируем точки вокруг SVG асинхронно батчами
    const targetOutsideCount = CONFIG.outsideParticleCount;
    const viewportBounds = {
        left: camera.left,
        right: camera.right,
        top: camera.top,
        bottom: camera.bottom
    };
    
    const checkRaycaster = new THREE.Raycaster();
    
    // Используем асинхронную генерацию для избежания блокировки UI
    const filteredOutsidePoints = await generateOutsidePointsAsync(
        svgMesh, 
        checkRaycaster, 
        targetOutsideCount, 
        viewportBounds,
        500 // batchSize - обрабатываем по 500 кандидатов за раз
    );
    
    const outsidePointsCount = filteredOutsidePoints.length;
    totalParticleCount = CONFIG.particleCount + outsidePointsCount;
    
    // ========== ОБЪЕДИНЕНИЕ МАССИВОВ ==========
    // Создаем новые массивы с увеличенным размером
    const newPositions = new Float32Array(totalParticleCount * 3);
    const newOriginalPositions = new Float32Array(totalParticleCount * 3);
    const newBaseOriginalPositions = new Float32Array(totalParticleCount * 3);
    const newStartPositions = new Float32Array(totalParticleCount * 3);
    const newScrollDirections = new Float32Array(totalParticleCount * 3);
    const newVelocities = new Float32Array(totalParticleCount * 3);
    const newColors = new Float32Array(totalParticleCount * 3);
    const newSizes = new Float32Array(totalParticleCount);
    const newBaseSizes = new Float32Array(totalParticleCount);
    const newExplosionGlowEndTimes = new Float32Array(totalParticleCount);
    const newExplosionReturnTimes = new Float32Array(totalParticleCount);
    const newDistanceBuffer = new Float32Array(totalParticleCount);
    
    // Копируем существующие точки (внутри SVG) из временных массивов
    const pointsToCopy = Math.min(CONFIG.particleCount, tempPositions.length / 3);
    const bytesToCopy = pointsToCopy * 3;
    
    newPositions.set(tempPositions.subarray(0, bytesToCopy));
    newOriginalPositions.set(tempOriginalPositions.subarray(0, bytesToCopy));
    newBaseOriginalPositions.set(tempBaseOriginalPositions.subarray(0, bytesToCopy));
    newStartPositions.set(tempStartPositions.subarray(0, bytesToCopy));
    newScrollDirections.set(tempScrollDirections.subarray(0, bytesToCopy));
    newVelocities.set(tempVelocities.subarray(0, bytesToCopy));
    newColors.set(tempColors.subarray(0, bytesToCopy));
    newSizes.set(tempSizes.subarray(0, pointsToCopy));
    newBaseSizes.set(tempBaseSizes.subarray(0, pointsToCopy));
    
    // Добавляем точки вокруг SVG
    const baseIndex = CONFIG.particleCount;
    
    
    // Используем уже вычисленный maxDimension (вычислен выше для точек внутри SVG)
    
    for (let i = 0; i < outsidePointsCount; i++) {
        const i3 = (baseIndex + i) * 3;
        const point = filteredOutsidePoints[i];
        
        newPositions[i3] = point.x;
        newPositions[i3 + 1] = point.y;
        newPositions[i3 + 2] = point.z;
        
        newOriginalPositions[i3] = point.x;
        newOriginalPositions[i3 + 1] = point.y;
        newOriginalPositions[i3 + 2] = point.z;
        
        newBaseOriginalPositions[i3] = point.x;
        newBaseOriginalPositions[i3 + 1] = point.y;
        newBaseOriginalPositions[i3 + 2] = point.z;
        
        // Генерируем случайное направление разлёта для скролла (как для точек внутри)
        const theta = Math.random() * Math.PI * 2; // Азимутальный угол (0 до 2π)
        const phi = Math.acos(2 * Math.random() - 1); // Полярный угол (равномерное распределение на сфере)
        newScrollDirections[i3] = Math.sin(phi) * Math.cos(theta);
        newScrollDirections[i3 + 1] = Math.sin(phi) * Math.sin(theta);
        newScrollDirections[i3 + 2] = Math.cos(phi);
        
        // Генерируем начальную позицию для анимации загрузки (разлет от текущей позиции)
        const basePos = new THREE.Vector3(point.x, point.y, point.z);
        
        // Генерируем случайное направление разлёта
        const startTheta = Math.random() * Math.PI * 2;
        const startPhi = Math.acos(2 * Math.random() - 1);
        const startDirection = new THREE.Vector3(
            Math.sin(startPhi) * Math.cos(startTheta),
            Math.sin(startPhi) * Math.sin(startTheta),
            Math.cos(startPhi)
        );
        
        // Генерируем случайное расстояние от 5x до 10x размера формы
        const startDistance = maxDimension * (5 + Math.random() * 5);
        
        // Начальная позиция = базовая позиция + направление * расстояние
        const startPos = basePos.clone().addScaledVector(startDirection, startDistance);
        
        newStartPositions[i3] = startPos.x;
        newStartPositions[i3 + 1] = startPos.y;
        newStartPositions[i3 + 2] = startPos.z;
        
        // Устанавливаем начальную позицию в positions (для анимации загрузки)
        newPositions[i3] = startPos.x;
        newPositions[i3 + 1] = startPos.y;
        newPositions[i3 + 2] = startPos.z;
        
        newVelocities[i3] = 0;
        newVelocities[i3 + 1] = 0;
        newVelocities[i3 + 2] = 0;
        
        // Генерируем размер для внешней точки (используем те же настройки)
        const baseSize = CONFIG.pointSize;
        const variation = CONFIG.sizeVariation;
        const minSize = baseSize * (1 - variation);
        const maxSize = baseSize * (1 + variation);
        
        // Определенный процент точек делаем невидимыми (размер 0)
        const invisibleChance = CONFIG.outsideInvisiblePercentage / 100;
        const shouldBeInvisible = Math.random() < invisibleChance;
        const generatedSize = shouldBeInvisible ? 0 : (minSize + Math.random() * (maxSize - minSize));
        
        newSizes[baseIndex + i] = generatedSize;
        newBaseSizes[baseIndex + i] = generatedSize; // Сохраняем базовый размер
        
        // Инициализируем цвета как белые
        newColors[i3] = 1.0;
        newColors[i3 + 1] = 1.0;
        newColors[i3 + 2] = 1.0;
    }
    
    
    // Заменяем старые массивы новыми
    positions = newPositions;
    originalPositions = newOriginalPositions;
    baseOriginalPositions = newBaseOriginalPositions;
    startPositions = newStartPositions;
    scrollDirections = newScrollDirections;
    velocities = newVelocities;
    colors = newColors;
    sizes = newSizes;
    baseSizes = newBaseSizes;
    explosionGlowEndTimes = newExplosionGlowEndTimes;
    explosionReturnTimes = newExplosionReturnTimes;
    distanceBuffer = newDistanceBuffer;
    
    // Обновляем geometry, если она уже создана (для постепенного добавления точек)
    if (geometry && points) {
        // Убеждаемся, что массив glows имеет правильный размер
        if (glows.length !== totalParticleCount) {
            glows = new Float32Array(totalParticleCount);
            glowStaticNeedsUpdate = true;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('glow', new THREE.BufferAttribute(glows, 1).setUsage(THREE.DynamicDrawUsage));
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
        geometry.attributes.size.needsUpdate = true;
        geometry.attributes.glow.needsUpdate = true;
    }
    
    // Очищаем временный mesh
    tempMaterial.dispose();
}

// Функция пересоздания системы точек
async function recreateParticles() {
    
    // Сохраняем старые массивы для точек внутри SVG перед пересозданием
    // Это нужно, чтобы сохранить позиции точек внутри формы при изменении количества точек вне формы
    const oldPositions = positions ? positions.slice(0, Math.min(CONFIG.particleCount * 3, positions.length)) : null;
    const oldOriginalPositions = originalPositions ? originalPositions.slice(0, Math.min(CONFIG.particleCount * 3, originalPositions.length)) : null;
    const oldBaseOriginalPositions = baseOriginalPositions ? baseOriginalPositions.slice(0, Math.min(CONFIG.particleCount * 3, baseOriginalPositions.length)) : null;
    const oldStartPositions = startPositions ? startPositions.slice(0, Math.min(CONFIG.particleCount * 3, startPositions.length)) : null;
    const oldScrollDirections = scrollDirections ? scrollDirections.slice(0, Math.min(CONFIG.particleCount * 3, scrollDirections.length)) : null;
    const oldVelocities = velocities ? velocities.slice(0, Math.min(CONFIG.particleCount * 3, velocities.length)) : null;
    const oldColors = colors ? colors.slice(0, Math.min(CONFIG.particleCount * 3, colors.length)) : null;
    const oldSizes = sizes ? sizes.slice(0, Math.min(CONFIG.particleCount, sizes.length)) : null;
    const oldBaseSizes = baseSizes ? baseSizes.slice(0, Math.min(CONFIG.particleCount, baseSizes.length)) : null;
    const oldExplosionGlowEndTimes = explosionGlowEndTimes ? explosionGlowEndTimes.slice(0, Math.min(CONFIG.particleCount, explosionGlowEndTimes.length)) : null;
    const oldExplosionReturnTimes = explosionReturnTimes ? explosionReturnTimes.slice(0, Math.min(CONFIG.particleCount, explosionReturnTimes.length)) : null;
    
    await generateParticlesFromSVG();
    
    // Восстанавливаем только originalPositions и baseOriginalPositions из сохраненных старых массивов
    // Это нужно, чтобы сохранить целевые позиции точек внутри формы при изменении количества точек вне формы
    // НЕ восстанавливаем positions и startPositions - они должны остаться для анимации появления
    if (oldOriginalPositions && originalPositions) {
        const pointsToRestore = Math.min(CONFIG.particleCount, oldOriginalPositions.length / 3, originalPositions.length / 3);
        const bytesToRestore = pointsToRestore * 3;
        
        // Восстанавливаем только целевые позиции (originalPositions) из старых массивов
        // Это сохранит позиции точек внутри формы, но позволит анимации появления работать
        originalPositions.set(oldOriginalPositions.subarray(0, bytesToRestore), 0);
        if (oldBaseOriginalPositions && baseOriginalPositions) {
            baseOriginalPositions.set(oldBaseOriginalPositions.subarray(0, bytesToRestore), 0);
        }
        
        // Восстанавливаем другие свойства, но НЕ positions и startPositions
        if (oldScrollDirections && scrollDirections) {
            scrollDirections.set(oldScrollDirections.subarray(0, bytesToRestore), 0);
        }
        if (oldVelocities && velocities) {
            velocities.set(oldVelocities.subarray(0, bytesToRestore), 0);
        }
        if (oldColors && colors) {
            colors.set(oldColors.subarray(0, bytesToRestore), 0);
        }
        if (oldSizes && sizes) {
            sizes.set(oldSizes.subarray(0, pointsToRestore), 0);
        }
        if (oldBaseSizes && baseSizes) {
            baseSizes.set(oldBaseSizes.subarray(0, pointsToRestore), 0);
        }
    }
    
    // Сохраняем старый объект points для удаления
    const oldPoints = points;
    const oldGeometry = geometry;
    
    // Создаем новую геометрию с правильным количеством точек
    geometry = new THREE.BufferGeometry();
    
    // Убеждаемся, что массив glows имеет правильный размер
    if (glows.length !== totalParticleCount) {
        glows = new Float32Array(totalParticleCount);
        glowStaticNeedsUpdate = true;
    }
    
    // Создаем новые буферы с точно нужным количеством точек
    const positionAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
    const colorAttr = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage);
    const sizeAttr = new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage);
    const glowAttr = new THREE.BufferAttribute(glows, 1).setUsage(THREE.DynamicDrawUsage);
    
    // Явно помечаем атрибуты для обновления
    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    glowAttr.needsUpdate = true;
    
    geometry.setAttribute('position', positionAttr);
    geometry.setAttribute('color', colorAttr);
    geometry.setAttribute('size', sizeAttr);
    geometry.setAttribute('glow', glowAttr);
    
    // Убеждаемся, что геометрия знает о количестве вершин
    geometry.setDrawRange(0, totalParticleCount);
    
    // Создаем новый объект Points с нуля
    points = new THREE.Points(geometry, material);
    
    // Удаляем старые точки из сцены (если они были)
    if (oldPoints) {
        // Удаляем points из сцены
        if (oldPoints.parent === scene) {
            scene.remove(oldPoints);
        }
        
        // Отключаем геометрию от points перед dispose
        oldPoints.geometry = null;
        oldPoints.material = null;
        
    }
    
    // Убеждаемся, что в сцене нет других Points объектов (на случай ошибок)
    for (let i = scene.children.length - 1; i >= 0; i--) {
        const child = scene.children[i];
        if (child instanceof THREE.Points && child !== points) {
            if (child.geometry) {
                child.geometry.dispose();
            }
            scene.remove(child);
        }
    }
    
    // Добавляем новый points в сцену
    scene.add(points);
    
    // Очищаем старую геометрию после добавления нового объекта
    if (oldGeometry && oldGeometry !== geometry) {
        // Очищаем все атрибуты геометрии
        const attrs = oldGeometry.attributes;
        for (const key in attrs) {
            if (attrs[key] instanceof THREE.BufferAttribute) {
                attrs[key].dispose();
            }
        }
        oldGeometry.dispose();
    }
    
    // Перезапускаем анимацию загрузки при пересоздании частиц
    CONFIG.isLoadingAnimation = true;
    CONFIG.loadAnimationStartTime = Date.now();
    // Обновляем исходные позиции на основе текущего скролла
    updateOriginalPositionsFromScroll();
}

// Функция масштабирования SVG объекта
async function scaleSVGObject(newSize) {
    CONFIG.sphereRadius = newSize;
    
    // Пересоздаем SVG геометрию с новым размером
    svgGeometry = null;
    cachedSVGBaseSize = null; // Сбрасываем кэш размера
    cachedSVGWidth = null;
    cachedSVGHeight = null;
    await generateParticlesFromSVG();
    
    // Обновляем геометрию точек
    if (points) {
        scene.remove(points);
        if (geometry) {
            geometry.dispose();
        }
    }
    
    geometry = new THREE.BufferGeometry();
    // Убеждаемся, что массив glows имеет правильный размер
    if (glows.length !== totalParticleCount) {
        glows = new Float32Array(totalParticleCount);
        glowStaticNeedsUpdate = true;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('glow', new THREE.BufferAttribute(glows, 1).setUsage(THREE.DynamicDrawUsage));
    
    points = new THREE.Points(geometry, material);
    scene.add(points);
}

// Флаг готовности
let isInitialized = false;

// Инициализация
(async () => {
    try {
        await generateParticlesFromSVG();
        
        // Создаем geometry с текущими массивами (включая точки снаружи, если они уже добавлены)
        geometry = new THREE.BufferGeometry();
        // Убеждаемся, что массив glows имеет правильный размер
        if (glows.length !== totalParticleCount) {
            glows = new Float32Array(totalParticleCount);
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('glow', new THREE.BufferAttribute(glows, 1).setUsage(THREE.DynamicDrawUsage));
        points = new THREE.Points(geometry, material);
        scene.add(points);
        isInitialized = true;
        
        // Устанавливаем время начала анимации загрузки
        CONFIG.loadAnimationStartTime = Date.now();
        // Обновляем исходные позиции на основе текущего скролла
        updateOriginalPositionsFromScroll();
        console.log('Инициализация завершена успешно');
    } catch (error) {
        console.error('Ошибка при инициализации SVG:', error);
        document.body.innerHTML = '<div style="color: white; padding: 20px; font-family: monospace; background: #222; position: fixed; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; z-index: 10000; flex-direction: column; text-align: center;"><h2>Ошибка загрузки SVG</h2><p>Не удалось загрузить SVG файл "Starting Point.svg".</p><p style="color: #999; font-size: 12px; margin-top: 20px;">Проверьте консоль браузера (F12) для деталей.</p></div>';
    }
})();

// ========== ВЗАИМОДЕЙСТВИЕ ==========
const mouse = new THREE.Vector2();
const mouse3D = new THREE.Vector3();
const previousMouse = new THREE.Vector2();
const mouseVelocity = new THREE.Vector2();
let mouseMovedThisFrame = false; // Флаг: было ли движение курсора в этом кадре

const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

function updateMousePosition(event) {
    previousMouse.copy(mouse);
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    mouseVelocity.x = mouse.x - previousMouse.x;
    mouseVelocity.y = mouse.y - previousMouse.y;
    mouseMovedThisFrame = true; // Отмечаем, что было движение
    
    raycaster.setFromCamera(mouse, camera);
    const intersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectionPoint);
    mouse3D.copy(intersectionPoint);
}

let isPointerDown = false;
let isPointerInsideCanvas = false; // Флаг: курсор находится внутри канваса

function onPointerMove(event) {
    isPointerInsideCanvas = true;
    updateMousePosition(event);
}

function onPointerDown(event) {
    isPointerDown = true;
    isPointerInsideCanvas = true;
    updateMousePosition(event);
}

function onPointerUp(event) {
    isPointerDown = false;
}

function onPointerLeave(event) {
    isPointerInsideCanvas = false;
    // Сбрасываем скорость мыши, чтобы частицы не продолжали реагировать
    mouseVelocity.set(0, 0);
}

function onPointerEnter(event) {
    isPointerInsideCanvas = true;
}

renderer.domElement.addEventListener('pointermove', onPointerMove);
renderer.domElement.addEventListener('pointerdown', onPointerDown);
renderer.domElement.addEventListener('pointerup', onPointerUp);
renderer.domElement.addEventListener('pointerleave', onPointerLeave);
renderer.domElement.addEventListener('pointerenter', onPointerEnter);

// ========== ВЗРЫВ ПО КЛИКУ ==========
let explosionIdCounter = 0;

function onExplosionClick(event) {
    if (!CONFIG.explosionEnabled) return;
    
    // Вычисляем нормализованные координаты мыши
    const clickMouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    
    // Вычисляем 3D позицию клика через raycaster
    const clickRaycaster = new THREE.Raycaster();
    clickRaycaster.setFromCamera(clickMouse, camera);
    const clickPosition = new THREE.Vector3();
    clickRaycaster.ray.intersectPlane(plane, clickPosition);
    
    // Создаем объект взрыва
    const explosion = {
        position: clickPosition.clone(),
        startTime: performance.now(),
        id: explosionIdCounter++,
        applied: false // Флаг, что импульс уже применён
    };
    
    // Добавляем взрыв в массив
    CONFIG.explosions.push(explosion);
}

renderer.domElement.addEventListener('click', onExplosionClick);

// ========== СКРОЛЛ ==========
let scrollProgress = 0; // Нормализованная позиция скролла (0-1)
let previousScrollProgress = 0;

// Функция обновления исходных позиций на основе скролла
function updateOriginalPositionsFromScroll() {
    if (!isInitialized || baseOriginalPositions.length === 0) return;
    
    // Обрабатываем все точки (внутри + снаружи SVG)
    const actualParticleCount = Math.min(totalParticleCount, baseOriginalPositions.length / 3);
    const spreadDistance = scrollProgress * CONFIG.scrollSpreadForce * 1.0; // Расстояние разлёта
    
    for (let i = 0; i < actualParticleCount; i++) {
        const i3 = i * 3;
        // Вычисляем смещённую исходную позицию на основе базовой позиции и направления разлёта
        originalPositions[i3] = baseOriginalPositions[i3] + scrollDirections[i3] * spreadDistance;
        originalPositions[i3 + 1] = baseOriginalPositions[i3 + 1] + scrollDirections[i3 + 1] * spreadDistance;
        originalPositions[i3 + 2] = baseOriginalPositions[i3 + 2] + scrollDirections[i3 + 2] * spreadDistance;
    }
}

function updateScrollProgress() {
    const maxScroll = (CONFIG.scrollDepth * window.innerHeight) / 100;
    previousScrollProgress = scrollProgress;
    scrollProgress = Math.max(0, Math.min(1, window.scrollY / maxScroll));

    // Обновляем исходные позиции только если scrollProgress изменился
    if (Math.abs(scrollProgress - previousScrollProgress) > 0.001) {
        updateOriginalPositionsFromScroll();
    }
}

// Throttling для производительности
let scrollTimeout = null;
window.addEventListener('scroll', () => {
    if (scrollTimeout === null) {
        scrollTimeout = requestAnimationFrame(() => {
            updateScrollProgress();
            scrollTimeout = null;
        });
    }
}, { passive: true });

// Инициализация при загрузке
updateScrollProgress();

// ========== ФИЗИКА ==========
const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempVector3 = new THREE.Vector3();
const tempVector4 = new THREE.Vector3(); // Дополнительный временный вектор для вычислений
const tempVector5 = new THREE.Vector3(); // Временный вектор для скролла
const tempPerpendicular = new THREE.Vector3();
const tempPerpendicular2 = new THREE.Vector3();
const tempChaoticDirection = new THREE.Vector3();
const waveCenter = new THREE.Vector3(0, 0, 0); // Центр экрана (используется для волн)

// Функция для генерации случайного 3D направления с угловым отклонением
function randomDirection3D(baseDirection, maxAngleDegrees, chaosStrength, out = tempChaoticDirection) {
    // Преобразуем угол в радианы
    const maxAngle = (maxAngleDegrees * Math.PI) / 180;
    
    // Генерируем случайный угол отклонения (0 до maxAngle)
    const angle = Math.random() * maxAngle * chaosStrength;
    
    // Генерируем случайный азимутальный угол (0 до 2π)
    const azimuth = Math.random() * Math.PI * 2;
    
    // Генерируем случайный вектор перпендикулярный базовому направлению
    // Используем переиспользуемые векторы для минимизации аллокаций
    if (Math.abs(baseDirection.x) < 0.9) {
        tempPerpendicular.set(1, 0, 0);
    } else {
        tempPerpendicular.set(0, 1, 0);
    }
    tempPerpendicular.crossVectors(baseDirection, tempPerpendicular).normalize();
    
    // Создаём второй перпендикулярный вектор
    tempPerpendicular2.crossVectors(baseDirection, tempPerpendicular).normalize();
    
    // Генерируем случайное отклонение в плоскости, перпендикулярной базовому направлению
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    const cosAzimuth = Math.cos(azimuth);
    const sinAzimuth = Math.sin(azimuth);
    
    // Комбинируем базовое направление с перпендикулярными компонентами
    out.copy(baseDirection)
        .multiplyScalar(cosAngle)
        .addScaledVector(tempPerpendicular, sinAngle * cosAzimuth)
        .addScaledVector(tempPerpendicular2, sinAngle * sinAzimuth)
        .normalize();
    
    return out;
}

// Функция вычисления значения кубической кривой Безье для easing
// t: прогресс времени (0-1)
// p1x, p1y, p2x, p2y: контрольные точки Безье (фиксированные точки: (0,0) и (1,1))
// Возвращает значение кривой (0-1), которое используется как множитель скорости
function bezierEasing(t, p1x, p1y, p2x, p2y) {
    // Ограничиваем t в диапазоне [0, 1]
    t = Math.max(0, Math.min(1, t));
    
    // Кубическая кривая Безье: B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
    // где P₀ = (0,0), P₁ = (p1x, p1y), P₂ = (p2x, p2y), P₃ = (1,1)
    const oneMinusT = 1 - t;
    const oneMinusT2 = oneMinusT * oneMinusT;
    const oneMinusT3 = oneMinusT2 * oneMinusT;
    const t2 = t * t;
    const t3 = t2 * t;
    
    // Вычисляем Y-координату кривой
    const y = oneMinusT3 * 0 + 
              3 * oneMinusT2 * t * p1y + 
              3 * oneMinusT * t2 * p2y + 
              t3 * 1;
    
    return y;
}

function updatePhysics() {
    // Проверяем, что геометрия инициализирована
    if (!isInitialized || !geometry || !geometry.attributes.position) {
        return;
    }
    
    // Сбрасываем скорость мыши, если не было движения в этом кадре
    // Это исправляет баг, когда точки продолжают двигаться после остановки курсора
    if (!mouseMovedThisFrame) {
        mouseVelocity.set(0, 0);
    }
    mouseMovedThisFrame = false; // Сбрасываем флаг для следующего кадра
    
    const positionsArray = geometry.attributes.position.array;
    const nowDate = Date.now();
    
    // Логика анимации загрузки (пружинная физика)
    if (CONFIG.isLoadingAnimation && CONFIG.loadAnimationStartTime !== null) {
        const elapsed = nowDate - CONFIG.loadAnimationStartTime;
        const progress = Math.min(1, elapsed / CONFIG.loadAnimationDuration);
        
        // Вычисляем значение кривой Безье для текущего прогресса
        // Кривая определяет прогресс интерполяции в разные моменты времени
        // Для easing-функции используем только Y-координату, так как X уже задан параметром progress
        const easingValue = bezierEasing(
            progress,
            CONFIG.loadAnimationEasingCurve.p1x,
            CONFIG.loadAnimationEasingCurve.p1y,
            CONFIG.loadAnimationEasingCurve.p2x,
            CONFIG.loadAnimationEasingCurve.p2y
        );
        
        
        // Обрабатываем все точки (внутри + снаружи SVG)
        const actualParticleCount = Math.min(totalParticleCount, positionsArray.length / 3);
        
        // Прямая интерполяция между начальными и целевыми позициями
        // easingValue управляется кривой Безье и определяет прогресс анимации
        for (let i = 0; i < actualParticleCount; i++) {
            const i3 = i * 3;
            if (i3 + 2 >= positionsArray.length) break;
            
            // Начальная позиция
            const startX = startPositions[i3];
            const startY = startPositions[i3 + 1];
            const startZ = startPositions[i3 + 2];
            
            // Целевая позиция
            const targetX = originalPositions[i3];
            const targetY = originalPositions[i3 + 1];
            const targetZ = originalPositions[i3 + 2];
            
            // Линейная интерполяция: position = start + (target - start) * easingValue
            positionsArray[i3] = startX + (targetX - startX) * easingValue;
            positionsArray[i3 + 1] = startY + (targetY - startY) * easingValue;
            positionsArray[i3 + 2] = startZ + (targetZ - startZ) * easingValue;
        }
        
        geometry.attributes.position.needsUpdate = true;
        
        // Обновляем цвета на основе ТОЛЬКО Z-расстояния от камеры во время анимации загрузки
        // FIX: Используем только Z-координату, чтобы избежать эффекта виньетки (затемнения по краям экрана)
        const colorsArray = geometry.attributes.color ? geometry.attributes.color.array : null;
        if (colorsArray) {
            const camZ = camera.position.z;
            // Используем те же фиксированные параметры, что и после анимации
            const fixedMinDistance = 0;
            const fixedMaxDistance = 70;
            const fixedDistanceRange = fixedMaxDistance - fixedMinDistance;
            
            // Обновляем цвета на основе ТОЛЬКО Z-расстояния от камеры
            for (let i = 0; i < actualParticleCount; i++) {
                const i3 = i * 3;
                if (i3 + 2 >= colorsArray.length) break;
                
                // Используем только Z-расстояние (как после анимации)
                const dz = positionsArray[i3 + 2] - camZ;
                const distance = Math.abs(dz);
                
                // Нормализуем расстояние с фиксированным диапазоном
                const normalizedDistance = Math.max(0, Math.min(1, distance / fixedDistanceRange));
                
                // Применяем эффект глубины с CONFIG.depthDarkeningStrength
                const brightness = 1.0 - normalizedDistance * CONFIG.depthDarkeningStrength;
                const clampedBrightness = Math.max(0.0, Math.min(1.0, brightness));
                
                colorsArray[i3] = clampedBrightness;
                colorsArray[i3 + 1] = clampedBrightness;
                colorsArray[i3 + 2] = clampedBrightness;
            }
            
            geometry.attributes.color.needsUpdate = true;
        }
        
        // Плавное нарастание glow во время анимации загрузки
        // Используем easingValue чтобы glow синхронно появлялся с анимацией позиций
        const targetGlow = CONFIG.glowBrightness;
        const currentGlowValue = targetGlow * easingValue;
        for (let i = 0; i < actualParticleCount && i < glows.length; i++) {
            glows[i] = currentGlowValue;
        }
        if (geometry.attributes.glow) {
            geometry.attributes.glow.needsUpdate = true;
        }
        
        // Проверяем, завершена ли анимация по времени
        if (progress >= 1.0) {
            CONFIG.isLoadingAnimation = false;
            // Инициализируем первую волну после завершения анимации появления
            if (CONFIG.waveEnabled && CONFIG.lastWaveTime === null) {
                CONFIG.lastWaveTime = nowDate;
            }
        } else {
            return; // Пропускаем обычную физику во время анимации загрузки
        }
    }
    const colorsArray = geometry.attributes.color ? geometry.attributes.color.array : null;
    
    // ========== ЛОГИКА ВОЛНЫ ==========
    const now = nowDate;
    
    // Вычисляем максимальный радиус волны (диагональ видимой области камеры)
    const viewportWidth = camera.right - camera.left;
    const viewportHeight = camera.top - camera.bottom;
    const maxWaveRadius = Math.sqrt(viewportWidth * viewportWidth + viewportHeight * viewportHeight) / 2;
    
    // Предвычисляем границы влияния всех волн для оптимизации
    let waveBoundsMin = Infinity;
    let waveBoundsMax = -Infinity;
    const waveSigma = CONFIG.waveWidth / 2;
    const waveCutoffDistance = 2 * waveSigma; // Максимальное расстояние влияния волны
    const waveInvSigma = waveSigma > 0 ? 1.0 / waveSigma : 0;
    
    // Создаём новые волны и распространяем существующие
    if (CONFIG.waveEnabled && !CONFIG.isLoadingAnimation) {
        // Инициализируем первую волну после завершения анимации появления
        if (CONFIG.lastWaveTime === null) {
            CONFIG.lastWaveTime = now;
        }
        
        // Создаём новую волну каждую секунду, независимо от других
        const timeSinceLastWave = now - CONFIG.lastWaveTime;
        if (timeSinceLastWave >= CONFIG.waveInterval) {
            CONFIG.waves.push({
                radius: 0,
                startTime: now,
                id: now
            });
            CONFIG.lastWaveTime = now;
        }
        
        // Распространяем все активные волны и удаляем вышедшие за пределы
        const dt = 0.016; // Примерно 1/60 секунды
        for (let i = CONFIG.waves.length - 1; i >= 0; i--) {
            const wave = CONFIG.waves[i];
            wave.radius += CONFIG.waveSpeed * dt * CONFIG.timeScale;
            
            // Удаляем волны, которые вышли за пределы экрана
            if (wave.radius >= maxWaveRadius + CONFIG.waveWidth) {
                CONFIG.waves.splice(i, 1);
            } else {
                // Предвычисляем границы влияния для early exit оптимизации
                const waveCenterRadius = wave.radius - CONFIG.waveWidth / 2;
                const waveMinRadius = waveCenterRadius - waveCutoffDistance;
                const waveMaxRadius = waveCenterRadius + waveCutoffDistance;
                waveBoundsMin = Math.min(waveBoundsMin, waveMinRadius);
                waveBoundsMax = Math.max(waveBoundsMax, waveMaxRadius);
            }
        }
    }
    
    // Проверяем, что массив имеет правильный размер
    // Используем totalParticleCount для обработки всех точек (внутри + снаружи SVG)
    // ВАЖНО: Ограничиваем actualParticleCount размером самых маленьких массивов, чтобы избежать выхода за границы
    const positionsCount = positionsArray.length / 3;
    const originalCount = originalPositions ? originalPositions.length / 3 : 0;
    const startCount = startPositions ? startPositions.length / 3 : 0;
    const velocitiesCount = velocities ? velocities.length / 3 : 0;
    const colorsCount = colors ? colors.length / 3 : 0;
    // Используем минимальный размер из всех массивов, чтобы гарантировать безопасный доступ
    const actualParticleCount = Math.min(
        totalParticleCount,
        positionsCount,
        originalCount,
        startCount,
        velocitiesCount,
        colorsCount
    );
    
    if (!distanceBuffer || distanceBuffer.length < actualParticleCount) {
        distanceBuffer = new Float32Array(actualParticleCount);
    }
    
    const camZ = camera.position.z;
    
    // Вычисляем глубину (только Z-расстояние от камеры)
    // Используем ТОЛЬКО Z-координату, чтобы точки по бокам канваса НЕ затемнялись
    // FIX: Используем ФИКСИРОВАННЫЙ диапазон глубины для расчёта яркости,
    // чтобы яркость каждой точки зависела только от её собственной Z-позиции,
    // а не от позиций других точек
    
    // Фиксированные параметры для расчёта глубины:
    // - Камера на Z=12, точки изначально около Z=0 (расстояние ~12)
    // - При движении точки могут уходить в Z от -50 до +50
    // - Расстояние от камеры: Z=0 → dist=12, Z=-50 → dist=62, Z=50 → dist=38
    // Используем фиксированный диапазон расстояний для стабильного расчёта яркости
    const fixedMinDistance = 0;   // Минимальное расстояние (точка прямо на камере - теоретический минимум)
    const fixedMaxDistance = 70;  // Максимальное расстояние (с запасом для скролла/взрывов)
    const fixedDistanceRange = fixedMaxDistance - fixedMinDistance; // = 70
    
    for (let i = 0; i < actualParticleCount; i++) {
        const i3 = i * 3;
        if (i3 + 2 >= positionsArray.length) break;
        
        // Используем ТЕКУЩУЮ Z-позицию для эффекта глубины
        const dz = positionsArray[i3 + 2] - camZ;
        const distance = Math.abs(dz);
        distanceBuffer[i] = distance;
    }
    
    // Используем фиксированный диапазон вместо динамического
    const distanceRange = fixedDistanceRange;
    
    const speed = Math.sqrt(mouseVelocity.x * mouseVelocity.x + mouseVelocity.y * mouseVelocity.y);
    const forceMultiplier = Math.min(speed * CONFIG.forceStrength, CONFIG.forceStrength * 2);
    const interactionRadiusSq = CONFIG.interactionRadius * CONFIG.interactionRadius;
    const interactionActive = isPointerInsideCanvas && (isPointerDown || speed > 0.001);
    const hasExplosions = CONFIG.explosionEnabled && CONFIG.explosions.length > 0;
    const waveActive = CONFIG.waveEnabled && CONFIG.waves.length > 0;
    const nowPerf = performance.now();
    
    let sizesUpdated = false;
    let glowsUpdated = false;
    
    for (let i = 0; i < actualParticleCount; i++) {
        const i3 = i * 3;
        if (i3 + 2 >= positionsArray.length) break;
        
        tempVector.set(
            positionsArray[i3],
            positionsArray[i3 + 1],
            positionsArray[i3 + 2]
        );
        
        // Проверяем, что курсор находится внутри канваса перед применением сил
        if (interactionActive) {
            // Используем distance squared для оптимизации (избегаем sqrt до проверки радиуса)
            const dx = positionsArray[i3] - mouse3D.x;
            const dy = positionsArray[i3 + 1] - mouse3D.y;
            const dz = positionsArray[i3 + 2] - mouse3D.z;
            const distanceSq = dx * dx + dy * dy + dz * dz;
            
            if (distanceSq < interactionRadiusSq) {
                // Вычисляем расстояние только если частица в радиусе взаимодействия
                const distance = Math.sqrt(distanceSq);
                // Базовое направление от курсора к точке
                const baseDirection = tempVector2.subVectors(tempVector, mouse3D).normalize();
                
                // Применяем случайное угловое отклонение для создания хаотичности
                const chaoticDirection = randomDirection3D(
                    baseDirection, 
                    CONFIG.chaosAngle, 
                    CONFIG.chaosStrength,
                    tempChaoticDirection
                );
                
                // Вычисляем тангенциальное направление (перпендикулярно радиус-вектору)
                // Оптимизация: переиспользуем временные векторы вместо создания новых
                // Используем векторное произведение для получения перпендикулярного вектора
                let tangent = tempVector4.crossVectors(baseDirection, tempVector5.set(0, 0, 1));
                if (tangent.length() < 0.1) {
                    // Если векторы коллинеарны, используем другой базовый вектор
                    tangent.crossVectors(baseDirection, tempVector5.set(1, 0, 0));
                }
                tangent.normalize();
                
                // Создаём второй перпендикулярный вектор для полного тангенциального пространства
                // Используем tempVector3 для временного хранения (он не используется в этот момент)
                const tangent2 = tempVector3.crossVectors(baseDirection, tangent).normalize();
                
                // Добавляем случайную тангенциальную компоненту в плоскости, перпендикулярной радиус-вектору
                const tangentialAngle = Math.random() * Math.PI * 2;
                const tangentX = Math.cos(tangentialAngle);
                const tangentY = Math.sin(tangentialAngle);
                tangent.multiplyScalar(tangentX).addScaledVector(tangent2, tangentY);
                
                // Вычисляем силу с расстоянием
                const distanceFactor = 1 - distance / CONFIG.interactionRadius;
                const baseForce = distanceFactor * forceMultiplier;
                
                // Добавляем случайную вариацию силы (0.7-1.3)
                const forceVariation = 0.7 + Math.random() * 0.6;
                const force = baseForce * forceVariation;
                
                // Комбинируем радиальную и тангенциальную силы
                const radialForce = force * (1 - CONFIG.tangentialForceRatio);
                const tangentialForce = force * CONFIG.tangentialForceRatio;
                
                // Добавляем случайную Z-компоненту для трёхмерности
                const zComponent = (Math.random() - 0.5) * 2 * CONFIG.zAxisStrength;
                
                // Применяем силы к скорости
                // Оптимизация: переиспользуем tempVector5 вместо создания нового Vector3
                const finalDirection = tempVector5
                    .copy(chaoticDirection)
                    .multiplyScalar(radialForce)
                    .addScaledVector(tangent, tangentialForce);
                
                velocities[i3] += finalDirection.x * 0.2 * CONFIG.timeScale;
                velocities[i3 + 1] += finalDirection.y * 0.2 * CONFIG.timeScale;
                velocities[i3 + 2] += (finalDirection.z + zComponent) * 0.2 * CONFIG.timeScale;
            }
        }
        
        // Автономное движение - плавные случайные силы (применяются не каждый кадр для плавности)
        // Оптимизация: генерируем случайные значения только если нужно
        if (CONFIG.autonomousMotionStrength > 0 && Math.random() < 0.3) {
            const randomFactor = CONFIG.autonomousMotionStrength * 0.3 * CONFIG.timeScale;
            velocities[i3] += (Math.random() - 0.5) * randomFactor;
            velocities[i3 + 1] += (Math.random() - 0.5) * randomFactor;
            velocities[i3 + 2] += (Math.random() - 0.5) * randomFactor;
        }
        
        // ========== ВОЗДЕЙСТВИЕ ВЗРЫВА ==========
        // Взрыв затрагивает ВСЕ точки и использует scrollDirections для 3D разлёта
        if (hasExplosions) {
            for (const explosion of CONFIG.explosions) {
                if (explosion.applied) continue; // Пропускаем уже применённые взрывы
                
                // Используем предвычисленные направления scrollDirections для 3D разлёта
                // Это те же направления, что используются при скролле - равномерно распределены на сфере
                const expDirX = scrollDirections[i3];
                const expDirY = scrollDirections[i3 + 1];
                const expDirZ = scrollDirections[i3 + 2];
                
                // Добавляем небольшую случайность для более естественного эффекта
                const randomFactor = 0.2;
                const randX = (Math.random() - 0.5) * randomFactor;
                const randY = (Math.random() - 0.5) * randomFactor;
                const randZ = (Math.random() - 0.5) * randomFactor;
                
                // Применяем импульс к скорости (сила одинакова для всех точек)
                const impulseStrength = CONFIG.explosionForce * 0.1;
                velocities[i3] += (expDirX + randX) * impulseStrength;
                velocities[i3 + 1] += (expDirY + randY) * impulseStrength;
                velocities[i3 + 2] += (expDirZ + randZ) * impulseStrength;
                
                // Устанавливаем время начала возврата (задержка перед возвратом)
                const returnTime = nowPerf + CONFIG.explosionReturnDelay;
                if (i < explosionReturnTimes.length) {
                    explosionReturnTimes[i] = Math.max(explosionReturnTimes[i], returnTime);
                }
                
                // Устанавливаем время окончания подсветки для этой точки
                const glowEndTime = nowPerf + CONFIG.explosionGlowDuration;
                if (i < explosionGlowEndTimes.length) {
                    explosionGlowEndTimes[i] = Math.max(explosionGlowEndTimes[i], glowEndTime);
                }
            }
        }
        
        // ========== ВОЗДЕЙСТВИЕ ВОЛНЫ ==========
        let totalWaveSizeFactor = 0; // Множитель размера от волн (накапливаем forceFactor)
        
        if (waveActive) {
            // Вычисляем расстояние от центра волны до частицы (distance squared для оптимизации)
            const dx = positionsArray[i3] - waveCenter.x;
            const dy = positionsArray[i3 + 1] - waveCenter.y;
            const dz = positionsArray[i3 + 2] - waveCenter.z;
            const waveDistanceSq = dx * dx + dy * dy + dz * dz;
            const cachedWaveDistance = Math.sqrt(waveDistanceSq);
            
            // Early exit: проверяем, находится ли частица в зоне влияния любой волны
            // Используем предвычисленные границы для быстрой проверки
            if (cachedWaveDistance >= waveBoundsMin && cachedWaveDistance <= waveBoundsMax) {
                // Вычисляем направление от центра к частице (радиально наружу) один раз для всех волн
                // Используем уже вычисленные dx, dy, dz для оптимизации
                const invDistance = 1.0 / cachedWaveDistance; // Избегаем повторного вычисления
                const directionToParticle = tempVector4.set(
                    dx * invDistance,
                    dy * invDistance,
                    dz * invDistance
                );
                
                // Применяем силы от всех волн, которые затрагивают эту точку
                let totalWaveForceX = 0;
                let totalWaveForceY = 0;
                let totalWaveForceZ = 0;
                
                for (const wave of CONFIG.waves) {
                    // Центр волны (середина по толщине - максимальный эффект)
                    const waveCenterRadius = wave.radius - CONFIG.waveWidth / 2;
                    // Расстояние от центра волны до частицы (используем расстояние, а не квадрат, т.к. нужна разность)
                    const distanceFromCenter = Math.abs(cachedWaveDistance - waveCenterRadius);
                    
                    // Проверяем, находится ли частица в зоне этой волны
                    if (distanceFromCenter <= waveCutoffDistance) {
                        // Гауссово распределение: exp(-falloff * (x/σ)²)
                        // Используем предвычисленные значения для оптимизации
                        const normalizedDistance = distanceFromCenter * waveInvSigma;
                        const normalizedDistanceSq = normalizedDistance * normalizedDistance;
                        const forceFactor = Math.exp(-CONFIG.waveForceFalloff * normalizedDistanceSq);
                        
                        // Вычисляем силу от этой волны
                        const waveForce = CONFIG.waveForce * forceFactor * CONFIG.timeScale;
                        
                        // Суммируем силы от всех волн
                        totalWaveForceX += directionToParticle.x * waveForce;
                        totalWaveForceY += directionToParticle.y * waveForce;
                        totalWaveForceZ += directionToParticle.z * waveForce;
                        
                        // Накапливаем forceFactor для эффекта размера (та же интенсивность, что и для силы/свечения)
                        totalWaveSizeFactor += forceFactor;
                    }
                }
                
                // Применяем суммарную силу от всех волн
                velocities[i3] += totalWaveForceX;
                velocities[i3 + 1] += totalWaveForceY;
                velocities[i3 + 2] += totalWaveForceZ;
            }
        }
        
        // Обновляем размер точки на основе эффекта волны
        if (waveActive && i < baseSizes.length) {
            const baseSize = baseSizes[i];
            
            if (baseSize === 0) {
                // Для невидимых точек: плавное появление и исчезновение при прохождении волны
                if (totalWaveSizeFactor > 0) {
                    const minSize = CONFIG.pointSize * (1 - CONFIG.sizeVariation);
                    const maxSize = CONFIG.pointSize * (1 + CONFIG.sizeVariation);
                    // Генерируем детерминированный случайный размер для невидимой точки на основе её индекса
                    // Используем простую хеш-функцию для получения псевдослучайного значения от 0 до 1
                    const hash = ((i * 2654435761) % 2147483647) / 2147483647;
                    const invisibleBaseSize = minSize + hash * (maxSize - minSize);
                    // Плавное появление/исчезновение: используем totalWaveSizeFactor как fadeFactor
                    // Ограничиваем до 1.0, чтобы при наложении нескольких волн не было превышения
                    // Это создает плавный переход от 0 (полностью невидимо) до полного размера
                    const fadeFactor = Math.min(totalWaveSizeFactor, 1.0);
                    sizes[i] = invisibleBaseSize * fadeFactor;
                } else {
                    sizes[i] = 0; // Остаемся невидимыми, если волна не проходит
                }
            } else {
                // Для видимых точек: увеличиваем размер как обычно
                // Используем totalWaveSizeFactor для увеличения размера до 150% (1.0 + 0.5 * factor)
                const sizeMultiplier = 1.0 + totalWaveSizeFactor * 0.5;
                sizes[i] = baseSize * sizeMultiplier;
            }
            sizesUpdated = true;
        }
        
        positionsArray[i3] += velocities[i3] * CONFIG.timeScale;
        positionsArray[i3 + 1] += velocities[i3 + 1] * CONFIG.timeScale;
        positionsArray[i3 + 2] += velocities[i3 + 2] * CONFIG.timeScale;
        
        tempVector.set(
            positionsArray[i3],
            positionsArray[i3 + 1],
            positionsArray[i3 + 2]
        );
        
        // Система пружины-демпфера для возврата к исходной позиции
        // Проверяем границы перед доступом к массивам
        if (i3 + 2 >= originalPositions.length || i3 + 2 >= velocities.length) {
            // Пропускаем эту точку, если массивы не готовы
            continue;
        }
        
        // Проверяем, не находится ли точка в состоянии "разлёта" после взрыва
        // Если время возврата ещё не наступило, не применяем силу пружины
        const isInExplosionFlight = i < explosionReturnTimes.length && explosionReturnTimes[i] > nowPerf;
        
        if (isInExplosionFlight) {
            // Точка ещё в разлёте - применяем скорость разлёта и лёгкое демпфирование
            // но не притягиваем обратно
            const dt = 0.016 * CONFIG.timeScale * CONFIG.explosionSpeed; // Применяем множитель скорости разлёта
            velocities[i3] *= 0.98; // Лёгкое замедление во время разлёта
            velocities[i3 + 1] *= 0.98;
            velocities[i3 + 2] *= 0.98;
            positionsArray[i3] += velocities[i3] * dt;
            positionsArray[i3 + 1] += velocities[i3 + 1] * dt;
            positionsArray[i3 + 2] += velocities[i3 + 2] * dt;
        } else {
            tempVector3.set(
                originalPositions[i3],
                originalPositions[i3 + 1],
                originalPositions[i3 + 2]
            );
            
            // Вычисляем смещение от исходной позиции
            const displacement = tempVector2.subVectors(tempVector3, tempVector);
            // Оптимизация: используем distance squared для сравнения с порогом
            const displacementLengthSq = displacement.lengthSq();
            const velocityLengthSq = velocities[i3] * velocities[i3] + 
                velocities[i3 + 1] * velocities[i3 + 1] + 
                velocities[i3 + 2] * velocities[i3 + 2];
            
            // Если смещение и скорость очень маленькие, просто возвращаем на место и останавливаем
            const threshold = 0.001; // Порог для остановки
            const thresholdSq = threshold * threshold; // Квадрат порога для сравнения
            if (displacementLengthSq < thresholdSq && velocityLengthSq < thresholdSq) {
                positionsArray[i3] = originalPositions[i3];
                positionsArray[i3 + 1] = originalPositions[i3 + 1];
                positionsArray[i3 + 2] = originalPositions[i3 + 2];
                velocities[i3] = 0;
                velocities[i3 + 1] = 0;
                velocities[i3 + 2] = 0;
            } else {
                // Применяем силу пружины: F_spring = springConstant * displacement
                const springForceX = displacement.x * CONFIG.springConstant;
                const springForceY = displacement.y * CONFIG.springConstant;
                const springForceZ = displacement.z * CONFIG.springConstant;
                
                // Обновляем скорость: velocity += F_spring * dt
                // dt примерно равен 1/60 (60 FPS), но для стабильности используем фиксированный шаг
                const dt = 0.016 * CONFIG.timeScale; // Применяем глобальный множитель скорости
                velocities[i3] += springForceX * dt;
                velocities[i3 + 1] += springForceY * dt;
                velocities[i3 + 2] += springForceZ * dt;
                
                // Применяем демпфирование: экспоненциальное затухание скорости
                // damping близко к 1.0 означает сильное затухание
                velocities[i3] *= CONFIG.damping;
                velocities[i3 + 1] *= CONFIG.damping;
                velocities[i3 + 2] *= CONFIG.damping;
                
                // Обновляем позицию: position += velocity * dt
                positionsArray[i3] += velocities[i3] * dt;
                positionsArray[i3 + 1] += velocities[i3 + 1] * dt;
                positionsArray[i3 + 2] += velocities[i3 + 2] * dt;
            }
        }
        
        // Обновляем цвет на основе расстояния от камеры и волны
        // Пропускаем здесь - сделаем в отдельном проходе после вычисления всех finalBrightness
    }
    
    if (!waveActive && wasWaveActive && sizes && baseSizes) {
        const count = Math.min(sizes.length, baseSizes.length);
        if (count > 0) {
            sizes.set(baseSizes.subarray(0, count), 0);
            sizesUpdated = true;
        }
    }
    wasWaveActive = waveActive;
    
    if (cachedGlowBrightness !== CONFIG.glowBrightness || cachedVelocityGlowMultiplier !== CONFIG.velocityGlowMultiplier) {
        cachedGlowBrightness = CONFIG.glowBrightness;
        cachedVelocityGlowMultiplier = CONFIG.velocityGlowMultiplier;
        glowStaticNeedsUpdate = true;
    }
    const glowIsDynamic = CONFIG.velocityGlowMultiplier > 0;
    
    // Обновляем цвета: базовая яркость с эффектом глубины
    // Точки дальше от камеры немного темнее (регулируется CONFIG.depthDarkeningStrength)
    if (colorsArray) {
        const brightnessScale = CONFIG.maxBrightness;
        
        for (let i = 0; i < actualParticleCount && i < distanceBuffer.length; i++) {
            const i3 = i * 3;
            if (i3 + 2 >= colorsArray.length) break;
            
            const distance = distanceBuffer[i];
            // Нормализуем расстояние от 0 до 1 относительно ФИКСИРОВАННОГО диапазона
            // Это гарантирует, что яркость каждой точки зависит только от её Z-позиции,
            // а не от позиций других точек
            const normalizedDistance = distanceRange > 0 ? (distance - fixedMinDistance) / distanceRange : 0;
            // Ограничиваем normalizedDistance в [0, 1] чтобы избежать артефактов при экстремальных Z
            const clampedNormalizedDistance = Math.max(0, Math.min(1, normalizedDistance));
            // Эффект глубины: дальние точки темнее (сила регулируется в панели управления)
            // При depthDarkeningStrength = 0.15, яркость будет от 0.85 до 1.0
            let baseBrightness = 1.0 - clampedNormalizedDistance * CONFIG.depthDarkeningStrength;
            
            // Если точка невидима, обнуляем базовую яркость
            if (i < baseSizes.length && baseSizes[i] === 0) {
                // Проверяем, находится ли точка в волне (используем размер как индикатор)
                const currentSize = sizes[i] || 0;
                if (currentSize === 0) {
                    baseBrightness = 0; // Полностью скрываем невидимые точки вне волны
                }
            }
            
            // Вычисляем свечение от волн ОТДЕЛЬНО (не добавляем к baseBrightness)
            let totalWaveGlow = 0;
            if (waveActive) {
                const dx = positionsArray[i3] - waveCenter.x;
                const dy = positionsArray[i3 + 1] - waveCenter.y;
                const dz = positionsArray[i3 + 2] - waveCenter.z;
                const cachedWaveDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // Early exit: используем те же границы, что и для физики
                if (cachedWaveDistance >= waveBoundsMin && cachedWaveDistance <= waveBoundsMax) {
                    for (const wave of CONFIG.waves) {
                        // Центр волны (середина по толщине - максимальный эффект)
                        const waveCenterRadius = wave.radius - CONFIG.waveWidth / 2;
                        // Расстояние от центра волны до частицы
                        const distanceFromCenter = Math.abs(cachedWaveDistance - waveCenterRadius);
                        
                        // Проверяем, находится ли частица в зоне этой волны
                        if (distanceFromCenter <= waveCutoffDistance) {
                            // Гауссово распределение: exp(-falloff * (x/σ)²)
                            const normalizedDistance = distanceFromCenter * waveInvSigma;
                            const normalizedDistanceSq = normalizedDistance * normalizedDistance;
                            const glowFactor = Math.exp(-CONFIG.waveForceFalloff * normalizedDistanceSq);
                            const waveGlow = CONFIG.waveGlowIntensity * glowFactor;
                            
                            // Суммируем свечение от всех волн
                            totalWaveGlow += waveGlow;
                        }
                    }
                    
                    // Ограничиваем максимальное свечение
                    totalWaveGlow = Math.min(totalWaveGlow, CONFIG.waveGlowIntensity);
                }
            }
            
            // Масштабируем базовую яркость
            let scaledBrightness = baseBrightness * brightnessScale;
            
            // ПОСЛЕ масштабирования затемняем точки вне SVG формы
            // НО не затемняем при maxBrightness >= 99% (пользователь хочет максимальную яркость для всех точек)
            const isOutsideSVG = i >= CONFIG.particleCount;
            if (isOutsideSVG && CONFIG.maxBrightness < 0.99) {
                scaledBrightness *= 0.5; // Сделать бледнее (50% яркости)
            }
            
            // ПОСЛЕ масштабирования и затемнения добавляем эффект волны
            let finalBrightness = scaledBrightness + totalWaveGlow;
            
            // Добавляем эффект подсветки от взрыва
            if (CONFIG.explosionEnabled && i < explosionGlowEndTimes.length) {
                const glowEndTime = explosionGlowEndTimes[i];
                if (glowEndTime > nowPerf) {
                    // Плавное затухание подсветки
                    const remainingTime = glowEndTime - nowPerf;
                    const fadeFactor = remainingTime / CONFIG.explosionGlowDuration;
                    const explosionGlow = CONFIG.explosionGlowIntensity * fadeFactor;
                    finalBrightness += explosionGlow;
                }
            }
            
            // Вычисляем glow эффект на основе скорости движения точки
            if (glowIsDynamic) {
                let particleGlow = CONFIG.glowBrightness;
                // Вычисляем магнитуду скорости точки
                const vx = velocities[i3];
                const vy = velocities[i3 + 1];
                const vz = velocities[i3 + 2];
                const velocityMag = Math.sqrt(vx * vx + vy * vy + vz * vz);
                
                // Добавляем свечение от скорости (velocityMag ~0-1, но может быть больше)
                particleGlow += velocityMag * CONFIG.velocityGlowMultiplier;
                
                // Ограничиваем glow до 1.0 и записываем в массив
                particleGlow = Math.min(particleGlow, 1.0);
                if (i < glows.length) {
                    glows[i] = particleGlow;
                }
                glowsUpdated = true;
            } else if (glowStaticNeedsUpdate) {
                const particleGlow = Math.min(CONFIG.glowBrightness, 1.0);
                if (i < glows.length) {
                    glows[i] = particleGlow;
                }
                glowsUpdated = true;
            }
            
            // Ограничиваем финальную яркость до 1.0
            finalBrightness = Math.min(finalBrightness, 1.0);
            
            colorsArray[i3] = finalBrightness;
            colorsArray[i3 + 1] = finalBrightness;
            colorsArray[i3 + 2] = finalBrightness;
            
        }
    }
    
    if (!glowIsDynamic && glowStaticNeedsUpdate) {
        glowStaticNeedsUpdate = false;
    }
    
    // ========== ОЧИСТКА ВЗРЫВОВ ==========
    // Помечаем все взрывы как применённые и удаляем их
    if (CONFIG.explosions.length > 0) {
        // Помечаем все взрывы как применённые
        for (const explosion of CONFIG.explosions) {
            explosion.applied = true;
        }
        // Удаляем применённые взрывы (импульс мгновенный)
        CONFIG.explosions = CONFIG.explosions.filter(exp => !exp.applied);
    }
    
    geometry.attributes.position.needsUpdate = true;
    if (geometry.attributes.color) {
        geometry.attributes.color.needsUpdate = true;
    }
    if (sizesUpdated && geometry.attributes.size) {
        geometry.attributes.size.needsUpdate = true;
    }
    if (glowsUpdated && geometry.attributes.glow) {
        geometry.attributes.glow.needsUpdate = true;
    }
}

// ========== ПАНЕЛЬ НАСТРОЕК ==========
const controls = document.getElementById('controls');
const toggleBtn = document.getElementById('toggleControls');

toggleBtn.addEventListener('click', () => {
    const isHidden = controls.classList.contains('hidden');
    controls.classList.toggle('hidden');
    toggleBtn.textContent = controls.classList.contains('hidden') ? 'Показать настройки' : 'Скрыть настройки';
    
    // Если панель показывается после скрытия, переинициализируем canvas кривой
    if (isHidden) {
        // Ждем, пока панель полностью отобразится
        requestAnimationFrame(() => {
            setupCanvasResolution();
            drawCurve();
        });
    }
});

// Привязка слайдеров к значениям
function setupControl(id, configKey, valueId) {
    const slider = document.getElementById(id);
    const valueDisplay = document.getElementById(valueId);
    
    // ===== ИНИЦИАЛИЗАЦИЯ: устанавливаем slider.value и valueDisplay из CONFIG =====
    let sliderValue;
    // Преобразование CONFIG → slider (обратное к тому, что делается в input handler)
    if (id === 'waveForce') {
        sliderValue = CONFIG[configKey] * 1000;
    } else if (id === 'maxBrightness' || id === 'depthDarkeningStrength' || id === 'glowBrightness') {
        sliderValue = CONFIG[configKey] * 100;
    } else if (id === 'velocityGlowMultiplier') {
        sliderValue = CONFIG[configKey] * 100;
    } else {
        sliderValue = CONFIG[configKey];
    }
    slider.value = sliderValue;
    
    // Форматирование valueDisplay (та же логика, что и в input handler)
    if (id === 'sizeVariation') {
        valueDisplay.textContent = Math.round(sliderValue * 100) + '%';
    } else if (id === 'maxBrightness' || id === 'depthDarkeningStrength' || id === 'glowBrightness' || id === 'velocityGlowMultiplier') {
        valueDisplay.textContent = Math.round(sliderValue) + '%';
    } else if (id === 'glowRadius') {
        valueDisplay.textContent = Math.round(sliderValue) + 'x';
    } else if (id === 'waveInterval') {
        valueDisplay.textContent = sliderValue.toFixed(0) + ' мс';
    } else if (id === 'waveForce') {
        valueDisplay.textContent = sliderValue.toFixed(0);
    } else if (id === 'waveWidth' || id === 'waveSpeed' || id === 'waveForceFalloff') {
        valueDisplay.textContent = sliderValue.toFixed(1);
    } else if (id === 'waveGlowIntensity' || id === 'autonomousMotionStrength' || id === 'springConstant' || id === 'damping') {
        valueDisplay.textContent = sliderValue.toFixed(2);
    } else if (sliderValue < 1) {
        valueDisplay.textContent = sliderValue.toFixed(2);
    } else {
        valueDisplay.textContent = sliderValue.toFixed(0);
    }
    
    slider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        // Преобразование для waveForce: новое значение (0-2) -> старое значение (0-0.002)
        if (id === 'waveForce') {
            CONFIG[configKey] = value / 1000;
        } else if (id === 'maxBrightness' || id === 'depthDarkeningStrength' || id === 'glowBrightness') {
            // Преобразование для процентных значений: слайдер (0-100) -> CONFIG (0-1.0)
            CONFIG[configKey] = value / 100;
        } else if (id === 'glowRadius') {
            // Радиус свечения: прямой множитель (1-50)
            CONFIG[configKey] = value;
            // Обновляем uniform в шейдере
            if (material && material.uniforms) {
                material.uniforms.glowRadiusMultiplier.value = CONFIG.glowRadius;
            }
        } else if (id === 'velocityGlowMultiplier') {
            // Преобразование: слайдер (0-200) -> CONFIG (0-2.0)
            CONFIG[configKey] = value / 100;
        } else {
            CONFIG[configKey] = value;
        }
        
        // Форматирование значения в зависимости от параметра
        if (id === 'sizeVariation') {
            valueDisplay.textContent = Math.round(value * 100) + '%';
        } else if (id === 'maxBrightness' || id === 'depthDarkeningStrength' || id === 'glowBrightness' || id === 'velocityGlowMultiplier') {
            valueDisplay.textContent = Math.round(value) + '%';
        } else if (id === 'glowRadius') {
            valueDisplay.textContent = Math.round(value) + 'x';
        } else if (id === 'waveInterval') {
            valueDisplay.textContent = value.toFixed(0) + ' мс';
        } else if (id === 'waveForce') {
            valueDisplay.textContent = value.toFixed(0); // Показываем целое число
        } else if (id === 'waveWidth' || id === 'waveSpeed' || id === 'waveForceFalloff') {
            valueDisplay.textContent = value.toFixed(1); // Показываем 1 знак для ширины, скорости и крутизны затухания
        } else if (id === 'waveGlowIntensity' || id === 'autonomousMotionStrength' || id === 'springConstant' || id === 'damping') {
            valueDisplay.textContent = value.toFixed(2);
        } else if (value < 1) {
            valueDisplay.textContent = value.toFixed(2);
        } else {
            valueDisplay.textContent = value.toFixed(0);
        }
        
        // Обновляем размеры частиц при изменении pointSize или sizeVariation
        if (id === 'pointSize' || id === 'sizeVariation') {
            // Убеждаемся, что массив sizes имеет правильный размер
            if (sizes.length !== totalParticleCount) {
                sizes = new Float32Array(totalParticleCount);
            }
            generateParticleSizes();
            
            // Обновляем базовые размеры
            if (baseSizes.length === sizes.length) {
                baseSizes.set(sizes);
            }
            
            // Сбрасываем размеры невидимых точек в 0 в массиве sizes (на случай, если они были изменены волнами)
            if (baseSizes && sizes && baseSizes.length === sizes.length) {
                for (let i = CONFIG.particleCount; i < sizes.length; i++) {
                    if (baseSizes[i] === 0) {
                        sizes[i] = 0;
                    }
                }
            }
            
            if (geometry && geometry.attributes.size) {
                geometry.attributes.size.needsUpdate = true;
            }
        }
    });
}

// Обработчик для переключения волны
const waveEnabledCheckbox = document.getElementById('waveEnabled');
if (waveEnabledCheckbox) {
    waveEnabledCheckbox.checked = CONFIG.waveEnabled;
    waveEnabledCheckbox.addEventListener('change', (e) => {
        CONFIG.waveEnabled = e.target.checked;
        if (!CONFIG.waveEnabled) {
            // Очищаем массив активных волн при выключении
            CONFIG.waves = [];
            CONFIG.lastWaveTime = null;
        }
    });
}

setupControl('pointSize', 'pointSize', 'pointSizeValue');
setupControl('maxBrightness', 'maxBrightness', 'maxBrightnessValue');
setupControl('depthDarkeningStrength', 'depthDarkeningStrength', 'depthDarkeningStrengthValue');
setupControl('glowBrightness', 'glowBrightness', 'glowBrightnessValue');
setupControl('glowRadius', 'glowRadius', 'glowRadiusValue');
setupControl('velocityGlowMultiplier', 'velocityGlowMultiplier', 'velocityGlowMultiplierValue');
setupControl('sizeVariation', 'sizeVariation', 'sizeVariationValue');
setupControl('forceStrength', 'forceStrength', 'forceStrengthValue');
setupControl('interactionRadius', 'interactionRadius', 'interactionRadiusValue');
setupControl('springConstant', 'springConstant', 'springConstantValue');
setupControl('damping', 'damping', 'dampingValue');
setupControl('timeScale', 'timeScale', 'timeScaleValue');
setupControl('autonomousMotionStrength', 'autonomousMotionStrength', 'autonomousMotionStrengthValue');
setupControl('scrollSpreadForce', 'scrollSpreadForce', 'scrollSpreadForceValue');
setupControl('scrollDepth', 'scrollDepth', 'scrollDepthValue');
setupControl('loadAnimationDuration', 'loadAnimationDuration', 'loadAnimationDurationValue');
setupControl('waveInterval', 'waveInterval', 'waveIntervalValue');
setupControl('waveWidth', 'waveWidth', 'waveWidthValue');
setupControl('waveSpeed', 'waveSpeed', 'waveSpeedValue');
setupControl('waveForce', 'waveForce', 'waveForceValue');
setupControl('waveGlowIntensity', 'waveGlowIntensity', 'waveGlowIntensityValue');
setupControl('waveForceFalloff', 'waveForceFalloff', 'waveForceFalloffValue');

// ========== НАСТРОЙКА КОНТРОЛОВ ВЗРЫВА ==========
setupControl('explosionForce', 'explosionForce', 'explosionForceValue');
setupControl('explosionSpeed', 'explosionSpeed', 'explosionSpeedValue');
setupControl('explosionReturnDelay', 'explosionReturnDelay', 'explosionReturnDelayValue');

// Обработчик для переключения взрыва
const explosionEnabledCheckbox = document.getElementById('explosionEnabled');
if (explosionEnabledCheckbox) {
    explosionEnabledCheckbox.checked = CONFIG.explosionEnabled;
    explosionEnabledCheckbox.addEventListener('change', (e) => {
        CONFIG.explosionEnabled = e.target.checked;
        if (!CONFIG.explosionEnabled) {
            // Очищаем массив активных взрывов при выключении
            CONFIG.explosions = [];
        }
    });
}

// Инициализация слайдера waveForce из CONFIG (преобразование в новую шкалу)
const waveForceSlider = document.getElementById('waveForce');
const waveForceValueDisplay = document.getElementById('waveForceValue');
if (waveForceSlider && waveForceValueDisplay) {
    waveForceSlider.value = CONFIG.waveForce * 1000;
    waveForceValueDisplay.textContent = (CONFIG.waveForce * 1000).toFixed(0);
}

// Инициализация слайдера maxBrightness из CONFIG (преобразование в проценты)
const maxBrightnessSlider = document.getElementById('maxBrightness');
const maxBrightnessValueDisplay = document.getElementById('maxBrightnessValue');
if (maxBrightnessSlider && maxBrightnessValueDisplay) {
    maxBrightnessSlider.value = CONFIG.maxBrightness * 100;
    maxBrightnessValueDisplay.textContent = Math.round(CONFIG.maxBrightness * 100) + '%';
}

// Инициализация слайдера depthDarkeningStrength из CONFIG (преобразование в проценты)
const depthDarkeningSlider = document.getElementById('depthDarkeningStrength');
const depthDarkeningValueDisplay = document.getElementById('depthDarkeningStrengthValue');
if (depthDarkeningSlider && depthDarkeningValueDisplay) {
    depthDarkeningSlider.value = CONFIG.depthDarkeningStrength * 100;
    depthDarkeningValueDisplay.textContent = Math.round(CONFIG.depthDarkeningStrength * 100) + '%';
}

// Обновляем значения слайдеров из сохраненных настроек
if (savedConfig) {
    const durationSlider = document.getElementById('loadAnimationDuration');
    
    if (durationSlider && savedConfig.loadAnimationDuration !== undefined) {
        durationSlider.value = savedConfig.loadAnimationDuration;
        document.getElementById('loadAnimationDurationValue').textContent = savedConfig.loadAnimationDuration.toFixed(0);
    }
    if (savedConfig.loadAnimationEasingCurve) {
        CONFIG.loadAnimationEasingCurve = savedConfig.loadAnimationEasingCurve;
    }
}

// Сохранение настроек при изменении
const loadAnimationSliders = ['loadAnimationDuration'];
loadAnimationSliders.forEach(id => {
    const slider = document.getElementById(id);
    if (slider) {
        slider.addEventListener('input', () => {
            saveConfigToStorage();
        });
    }
});

// ========== РЕДАКТОР КРИВОЙ БЕЗЬЕ ==========
const curveCanvas = document.getElementById('curveEditor');

// Функция для исправления позиции и стилей canvas
function fixCanvasPosition() {
    // Находим блок "Настройки анимации загрузки"
    const loadAnimationSection = Array.from(document.querySelectorAll('#controls > div')).find(div => {
        const style = div.getAttribute('style') || '';
        return style.includes('border-top: 2px solid');
    });
    
    
    if (!loadAnimationSection) return;
    
    // Находим правильный control-group по тексту label
    const correctControlGroup = Array.from(loadAnimationSection.querySelectorAll('.control-group')).find(cg => {
        const label = cg.querySelector('label');
        return label && label.textContent.includes('Кривая скорости анимации');
    });
    
    
    if (!correctControlGroup) return;
    
    // Удаляем все inline стили, которые могут мешать
    curveCanvas.removeAttribute('style');
    
    // Устанавливаем только необходимые стили через CSS класс
    curveCanvas.style.cssText = 'cursor: crosshair;';
    
    // Проверяем, находится ли canvas в правильном месте
    if (curveCanvas.parentElement !== correctControlGroup) {
        // Находим описание внутри control-group
        const descriptionDiv = correctControlGroup.querySelector('div[style*="font-size: 10px"]');
        
        if (descriptionDiv) {
            // Вставляем canvas после описания, но перед preset-buttons
            const presetButtons = correctControlGroup.querySelector('.preset-buttons');
            if (presetButtons && descriptionDiv.nextSibling !== curveCanvas) {
                correctControlGroup.insertBefore(curveCanvas, presetButtons);
            } else if (!presetButtons) {
                correctControlGroup.insertBefore(curveCanvas, descriptionDiv.nextSibling);
            }
        } else {
            // Если нет описания, вставляем после label
            const label = correctControlGroup.querySelector('label');
            if (label) {
                const nextSibling = label.nextSibling;
                if (nextSibling !== curveCanvas) {
                    correctControlGroup.insertBefore(curveCanvas, nextSibling);
                }
            } else {
                correctControlGroup.appendChild(curveCanvas);
            }
        }
    }
}

// Исправляем позицию canvas сразу
fixCanvasPosition();

// Также исправляем при изменении DOM (на случай, если что-то переместит canvas)
const observer = new MutationObserver(() => {
    if (curveCanvas.parentElement && !curveCanvas.parentElement.closest('#controls > div[style*="border-top: 2px solid"]')) {
        fixCanvasPosition();
    }
});

observer.observe(document.getElementById('controls'), {
    childList: true,
    subtree: true
});

const curveCtx = curveCanvas.getContext('2d');

// Настраиваем canvas для высокого разрешения (Retina)
function setupCanvasResolution() {
    if (!curveCanvas) return;
    
    const rect = curveCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Устанавливаем внутренние размеры canvas с учетом devicePixelRatio
    let displayWidth = rect.width;
    let displayHeight = rect.height;
    
    // Если canvas скрыт или имеет нулевые размеры, используем CSS размеры как fallback
    if (displayWidth === 0 || displayHeight === 0) {
        const computedStyle = window.getComputedStyle(curveCanvas);
        displayWidth = parseFloat(computedStyle.width) || 404; // Используем значение из CSS или дефолтное
        displayHeight = parseFloat(computedStyle.height) || 202;
    }
    
    
    // Устанавливаем размеры только если они больше нуля
    if (displayWidth > 0 && displayHeight > 0) {
        curveCanvas.width = displayWidth * dpr;
        curveCanvas.height = displayHeight * dpr;
        
        // Сброс трансформации перед масштабированием (изменение размеров canvas автоматически сбрасывает контекст, но на всякий случай)
        curveCtx.setTransform(1, 0, 0, 1, 0, 0);
        // Масштабируем контекст для правильного отображения
        curveCtx.scale(dpr, dpr);
    }
}

// Пересчитываем разрешение при изменении размера окна
window.addEventListener('resize', () => {
    setupCanvasResolution();
    drawCurve();
});

const padding = 20;
let isDragging = false;
let draggedPoint = null; // 'p1' или 'p2'

// Предустановленные кривые
const curvePresets = {
    linear: { p1x: 0.25, p1y: 0.25, p2x: 0.75, p2y: 0.75 },
    'ease-in': { p1x: 0.42, p1y: 0, p2x: 1, p2y: 1 },
    'ease-out': { p1x: 0, p1y: 0, p2x: 0.58, p2y: 1 },
    'ease-in-out': { p1x: 0.42, p1y: 0, p2x: 0.58, p2y: 1 }
};

// Функция отрисовки кривой Безье на canvas
function drawCurve() {
    if (!curveCanvas || curveCanvas.width === 0 || curveCanvas.height === 0) {
        // Если canvas не готов, переустанавливаем разрешение и пробуем снова
        setupCanvasResolution();
        if (curveCanvas.width === 0 || curveCanvas.height === 0) {
            return; // Если все еще нулевые размеры, выходим
        }
    }
    
    // Получаем актуальные размеры с учетом масштабирования
    const actualWidth = curveCanvas.width / (window.devicePixelRatio || 1);
    const actualHeight = curveCanvas.height / (window.devicePixelRatio || 1);
    const actualDrawWidth = actualWidth - padding * 2;
    const actualDrawHeight = actualHeight - padding * 2;
    
    // Очищаем canvas
    curveCtx.clearRect(0, 0, actualWidth, actualHeight);
    
    // Рисуем фон с сеткой
    curveCtx.fillStyle = 'rgba(10, 10, 10, 0.5)';
    curveCtx.fillRect(0, 0, actualWidth, actualHeight);
    
    // Рисуем сетку
    curveCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    curveCtx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const x = padding + (actualDrawWidth / 4) * i;
        const y = padding + (actualDrawHeight / 4) * i;
        // Вертикальные линии
        curveCtx.beginPath();
        curveCtx.moveTo(x, padding);
        curveCtx.lineTo(x, padding + actualDrawHeight);
        curveCtx.stroke();
        // Горизонтальные линии
        curveCtx.beginPath();
        curveCtx.moveTo(padding, y);
        curveCtx.lineTo(padding + actualDrawWidth, y);
        curveCtx.stroke();
    }
    
    // Преобразуем координаты Безье в координаты canvas
    const p1x = padding + CONFIG.loadAnimationEasingCurve.p1x * actualDrawWidth;
    const p1y = padding + actualDrawHeight - CONFIG.loadAnimationEasingCurve.p1y * actualDrawHeight; // Инвертируем Y
    const p2x = padding + CONFIG.loadAnimationEasingCurve.p2x * actualDrawWidth;
    const p2y = padding + actualDrawHeight - CONFIG.loadAnimationEasingCurve.p2y * actualDrawHeight; // Инвертируем Y
    
    // Рисуем линии к контрольным точкам
    curveCtx.strokeStyle = 'rgba(100, 150, 255, 0.3)';
    curveCtx.lineWidth = 1;
    curveCtx.setLineDash([2, 2]);
    curveCtx.beginPath();
    curveCtx.moveTo(padding, padding + actualDrawHeight); // Начальная точка (0,0)
    curveCtx.lineTo(p1x, p1y);
    curveCtx.stroke();
    curveCtx.beginPath();
    curveCtx.moveTo(padding + actualDrawWidth, padding); // Конечная точка (1,1)
    curveCtx.lineTo(p2x, p2y);
    curveCtx.stroke();
    curveCtx.setLineDash([]);
    
    // Рисуем кривую Безье
    // Для правильной визуализации используем обе координаты контрольных точек
    curveCtx.strokeStyle = 'rgba(50, 150, 255, 1)';
    curveCtx.lineWidth = 2;
    curveCtx.beginPath();
    
    // Функция для вычисления точки на кубической кривой Безье
    function bezierPointXY(t, p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
        const oneMinusT = 1 - t;
        const oneMinusT2 = oneMinusT * oneMinusT;
        const oneMinusT3 = oneMinusT2 * oneMinusT;
        const t2 = t * t;
        const t3 = t2 * t;
        
        const x = oneMinusT3 * p0x + 
                  3 * oneMinusT2 * t * p1x + 
                  3 * oneMinusT * t2 * p2x + 
                  t3 * p3x;
        
        const y = oneMinusT3 * p0y + 
                  3 * oneMinusT2 * t * p1y + 
                  3 * oneMinusT * t2 * p2y + 
                  t3 * p3y;
        
        return { x, y };
    }
    
    const steps = 200; // Увеличиваем количество шагов для более плавной кривой
    const bezierP0x = 0, bezierP0y = 0;
    const bezierP1x = CONFIG.loadAnimationEasingCurve.p1x, bezierP1y = CONFIG.loadAnimationEasingCurve.p1y;
    const bezierP2x = CONFIG.loadAnimationEasingCurve.p2x, bezierP2y = CONFIG.loadAnimationEasingCurve.p2y;
    const bezierP3x = 1, bezierP3y = 1;
    
    let firstPoint = true;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const point = bezierPointXY(t, bezierP0x, bezierP0y, bezierP1x, bezierP1y, bezierP2x, bezierP2y, bezierP3x, bezierP3y);
        
        // Преобразуем координаты Безье (0-1) в координаты canvas
        const canvasX = padding + point.x * actualDrawWidth;
        const canvasY = padding + actualDrawHeight - point.y * actualDrawHeight;
        
        // Проверяем, что координаты в пределах видимой области
        if (canvasX >= padding && canvasX <= padding + actualDrawWidth && 
            canvasY >= padding && canvasY <= padding + actualDrawHeight) {
            if (firstPoint) {
                curveCtx.moveTo(canvasX, canvasY);
                firstPoint = false;
            } else {
                curveCtx.lineTo(canvasX, canvasY);
            }
        }
    }
    curveCtx.stroke();
    
    // Рисуем контрольные точки
    const pointRadius = 5;
    const hoverRadius = 8;
    
    // Точка P1
    curveCtx.fillStyle = isDragging && draggedPoint === 'p1' ? 'rgba(50, 200, 255, 1)' : 'rgba(100, 150, 255, 1)';
    curveCtx.beginPath();
    curveCtx.arc(p1x, p1y, pointRadius, 0, Math.PI * 2);
    curveCtx.fill();
    curveCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    curveCtx.lineWidth = 2;
    curveCtx.stroke();
    
    // Точка P2
    curveCtx.fillStyle = isDragging && draggedPoint === 'p2' ? 'rgba(50, 200, 255, 1)' : 'rgba(100, 150, 255, 1)';
    curveCtx.beginPath();
    curveCtx.arc(p2x, p2y, pointRadius, 0, Math.PI * 2);
    curveCtx.fill();
    curveCtx.stroke();
    
    // Рисуем начальную и конечную точки
    curveCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    curveCtx.beginPath();
    curveCtx.arc(padding, padding + actualDrawHeight, 3, 0, Math.PI * 2);
    curveCtx.fill();
    curveCtx.beginPath();
    curveCtx.arc(padding + actualDrawWidth, padding, 3, 0, Math.PI * 2);
    curveCtx.fill();
}

// Функция получения координат точки из координат мыши
function getPointFromMouse(event) {
    const rect = curveCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const canvasX = (event.clientX - rect.left) * dpr;
    const canvasY = (event.clientY - rect.top) * dpr;
    
    // Получаем актуальные размеры с учетом масштабирования
    const actualWidth = curveCanvas.width / dpr;
    const actualHeight = curveCanvas.height / dpr;
    const actualDrawWidth = actualWidth - padding * 2;
    const actualDrawHeight = actualHeight - padding * 2;
    
    // Преобразуем в координаты Безье (0-1)
    const bezierX = Math.max(0, Math.min(1, (canvasX / dpr - padding) / actualDrawWidth));
    const bezierY = Math.max(0, Math.min(1, 1 - (canvasY / dpr - padding) / actualDrawHeight)); // Инвертируем Y
    
    return { x: bezierX, y: bezierY, canvasX: canvasX / dpr, canvasY: canvasY / dpr };
}

// Функция проверки, находится ли мышь рядом с контрольной точкой
function getPointUnderMouse(event) {
    const mouse = getPointFromMouse(event);
    const threshold = 10; // Радиус клика в пикселях
    
    // Получаем актуальные размеры с учетом масштабирования
    const dpr = window.devicePixelRatio || 1;
    const actualWidth = curveCanvas.width / dpr;
    const actualHeight = curveCanvas.height / dpr;
    const actualDrawWidth = actualWidth - padding * 2;
    const actualDrawHeight = actualHeight - padding * 2;
    
    // Проверяем P1
    const p1x = padding + CONFIG.loadAnimationEasingCurve.p1x * actualDrawWidth;
    const p1y = padding + actualDrawHeight - CONFIG.loadAnimationEasingCurve.p1y * actualDrawHeight;
    const dist1 = Math.sqrt((mouse.canvasX - p1x) ** 2 + (mouse.canvasY - p1y) ** 2);
    
    // Проверяем P2
    const p2x = padding + CONFIG.loadAnimationEasingCurve.p2x * actualDrawWidth;
    const p2y = padding + actualDrawHeight - CONFIG.loadAnimationEasingCurve.p2y * actualDrawHeight;
    const dist2 = Math.sqrt((mouse.canvasX - p2x) ** 2 + (mouse.canvasY - p2y) ** 2);
    
    if (dist1 < threshold) return 'p1';
    if (dist2 < threshold) return 'p2';
    
    return null;
}

// Обработчики событий для перетаскивания
curveCanvas.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const point = getPointUnderMouse(event);
    if (point) {
        isDragging = true;
        draggedPoint = point;
        curveCanvas.style.cursor = 'grabbing';
    }
});

curveCanvas.addEventListener('mousemove', (event) => {
    if (isDragging && draggedPoint) {
        event.preventDefault();
        event.stopPropagation();
        const mouse = getPointFromMouse(event);
        // Ограничиваем координаты в диапазоне [0, 1]
        CONFIG.loadAnimationEasingCurve[draggedPoint + 'x'] = Math.max(0, Math.min(1, mouse.x));
        CONFIG.loadAnimationEasingCurve[draggedPoint + 'y'] = Math.max(0, Math.min(1, mouse.y));
        drawCurve();
        saveConfigToStorage();
    } else {
        const point = getPointUnderMouse(event);
        curveCanvas.style.cursor = point ? 'grab' : 'crosshair';
    }
});

curveCanvas.addEventListener('mouseup', (event) => {
    if (isDragging) {
        event.preventDefault();
        event.stopPropagation();
    }
    isDragging = false;
    draggedPoint = null;
    curveCanvas.style.cursor = 'crosshair';
});

curveCanvas.addEventListener('mouseleave', () => {
    isDragging = false;
    draggedPoint = null;
    curveCanvas.style.cursor = 'crosshair';
});

// Также обрабатываем события на уровне документа для корректной работы при выходе за пределы canvas
document.addEventListener('mousemove', (event) => {
    if (isDragging && draggedPoint) {
        const rect = curveCanvas.getBoundingClientRect();
        // Проверяем, что мышь все еще над canvas
        if (event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom) {
            const mouse = getPointFromMouse(event);
            CONFIG.loadAnimationEasingCurve[draggedPoint + 'x'] = Math.max(0, Math.min(1, mouse.x));
            CONFIG.loadAnimationEasingCurve[draggedPoint + 'y'] = Math.max(0, Math.min(1, mouse.y));
            drawCurve();
            saveConfigToStorage();
        }
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        draggedPoint = null;
        curveCanvas.style.cursor = 'crosshair';
    }
});

// Обработчики для кнопок предустановленных кривых
document.querySelectorAll('.preset-button').forEach(button => {
    button.addEventListener('click', () => {
        const preset = button.dataset.preset;
        if (curvePresets[preset]) {
            CONFIG.loadAnimationEasingCurve = { ...curvePresets[preset] };
            drawCurve();
            saveConfigToStorage();
        }
    });
});

// Инициализируем отрисовку кривой после полной загрузки DOM
// Используем несколько задержек для гарантии, что canvas уже отрендерен и находится в правильном месте
function initializeCurveEditor() {
    if (!curveCanvas) return;
    
    fixCanvasPosition();
    requestAnimationFrame(() => {
        fixCanvasPosition();
        setupCanvasResolution();
        // Проверяем, что canvas имеет ненулевые размеры перед отрисовкой
        if (curveCanvas.width > 0 && curveCanvas.height > 0) {
            drawCurve();
        }
    });
}

// Инициализируем сразу и после загрузки
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCurveEditor);
} else {
    initializeCurveEditor();
}

// Также инициализируем после небольшой задержки на случай, если DOM еще не полностью готов
setTimeout(initializeCurveEditor, 100);

// Функция перезапуска анимации загрузки
function restartLoadAnimation() {
    if (!isInitialized || !geometry || !geometry.attributes.position) {
        return;
    }
    
    const positionsArray = geometry.attributes.position.array;
    // Обрабатываем все точки (внутри + снаружи SVG)
    const actualParticleCount = Math.min(totalParticleCount, positionsArray.length / 3);
    
    // Возвращаем частицы на начальные позиции
    for (let i = 0; i < actualParticleCount; i++) {
        const i3 = i * 3;
        if (i3 + 2 >= positionsArray.length) break;
        
        positionsArray[i3] = startPositions[i3];
        positionsArray[i3 + 1] = startPositions[i3 + 1];
        positionsArray[i3 + 2] = startPositions[i3 + 2];
    }
    
    // Сбрасываем glow в 0 для плавного нарастания во время анимации
    for (let i = 0; i < glows.length; i++) {
        glows[i] = 0;
    }
    if (geometry.attributes.glow) {
        geometry.attributes.glow.needsUpdate = true;
    }
    
    // Перезапускаем анимацию
    CONFIG.isLoadingAnimation = true;
    CONFIG.loadAnimationStartTime = Date.now();
    
    geometry.attributes.position.needsUpdate = true;
}

// Обработчик кнопки "Применить и перезапустить"
const restartButton = document.getElementById('restartLoadAnimation');
if (restartButton) {
    restartButton.addEventListener('click', () => {
        saveConfigToStorage(); // Сохраняем настройки перед перезапуском
        restartLoadAnimation();
    });
}

// Обработчик для количества точек с debounce для оптимизации
const particleCountSlider = document.getElementById('particleCount');
const particleCountValue = document.getElementById('particleCountValue');
// ===== ИНИЦИАЛИЗАЦИЯ из CONFIG =====
particleCountSlider.value = CONFIG.particleCount;
particleCountValue.textContent = CONFIG.particleCount;

let particleCountTimeout = null;
let lastRecreateCallTime = 0; // Отслеживаем время последнего вызова recreateParticles
particleCountSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    CONFIG.particleCount = value;
    particleCountValue.textContent = value;
    
    // Debounce: пересоздаём частицы только после остановки изменения слайдера
    clearTimeout(particleCountTimeout);
    particleCountTimeout = setTimeout(async () => {
        lastRecreateCallTime = Date.now();
        await recreateParticles();
    }, 300); // Ждём 300ms после последнего изменения
});

// Обработчик для количества внешних точек с debounce для оптимизации
const outsideParticleCountSlider = document.getElementById('outsideParticleCount');
const outsideParticleCountValue = document.getElementById('outsideParticleCountValue');
// ===== ИНИЦИАЛИЗАЦИЯ из CONFIG =====
outsideParticleCountSlider.value = CONFIG.outsideParticleCount;
outsideParticleCountValue.textContent = CONFIG.outsideParticleCount;

let outsideParticleCountTimeout = null;
outsideParticleCountSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    CONFIG.outsideParticleCount = value;
    outsideParticleCountValue.textContent = value;
    
    // Debounce: пересоздаём частицы только после остановки изменения слайдера
    clearTimeout(outsideParticleCountTimeout);
    outsideParticleCountTimeout = setTimeout(async () => {
        lastRecreateCallTime = Date.now();
        await recreateParticles();
    }, 300); // Ждём 300ms после последнего изменения
});

// Обработчик для процента невидимых точек вне формы с debounce для оптимизации
const outsideInvisiblePercentageSlider = document.getElementById('outsideInvisiblePercentage');
const outsideInvisiblePercentageValue = document.getElementById('outsideInvisiblePercentageValue');
// ===== ИНИЦИАЛИЗАЦИЯ из CONFIG =====
outsideInvisiblePercentageSlider.value = CONFIG.outsideInvisiblePercentage;
outsideInvisiblePercentageValue.textContent = CONFIG.outsideInvisiblePercentage + '%';

let outsideInvisiblePercentageTimeout = null;
outsideInvisiblePercentageSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    CONFIG.outsideInvisiblePercentage = value;
    outsideInvisiblePercentageValue.textContent = value + '%';
    
    // Debounce: пересоздаём частицы только после остановки изменения слайдера
    clearTimeout(outsideInvisiblePercentageTimeout);
    outsideInvisiblePercentageTimeout = setTimeout(async () => {
        lastRecreateCallTime = Date.now();
        await recreateParticles();
    }, 300); // Ждём 300ms после последнего изменения
});

// ========== ОГРАНИЧЕНИЕ FPS ==========
let maxFPS = 0; // По умолчанию без ограничения (0 = без ограничения)
let lastFrameTime = performance.now();

const maxFPSSlider = document.getElementById('maxFPS');
const maxFPSValue = document.getElementById('maxFPSValue');
if (maxFPSSlider && maxFPSValue) {
    // Функция для обновления значения FPS
    const updateMaxFPS = (value) => {
        const maxValue = parseInt(maxFPSSlider.max);
        if (value >= maxValue) {
            maxFPS = 0; // Без ограничения
            maxFPSValue.textContent = 'Без ограничения';
        } else {
            maxFPS = value;
            maxFPSValue.textContent = value.toString();
        }
    };
    
    // Инициализация при загрузке
    const initialValue = parseInt(maxFPSSlider.value);
    updateMaxFPS(initialValue);
    
    maxFPSSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        updateMaxFPS(value);
        lastFrameTime = performance.now(); // Сбрасываем таймер при изменении
        PerformanceMonitor.reset(); // Сбрасываем статистику FPS
    });
}

// ========== МОНИТОРИНГ ПРОИЗВОДИТЕЛЬНОСТИ ==========
const PerformanceMonitor = {
    lastFrameTime: performance.now(),
    frameTimes: [], // Массив для хранения времени между кадрами
    maxSamples: 30, // Храним последние 30 интервалов для более быстрой реакции на изменения
    fps: 60,
    frameTime: 16.66,
    
    reset() {
        this.frameTimes = [];
        this.lastFrameTime = performance.now();
    },
    
    update() {
        const currentTime = performance.now();
        const frameDelta = currentTime - this.lastFrameTime;
        
        this.lastFrameTime = currentTime;
        
        // Добавляем время между кадрами в массив
        this.frameTimes.push(frameDelta);
        
        // Ограничиваем размер массива
        if (this.frameTimes.length > this.maxSamples) {
            this.frameTimes.shift();
        }
        
        // Вычисляем средний FPS на основе времени между кадрами
        if (this.frameTimes.length > 0) {
            const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
            this.fps = Math.round(1000 / avgFrameTime);
            this.frameTime = avgFrameTime.toFixed(2);
        }
        
        // Обновляем DOM каждый кадр для плавного отображения
        this.updateDOM();
    },
    
    getMemoryUsage() {
        // Пытаемся использовать performance.memory (доступно в Chrome)
        if (performance.memory) {
            const used = performance.memory.usedJSHeapSize / (1024 * 1024);
            const total = performance.memory.totalJSHeapSize / (1024 * 1024);
            return { used: used.toFixed(1), total: total.toFixed(1) };
        }
        
        // Если performance.memory недоступен, оцениваем на основе буферов
        if (!geometry || !geometry.attributes) {
            return { used: '0.0', total: '0.0' };
        }
        
        // Оценка памяти на основе размеров буферов геометрии
        let estimatedMemory = 0;
        
        // Positions: Float32Array (4 bytes per float) * 3 components * particleCount
        if (geometry.attributes.position) {
            estimatedMemory += geometry.attributes.position.array.length * 4;
        }
        
        // Colors: Float32Array (4 bytes per float) * 3 components * particleCount
        if (geometry.attributes.color) {
            estimatedMemory += geometry.attributes.color.array.length * 4;
        }
        
        // Sizes: Float32Array (4 bytes per float) * particleCount
        if (geometry.attributes.size) {
            estimatedMemory += geometry.attributes.size.array.length * 4;
        }
        
        // Добавляем оценку для рабочих массивов (velocities, originalPositions, etc.)
        // Эти массивы используются для физики, но не хранятся в геометрии
        if (typeof totalParticleCount !== 'undefined') {
            // Оценка: positions, originalPositions, baseOriginalPositions, startPositions,
            // scrollDirections, velocities, colors, sizes, baseSizes
            // Каждый массив: totalParticleCount * components * 4 bytes
            const workingArraysSize = totalParticleCount * (3 + 3 + 3 + 3 + 3 + 3 + 3 + 1 + 1) * 4;
            estimatedMemory += workingArraysSize;
        }
        
        const usedMB = estimatedMemory / (1024 * 1024);
        const totalMB = Math.max(usedMB * 1.3, 70.0); // Оценка общего объёма с небольшим запасом
        
        return {
            used: usedMB.toFixed(1),
            total: totalMB.toFixed(1)
        };
    },
    
    getVertexCount() {
        if (geometry && geometry.attributes && geometry.attributes.position) {
            return geometry.attributes.position.count;
        }
        return totalParticleCount || 0;
    },
    
    updateDOM() {
        const fpsElement = document.getElementById('fpsValue');
        const frameTimeElement = document.getElementById('frameTimeValue');
        const memoryElement = document.getElementById('memoryValue');
        const verticesElement = document.getElementById('verticesValue');
        
        if (fpsElement) {
            fpsElement.textContent = this.fps;
        }
        
        if (frameTimeElement) {
            frameTimeElement.textContent = `${this.frameTime} ms`;
        }
        
        if (memoryElement) {
            const memory = this.getMemoryUsage();
            memoryElement.textContent = `${memory.used} / ${memory.total} MB`;
        }
        
        if (verticesElement) {
            verticesElement.textContent = this.getVertexCount().toLocaleString();
        }
    }
};

// ========== АНИМАЦИЯ ==========
function animate() {
    requestAnimationFrame(animate);
    
    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTime;
    
    // Ограничение FPS: если установлено ограничение и прошло недостаточно времени, пропускаем кадр
    if (maxFPS > 0) {
        const minFrameTime = 1000 / maxFPS; // Минимальное время между кадрами в мс
        // Используем умный допуск: если deltaTime близок к minFrameTime (в пределах 3 мс),
        // не пропускаем кадр, так как это может быть просто неточность таймера или синхронизация с монитором
        // Это особенно важно, когда монитор работает на той же частоте, что и maxFPS (например, 60 Гц)
        // Для 60 FPS minFrameTime = 16.67 мс, поэтому кадры с deltaTime >= 13.67 мс не будут пропущены
        const tolerance = 3.0; // Допуск в 3 мс для учёта неточностей таймера и синхронизации с монитором
        
        if (deltaTime < minFrameTime - tolerance) {
            return; // Пропускаем этот кадр
        }
    }
    
    // Обновляем время последнего кадра только если кадр был обработан
    lastFrameTime = currentTime;
    
    updatePhysics();
    renderer.render(scene, camera);
    
    // Обновляем мониторинг производительности каждый кадр для точного подсчёта FPS
    PerformanceMonitor.update();
}

window.addEventListener('resize', () => {
    // Обновляем параметры ортографической камеры при изменении размера окна
    const viewSize = 20;
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -viewSize * aspect / 2;
    camera.right = viewSize * aspect / 2;
    camera.top = viewSize / 2;
    camera.bottom = -viewSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
