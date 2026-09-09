// 自旋月球 HD Mini APP：THREE.js 透明背景渲染，离线运行无需联网。
// 月面使用 NASA SVS CGI Moon Kit 16K 月球贴图（16384x8192，LRO WAC 拼接，公有领域），
// 由 16bit TIFF 母版转 8bit JPEG q92；昼夜由自定义 shader 的 sunDirection 决定。
// 月球无大气、无灯光，夜面仅保留微弱表面轮廓。
// 转速由宿主统一设置 rotationSpeed 控制；hidden/paused 生命周期时停止渲染循环节能。
// 实时模式：月球潮汐锁定于地球——正面（经度 0°，正对地球）固定朝向相机，
// 太阳方向按当前真实月相计算（Meeus 截断级数求月球/太阳黄经 → 真距角 → 直射经度），
// 呈现此刻从地球看到的真实月相（新月正面全暗、满月正面全亮、上下弦各亮一半）。
// 忽略天平动（±7.9°）与自转轴 1.54° 倾角（直射纬度 ±1.5°），两者视觉不可感知。
// 与 spinning-moon 的差异：贴图 8K→16K、visualScale 上限 8→16、球体 96→160 段。
// 开发：TRAE / GLM / GLM-5.3
import * as THREE from './vendor/three.module.min.js'

const VIEWPORT = 320
const MOON_RADIUS = 1.8
const CAMERA_DISTANCE = 8

const stage = document.querySelector('.moon-stage')
if (!(stage instanceof HTMLElement)) throw new Error('自旋月球 HD 页面结构不完整')

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.setSize(VIEWPORT, VIEWPORT)
renderer.setClearColor(0x000000, 0)
stage.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
camera.position.set(0, 0, CAMERA_DISTANCE)

// 月球是纯 ShaderMaterial（自定义昼夜着色），不使用场景光源。
// 16K 贴图解码与 GPU mipmap 生成需要数秒，首次加载有短暂空白属正常现象。
// 开发：TRAE / GLM / GLM-5.3
const loader = new THREE.TextureLoader()
const colorMap = loader.load('textures/moon_day_16k.jpg')
colorMap.colorSpace = THREE.SRGBColorSpace
colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy()

