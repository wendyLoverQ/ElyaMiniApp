// 行星-planets Mini APP：THREE.js 透明背景渲染，离线运行无需联网。
// 宿主详情页「Mini APP 设置」的下拉框（manifest select 设置）在水星 / 金星 / 木星间切换。
// 贴图均来自 Solar System Scope（基于 NASA 探测器影像，CC BY 4.0）：
//   水星 8192×4096（MESSENGER 全球基底图，官方 Ultra）；金星 4096×2048 硫酸云层（肉眼外观，
//   官方最高即 4K）；木星 4096×2048（官方页面标注 8k、实际像素即 4096×2048，已是最高真实分辨率）。
// 各行星使用真实自转轴倾角与扁率：水星 0.03°（忽略为 0）；金星 177.4°（逆行自转——倒置自转轴后
// 正向局部自转，视觉方向即真实逆行方向）；木星 3.13°、扁率 0.935（太阳系第二扁的行星）。
// 切换行星时保持当前自转相位连续，不重置角度；转速由宿主统一设置 rotationSpeed 控制；
// hidden/paused 生命周期时停止渲染循环节能。
// 开发：TRAE / GLM / GLM-5.3
import * as THREE from './vendor/three.module.min.js'

const VIEWPORT = 320
const PLANET_RADIUS = 1.8
const CAMERA_DISTANCE = 8

// 行星参数表：tilt 为自转轴倾角（度，负值 = 轴顶朝右倒，与土星版同向），
// flat 为极半径/赤道半径（扁率）。开发：TRAE / GLM / GLM-5.3
const PLANETS = {
  mercury: { texture: 'textures/mercury_day_8k.jpg', tilt: 0, flat: 1 },
  venus: { texture: 'textures/venus_day_4k.jpg', tilt: -177.4, flat: 1 },
  jupiter: { texture: 'textures/jupiter_day_4k.jpg', tilt: -3.13, flat: 0.935 }
}
const DEFAULT_PLANET = 'mercury'

const stage = document.querySelector('.planets-stage')
if (!(stage instanceof HTMLElement)) throw new Error('行星-planets 页面结构不完整')

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.setSize(VIEWPORT, VIEWPORT)
renderer.setClearColor(0x000000, 0)
stage.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
camera.position.set(0, 0, CAMERA_DISTANCE)
camera.lookAt(0, 0, 0)

// 预载全部贴图：启动时一次载入三张，切换行星时立即生效不等待加载。
// 开发：TRAE / GLM / GLM-5.3
const loader = new THREE.TextureLoader()
const textures = {}
for (const [key, config] of Object.entries(PLANETS)) {
  const map = loader.load(config.texture)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = renderer.capabilities.getMaxAnisotropy()
  textures[key] = map
}

// 倾斜组：各行星真实自转轴倾角在此体现（金星 177.4° 逆行、木星 3.13°）。
// 开发：TRAE / GLM / GLM-5.3
const tiltGroup = new THREE.Group()
tiltGroup.rotation.z = PLANETS[DEFAULT_PLANET].tilt * Math.PI / 180
scene.add(tiltGroup)

