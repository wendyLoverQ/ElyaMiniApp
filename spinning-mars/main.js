// 自旋火星 Mini APP：THREE.js 透明背景渲染。
// 地表使用 Solar System Scope 8K 火星贴图（基于 NASA 探测器影像，CC BY 4.0）；
// 昼夜由自定义 shader 的 sunDirection 决定。火星无云层与城市灯光，夜面仅显示微弱表面轮廓。
// 转速由宿主统一设置 rotationSpeed 控制；hidden/paused 生命周期时停止渲染循环节能。
// 实时模式采用 NASA GISS Mars24 算法（Allison & McEwen 2000）：
// 按火星协调时 MTC 计算太阳直射经度（含火星时差 EOT 修正）、
// 按火星黄经 Ls 计算太阳赤纬，火星以真实火星日（24h39m35.244s）一天一圈。
// 开发：TRAE / GLM / GLM-5.3
import * as THREE from './vendor/three.module.min.js'

const VIEWPORT = 320
const MARS_RADIUS = 1.8
const CAMERA_DISTANCE = 8

const stage = document.querySelector('.mars-stage')
if (!(stage instanceof HTMLElement)) throw new Error('自旋火星页面结构不完整')

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.setSize(VIEWPORT, VIEWPORT)
renderer.setClearColor(0x000000, 0)
stage.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
camera.position.set(0, 0, CAMERA_DISTANCE)

// 火星球体是纯 ShaderMaterial（自定义昼夜着色），不使用场景光源。
// 开发：TRAE / GLM / GLM-5.3
const loader = new THREE.TextureLoader()
const colorMap = loader.load('textures/mars_day_8k.jpg')
colorMap.colorSpace = THREE.SRGBColorSpace
colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy()