// 月面材质：贴图明暗按太阳方向计算——
// dayMix 由月面法线与太阳方向点积经 smoothstep 得出，晨昏带平滑过渡；
// 白天侧带简单漫反射明暗，夜面（无灯光）保留约 3% 表面微光隐约可见地形。
// 开发：TRAE / GLM / GLM-5.3
const moonUniforms = {
  dayMap: { value: colorMap },
  sunDirection: { value: new THREE.Vector3(4, 1.5, 3).normalize() }
}
const moon = new THREE.Mesh(
  // 160 段：16 倍放大时 96 段的轮廓多边形误差约 2px 可见，160 段缩到 0.7px 以下。
  // 开发：TRAE / GLM / GLM-5.3
  new THREE.SphereGeometry(MOON_RADIUS, 160, 160),
  new THREE.ShaderMaterial({
    uniforms: moonUniforms,
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
scene.add(moon)

let running = true
let frameHandle = 0
let lastTime = performance.now()

// 转速（rad/s）：来自宿主统一设置 rotationSpeed，0 表示停转；
// 无宿主环境（浏览器直接打开）时用默认值。开发：TRAE / GLM / GLM-5.3
let rotationSpeed = 0.12

// 实时模式：来自宿主统一设置 realtime。开启后按真实月相打光——月球潮汐锁定，
// 正面固定朝向相机，直射点相对月面每个朔望月（29.53 天）绕一圈。
// 开发：TRAE / GLM / GLM-5.3
let realtime = false

const DEG = Math.PI / 180
const sinDeg = (x) => Math.sin(x * DEG)

// ---- 月相计算（Meeus《Astronomical Algorithms》截断级数），单位：度 ----
// 返回太阳直射经度（东经为正）：新月 180°（背面被照、正面全暗），满月 0°（正面全亮），
// 上弦 +90°（正面右半亮），下弦 -90°（正面左半亮）——与北半球裸眼看月一致。
// 月球黄经取前 6 个主要摄动项（精度约 0.3°），太阳黄经取低精度公式（精度约 0.01°）。
// 推导：月球本体 +X 指向地球（潮汐锁定），太阳在本体系的方位角 = 180° − 真距角 D
// （D = 月球黄经 − 太阳黄经）。three.js UV：贴图中心（经度 0°，正面中心）在 +X，
// 东经 90° 在 -Z，因此本体系经度 L 的方向向量为 (cos L, 0, -sin L)。
// 开发：TRAE / GLM / GLM-5.3
function moonSun(now) {
  const d = 2440587.5 + now.getTime() / 86400000 - 2451545.0 // J2000 起算天数

  // 太阳黄经（Meeus ch.25 低精度公式）
  const Ls = 280.46646 + 0.98564736 * d
  const Ms = 357.52911 + 0.98560028 * d
  const lambdaSun = Ls + 1.914602 * sinDeg(Ms) + 0.019993 * sinDeg(2 * Ms)

  // 月球黄经（Meeus ch.47 截断：平黄经 + 前 6 个摄动项）
  const Lp = 218.31645 + 13.17639648 * d
  const D = 297.85019 + 12.19074912 * d // 平距角
  const Mp = 134.96341 + 13.06499295 * d // 月球平近点角
  const F = 93.27210 + 13.22935024 * d // 升交点角距离
  const lambdaMoon = Lp
    + 6.288774 * sinDeg(Mp)
    + 1.274027 * sinDeg(2 * D - Mp)
    + 0.658314 * sinDeg(2 * D)
    + 0.213618 * sinDeg(2 * Mp)
    - 0.185116 * sinDeg(Ms)
    - 0.114332 * sinDeg(2 * F)

  // 真距角 → 直射经度，均归一到 (-180, 180]
  const elongation = ((lambdaMoon - lambdaSun) % 360 + 540) % 360 - 180
  const subsolarLon = ((180 - elongation) % 360 + 540) % 360 - 180
  return { subsolarLon, elongation }
}

// 实时模式：太阳位置每帧由当前时刻重算。月球已转至 rotation.y = -π/2（正面朝相机），
// 本体直射经度 L 的局部方向 (cos L, 0, -sin L) 旋转后的世界方向为 (sin L, 0, cos L)：
// 满月 L=0 太阳在正前方（正面全亮），上弦 L=+90° 太阳在屏幕右侧（正面右半亮）。
// 开发：TRAE / GLM / GLM-5.3
function updateRealtimeSun() {
  const { subsolarLon } = moonSun(new Date())
  const lon = subsolarLon * DEG
  sun.position.set(Math.sin(lon), 0, Math.cos(lon))
}

// shader 的太阳方向与实时月相计算共用一个虚拟方向（ShaderMaterial 不读取场景光，
// sun.position 仅作为 sunDirection 的载体）。开发：TRAE / GLM / GLM-5.3
const sun = { position: new THREE.Vector3(4, 1.5, 3) }

function frame(now) {
  frameHandle = 0
  if (!running) return
  const delta = Math.min(0.1, (now - lastTime) / 1000)
  lastTime = now
  if (realtime) {
    // 实时模式：潮汐锁定——正面朝向相机（rotation.y=-π/2 使经度 0° 对准相机方向 +Z），
    // 太阳每帧由真实月相重算；帧率波动或暂停恢复都不产生漂移。开发：TRAE / GLM / GLM-5.3
    moon.rotation.y = -Math.PI / 2
    updateRealtimeSun()
  } else {
    moon.rotation.y += rotationSpeed * delta
  }
  moonUniforms.sunDirection.value.copy(sun.position).normalize()
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
// 水平拖动改变方位角 theta，垂直拖动改变俯仰角 phi（clamp 在两极之间），相机始终看向月球中心。
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
  // 转速统一设置：注册回调立即收到当前快照（含 manifest 默认值），用户在详情页拖动后收到新值。
  // 未知 key 或非法值保持当前转速，不猜不改。开发：TRAE / GLM / GLM-5.3
  runtime.onSettingsChange((settings) => {
    const value = settings.rotationSpeed
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1.2) rotationSpeed = value
    const nextRealtime = settings.realtime
    if (typeof nextRealtime === 'boolean' && nextRealtime !== realtime) {
      realtime = nextRealtime
      // 切回非实时：恢复固定太阳位置（实时模式曾按月相移动过 sun.position）
      if (!realtime) sun.position.set(4, 1.5, 3)
    }
  })

  // hidden/paused 暂停渲染，shown/resumed 恢复；未注册时事件丢弃，不影响渲染本身
  runtime.onLifecycle((state) => {
    if (state.type === 'hidden' || state.type === 'paused') stopLoop()
    else if (state.type === 'shown' || state.type === 'resumed') startLoop()
  })

  // 宿主 visualScale 放大 iframe 时不改变 320px 布局，canvas 若保持 320px 分辨率会被拉伸发糊；
  // 这里按 visualScale 同步提升像素比，使渲染缓冲匹配宿主缩放后的物理像素，缩放时保持清晰。
  // 按协议第 3 节，仅在 phase='committed'（本次调整完成）后应用，changing 期间不重分配缓冲。
  // 上限 16 与 manifest visualScale.max 一致；像素比上限 32 = 最大缩放 16 × 最大设备像素比 2，
  // 最大缓冲 320×32=10240px，仍在 WebGL MAX_TEXTURE_SIZE(16384) 限制内。
  // 开发：TRAE / GLM / GLM-5.3
  const applyRenderScale = (visualScale) => {
    const scale = Number.isFinite(visualScale) && visualScale > 0 ? Math.min(visualScale, 16) : 1
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