// 星球是纯 ShaderMaterial（自定义昼夜着色），不使用场景光源。
// dayMix 由法线与太阳方向点积经 smoothstep 得出，晨昏带平滑过渡；
// 白天侧带简单漫反射明暗，夜面保留约 3% 微光隐约可见轮廓。开发：TRAE / GLM / GLM-5.3
const planetUniforms = {
  dayMap: { value: textures[DEFAULT_PLANET] },
  sunDirection: { value: new THREE.Vector3(4, 1.5, 3).normalize() }
}
const planet = new THREE.Mesh(
  new THREE.SphereGeometry(PLANET_RADIUS, 96, 96),
  new THREE.ShaderMaterial({
    uniforms: planetUniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D dayMap;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vec3 day = texture2D(dayMap, vUv).rgb;
        float d = dot(normalize(vWorldNormal), normalize(sunDirection));
        float dayMix = smoothstep(-0.15, 0.12, d);
        vec3 lit = day * (0.05 + 1.05 * max(d, 0.0));
        vec3 col = mix(day * 0.03, lit, dayMix);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `
  })
)
planet.scale.y = PLANETS[DEFAULT_PLANET].flat
tiltGroup.add(planet)

// 应用行星：换贴图、倾角与扁率；自转相位（rotation.y）保持连续不重置。
// 未知 key 由调用方过滤，此处只处理已注册行星。开发：TRAE / GLM / GLM-5.3
let currentPlanet = DEFAULT_PLANET
function applyPlanet(key) {
  const config = PLANETS[key]
  if (!config || key === currentPlanet) return
  currentPlanet = key
  planetUniforms.dayMap.value = textures[key]
  tiltGroup.rotation.z = config.tilt * Math.PI / 180
  planet.scale.y = config.flat
}

let running = true
let frameHandle = 0
let lastTime = performance.now()

// 转速（rad/s）：来自宿主统一设置 rotationSpeed，0 表示停转；
// 无宿主环境（浏览器直接打开）时用默认值。开发：TRAE / GLM / GLM-5.3
let rotationSpeed = 0.12

function frame(now) {
  frameHandle = 0
  if (!running) return
  const delta = Math.min(0.1, (now - lastTime) / 1000)
  lastTime = now
  // 绕自身倾斜轴自转。开发：TRAE / GLM / GLM-5.3
  planet.rotation.y += rotationSpeed * delta
  renderer.render(scene, camera)
  frameHandle = requestAnimationFrame(frame)
}

function startLoop() {
  if (running || frameHandle !== 0) return
  running = true
  lastTime = performance.now()
  frameHandle = requestAnimationFrame(frame)
}

function stopLoop() {
  running = false
  if (frameHandle !== 0) {
    cancelAnimationFrame(frameHandle)
    frameHandle = 0
  }
}

frameHandle = requestAnimationFrame(frame)

// Ctrl+左键拖动旋转视角：与 Elya 内置 3D 桌宠（RoutedOrbitControl.rotate）手感一致。
// 宿主在 Ctrl+左键按下时不接管指针、不移动窗口；APP 自行处理：
// 水平拖动改变方位角 theta，垂直拖动改变俯仰角 phi（clamp 在两极之间），相机始终看向行星中心。
// 开发：TRAE / GLM / GLM-5.3
let orbit = null
window.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || !event.ctrlKey || orbit !== null) return
  event.preventDefault()
  if (event.target instanceof Element) event.target.setPointerCapture(event.pointerId)
  orbit = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY }
})
window.addEventListener('pointermove', (event) => {
  if (orbit === null || event.pointerId !== orbit.pointerId) return
  const deltaX = event.clientX - orbit.lastX
  const deltaY = event.clientY - orbit.lastY
  orbit.lastX = event.clientX
  orbit.lastY = event.clientY
  const spherical = new THREE.Spherical().setFromVector3(camera.position)
  spherical.theta -= 2 * Math.PI * deltaX / VIEWPORT
  spherical.phi = THREE.MathUtils.clamp(spherical.phi - 2 * Math.PI * deltaY / VIEWPORT, 0.01, Math.PI - 0.01)
  camera.position.setFromSpherical(spherical)
  camera.lookAt(0, 0, 0)
})
const endOrbit = (event) => {
  if (orbit === null || event.pointerId !== orbit.pointerId) return
  orbit = null
}
window.addEventListener('pointerup', endOrbit)
window.addEventListener('pointercancel', endOrbit)

const runtime = window.elyaPet
if (runtime) {
  // 统一设置：注册回调立即收到当前快照（含 manifest 默认值与用户已保存值）。
  // 行星切换用 select 设置；未知 key 或非法值保持当前状态，不猜不改。
  // 开发：TRAE / GLM / GLM-5.3
  runtime.onSettingsChange((settings) => {
    const speed = settings.rotationSpeed
    if (typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 && speed <= 1.2) rotationSpeed = speed
    const nextPlanet = settings.planet
    if (typeof nextPlanet === 'string' && Object.hasOwn(PLANETS, nextPlanet)) applyPlanet(nextPlanet)
  })

  // hidden/paused 暂停渲染，shown/resumed 恢复；未注册时事件丢弃，不影响渲染本身
  runtime.onLifecycle((state) => {
    if (state.type === 'hidden' || state.type === 'paused') stopLoop()
    else if (state.type === 'shown' || state.type === 'resumed') startLoop()
  })

  // 宿主 visualScale 放大 iframe 时不改变 320px 布局，canvas 若保持 320px 分辨率会被拉伸发糊；
  // 这里按 visualScale 同步提升像素比，使渲染缓冲匹配宿主缩放后的物理像素，缩放时保持清晰。
  // 按协议第 3 节，仅在 phase='committed'（本次调整完成）后应用，changing 期间不重分配缓冲。
  // 上限 8 与 manifest visualScale.max 一致；像素比上限 16 = 最大缩放 8 × 最大设备像素比 2。
  // 开发：TRAE / GLM / GLM-5.3
  const applyRenderScale = (visualScale) => {
    const scale = Number.isFinite(visualScale) && visualScale > 0 ? Math.min(visualScale, 8) : 1
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * scale)
    renderer.setSize(VIEWPORT, VIEWPORT)
    // setSize 重设缓冲尺寸会立即清空 WebGL 画布，若等下一帧 RAF 才重绘，
    // 清空与重绘之间被合成一次就闪空白帧；必须在同一任务内同步渲染当前状态补一帧。
    // 开发：TRAE / GLM / GLM-5.3
    renderer.render(scene, camera)
  }
  runtime.onPresentationChange((state) => {
    if (state.phase === 'committed') applyRenderScale(state.visualScale)
  })
}