// 火星材质：贴图明暗按太阳方向计算——
// dayMix 由地表法线与太阳方向点积经 smoothstep 得出，晨昏带平滑过渡；
// 白天侧带简单漫反射明暗，夜面（无灯光）保留约 3% 表面微光隐约可见地形。
// 开发：TRAE / GLM / GLM-5.3
const marsUniforms = {
  dayMap: { value: colorMap },
  sunDirection: { value: new THREE.Vector3(4, 1.5, 3).normalize() }
}
const mars = new THREE.Mesh(
  new THREE.SphereGeometry(MARS_RADIUS, 96, 96),
  new THREE.ShaderMaterial({
    uniforms: marsUniforms,
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
scene.add(mars)

let running = true
let frameHandle = 0
let lastTime = performance.now()

// 转速（rad/s）：来自宿主统一设置 rotationSpeed，0 表示停转；
// 无宿主环境（浏览器直接打开）时用默认值。开发：TRAE / GLM / GLM-5.3
let rotationSpeed = 0.12

// 实时模式：来自宿主统一设置 realtime。开启后按 Mars24 算法计算真实太阳方向
// （直射点经度含时差修正 + 按火星黄经计算赤纬），火星以真实火星日自转
// （一天一圈，视觉上由太阳绕行体现，暂停/恢复无漂移）。开发：TRAE / GLM / GLM-5.3
let realtime = false

const DEG = Math.PI / 180
const sinDeg = (x) => Math.sin(x * DEG)

// ---- NASA GISS Mars24 算法（Allison & McEwen 2000 及后续修订），单位：度 / 小时 ----
// 返回 { subsolarLon: 太阳直射经度（东经为正）, decl: 太阳赤纬 }。
// three.js SphereGeometry 的 UV：贴图中心（经度 0°，Airy-0 本初子午线）在 +X，东经 90° 在 -Z，
// 因此地理经度 L 的方向向量为 (cos L, 0, -sin L)。
// 直射经度 = 15 × (12 - MTC) - EOT：MTC 为本初子午线平太阳时，EOT 为真太阳与平太阳的时差
// （火星轨道偏心率大，EOT 可达约 ±13°，远大于地球，不可忽略）。
// 赤纬 δ = asin(0.42565 · sin Ls) + 0.25° · sin Ls（0.42565 = sin 25.19° 火星黄赤交角，
// 第二项为 planetographic 椭球修正）。开发：TRAE / GLM / GLM-5.3
function mars24Sun(now) {
  const jdUT = 2440587.5 + now.getTime() / 86400000
  const jdTT = jdUT + 69.184 / 86400 // TT-UTC 固定 69.184s（37 闰秒 + 32.184）
  const dt = jdTT - 2451545.0

  const msd = (dt - 4.5) / 1.0274912517 + 44796.0 - 0.0009626
  const mtc = (24 * msd) % 24

  // B-1 火星平近点角；B-2 虚构平太阳角
  const M = 19.3871 + 0.52402073 * dt
  const alphaFMS = 270.3863 + 0.524038496 * dt
  // B-3 其他行星摄动项
  const pbsA = [0.0071, 0.0057, 0.0039, 0.0037, 0.0021, 0.0020, 0.0018]
  const pbsTau = [2.2353, 2.7543, 1.1177, 15.7866, 2.1354, 2.4694, 32.8493]
  const pbsPhi = [49.409, 168.173, 191.837, 21.736, 15.704, 95.528, 49.095]
  let pbs = 0
  for (let i = 0; i < pbsA.length; i += 1) {
    pbs += pbsA[i] * sinDeg(0.985626 * dt / pbsTau[i] + pbsPhi[i])
  }
  // B-4 中心差；B-5 火星黄经 Ls
  const nuMinusM = (10.691 + 3.0e-7 * dt) * sinDeg(M)
    + 0.623 * sinDeg(2 * M)
    + 0.050 * sinDeg(3 * M)
    + 0.005 * sinDeg(4 * M)
    + 0.0005 * sinDeg(5 * M)
    + pbs
  const ls = alphaFMS + nuMinusM
  // C-1 火星时差
  const eot = 2.861 * sinDeg(2 * ls) - 0.071 * sinDeg(4 * ls) + 0.002 * sinDeg(6 * ls) - nuMinusM

  // D-1 太阳赤纬（度）；直射经度（度，东经为正）
  const decl = Math.asin(0.42565 * sinDeg(ls)) / DEG + 0.25 * sinDeg(ls)
  const subsolarLon = 15 * (12 - mtc) - eot
  return { subsolarLon, decl }
}

// 实时模式：太阳位置每帧由当前 UTC 重算（Mars24），等价于火星按真实火星日自转；
// 帧率波动或暂停恢复都不产生漂移。开发：TRAE / GLM / GLM-5.3
function updateRealtimeSun() {
  const { subsolarLon, decl } = mars24Sun(new Date())
  const lon = subsolarLon * DEG
  const dec = decl * DEG
  const sunDistance = 5
  sun.position.set(
    Math.cos(lon) * Math.cos(dec) * sunDistance,
    Math.sin(dec) * sunDistance,
    -Math.sin(lon) * Math.cos(dec) * sunDistance
  )
}

// shader 的太阳方向与 Mars24 实时计算共用一个虚拟光源位置（ShaderMaterial 不读取场景光，
// sun.position 仅作为 sunDirection 的载体）。开发：TRAE / GLM / GLM-5.3
const sun = { position: new THREE.Vector3(4, 1.5, 3) }

function frame(now) {
  frameHandle = 0
  if (!running) return
  const delta = Math.min(0.1, (now - lastTime) / 1000)
  lastTime = now
  if (realtime) {
    // 实时模式：火星朝向锁定对齐（rotation.y=0），太阳每帧由 Mars24 重算——
    // 直射点相对火星地表每个火星日绕一圈。开发：TRAE / GLM / GLM-5.3
    mars.rotation.y = 0
    updateRealtimeSun()
  } else {
    mars.rotation.y += rotationSpeed * delta
  }
  marsUniforms.sunDirection.value.copy(sun.position).normalize()
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
// 水平拖动改变方位角 theta，垂直拖动改变俯仰角 phi（clamp 在两极之间），相机始终看向火星中心。
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
      // 切回非实时：恢复固定太阳位置（实时模式曾按 Mars24 移动过 sun.position）
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
  // 上限 8 与 manifest visualScale.max 一致；像素比上限 16 = 最大缩放 8 × 最大设备像素比 2。
  // 开发：TRAE / GLM / GLM-5.3
  const applyRenderScale = (visualScale) => {
    const scale = Number.isFinite(visualScale) && visualScale > 0 ? Math.min(visualScale, 8) : 1
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * scale)
    renderer.setSize(VIEWPORT, VIEWPORT)
  }
  runtime.onPresentationChange((state) => {
    if (state.phase === 'committed') applyRenderScale(state.visualScale)
  })
}
