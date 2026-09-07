// 自旋土星 Mini APP：THREE.js 透明背景渲染，离线运行无需联网。
// 星球贴图（4096x2048，土星真实数据的最高分辨率）与环贴图（8192x500 含 alpha）
// 来自 Solar System Scope（基于 NASA 卡西尼/旅行者号数据，CC BY 4.0）。
// 环系按真实半径比例建模（贴图 u=0 映射 1.25R、u=1 映射 2.33R，含 C 环、B 环、
// 卡西尼缝、A 环）；星球扁率 0.9、自转轴倾角 26.73°。
// 环影投在星球表面、星球影子投在环上，均在 shader 中按太阳方向解析计算。
// 转速由宿主统一设置 rotationSpeed 控制；hidden/paused 生命周期时停止渲染循环节能。
// 开发：TRAE / GLM / GLM-5.3
import * as THREE from './vendor/three.module.min.js'

const VIEWPORT = 320
const SATURN_RADIUS = 1.12
const SATURN_FLAT = 0.9 // 极半径/赤道半径，土星是太阳系最扁的行星
const RING_INNER = SATURN_RADIUS * 1.25 // 贴图 u=0：C 环内侧（贴图自身左缘透明）
const RING_OUTER = SATURN_RADIUS * 2.33 // 贴图 u=1：F 环外侧（贴图自身右缘透明）
const AXIS_TILT = -26.73 * Math.PI / 180 // 土星自转轴倾角（朝右倾斜）
const CAMERA_DISTANCE = 9.5
const CAMERA_ELEVATION = 38 * Math.PI / 180 // 世界仰角 38°（约在环平面上方 33°），环呈开口椭圆

const stage = document.querySelector('.saturn-stage')
if (!(stage instanceof HTMLElement)) throw new Error('自旋土星页面结构不完整')

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.setSize(VIEWPORT, VIEWPORT)
renderer.setClearColor(0x000000, 0)
stage.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
camera.position.setFromSphericalCoords(CAMERA_DISTANCE, Math.PI / 2 - CAMERA_ELEVATION, 0)
// 视点略下压左移：近侧环弧因透视放大在屏幕上伸得比远侧更低更宽，补偿后整体剪影居中；
// 转视角时始终看向同一点，避免构图跳动。开发：TRAE / GLM / GLM-5.3
const LOOK_AT = new THREE.Vector3(-0.19, -0.36, 0)
camera.lookAt(LOOK_AT)

// 太阳方向（世界系）：右前方来光，位于环平面上方约 20°——不超过土星至日时太阳高度的上限
// 26.73°，环影横贯星球南半球中纬度（与卡西尼实拍一致），星球影子投向环的左后方
const sunDirection = new THREE.Vector3(0.886, -0.064, 0.459).normalize()

const loader = new THREE.TextureLoader()
const colorMap = loader.load('textures/saturn_day_4k.jpg')
colorMap.colorSpace = THREE.SRGBColorSpace
colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy()
const ringMap = loader.load('textures/saturn_ring.png')
ringMap.colorSpace = THREE.SRGBColorSpace
ringMap.anisotropy = renderer.capabilities.getMaxAnisotropy()

// 倾斜组：星球与环共享同一自转轴倾角
const tiltGroup = new THREE.Group()
tiltGroup.rotation.z = AXIS_TILT
scene.add(tiltGroup)

// 环平面法线（世界系），供两个 shader 的阴影计算使用；组只绕 z 旋转，法线恒定
const ringNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(tiltGroup.quaternion).normalize()

// 星球：自定义 shader 按太阳方向做昼夜明暗，并把环影（环 alpha 遮挡）解析投影到地表。
// y 缩放 0.9 模拟土星扁率；环影与球面求交按同一扁率空间计算。
const planetUniforms = {
  dayMap: { value: colorMap },
  ringMap: { value: ringMap },
  sunDirection: { value: sunDirection },
  ringNormal: { value: ringNormal },
  ringInner: { value: RING_INNER },
  ringOuter: { value: RING_OUTER }
}
const planet = new THREE.Mesh(
  new THREE.SphereGeometry(SATURN_RADIUS, 96, 96),
  new THREE.ShaderMaterial({
    uniforms: planetUniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D dayMap;
      uniform sampler2D ringMap;
      uniform vec3 sunDirection;
      uniform vec3 ringNormal;
      uniform float ringInner;
      uniform float ringOuter;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 day = texture2D(dayMap, vUv).rgb;
        float d = dot(normalize(vWorldNormal), normalize(sunDirection));
        float dayMix = smoothstep(-0.15, 0.12, d);
        vec3 lit = day * (0.15 + 1.08 * max(d, 0.0));
        // 环影：地表点向太阳方向发出的射线与环平面求交，
        // 命中环系（ringInner~ringOuter）则按贴图 alpha 遮挡阳光
        float t = -dot(vWorldPos, ringNormal) / dot(sunDirection, ringNormal);
        vec3 h = vWorldPos + t * sunDirection;
        float r = length(h);
        float u = clamp((r - ringInner) / (ringOuter - ringInner), 0.0, 1.0);
        float ringA = texture2D(ringMap, vec2(u, 0.5)).a;
        float inRing = step(ringInner, r) * step(r, ringOuter) * step(0.0, t);
        float shadow = 1.0 - ringA * 0.85 * inRing;
        // 夜面本来就暗，环影只作用于受光面
        vec3 col = lit * mix(1.0, shadow, dayMix);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `
  })
)
planet.scale.y = SATURN_FLAT
tiltGroup.add(planet)

// 环：RingGeometry 的 UV 改写为"径向展开"——u 从内缘 0 到外缘 1，
// 采样 8192x500 环剖面贴图的中心行；环身在星球背光侧解析计算星球投下的影子。
const ringGeometry = new THREE.RingGeometry(RING_INNER, RING_OUTER, 256, 1)
{
  const position = ringGeometry.attributes.position
  const uv = ringGeometry.attributes.uv
  const vertex = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i)
    uv.setXY(i, (vertex.length() - RING_INNER) / (RING_OUTER - RING_INNER), 0.5)
  }
}
const ringUniforms = {
  map: { value: ringMap },
  sunDirection: { value: sunDirection },
  ringNormal: { value: ringNormal },
  // 把世界坐标与太阳方向变换到"按星球扁率缩放"的空间，与单位球求交即得星球阴影
  planetScaleInv: { value: new THREE.Vector3(1 / SATURN_RADIUS, 1 / (SATURN_RADIUS * SATURN_FLAT), 1 / SATURN_RADIUS) }
}
const ring = new THREE.Mesh(
  ringGeometry,
  new THREE.ShaderMaterial({
    uniforms: ringUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 sunDirection;
      uniform vec3 ringNormal;
      uniform vec3 planetScaleInv;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vec4 tex = texture2D(map, vec2(vUv.x, 0.5));
        // 星球阴影：环上点向太阳方向的射线与（压扁的）星球求交，
        // 交点在单位球内即为影区，边缘用 smoothstep 软化半影
        vec3 p = vWorldPos * planetScaleInv;
        vec3 s = normalize(sunDirection * planetScaleInv);
        float tp = -dot(p, s);
        float dist = length(p + tp * s);
        float shadow = mix(0.12, 1.0, smoothstep(0.97, 1.12, dist));
        shadow = mix(1.0, shadow, step(0.0, tp));
        // 朝向太阳一侧的环反射更亮，背侧只透射微光
        float lit = 0.62 + 0.38 * smoothstep(-0.35, 0.45, dot(sunDirection, ringNormal));
        gl_FragColor = vec4(tex.rgb * lit * shadow, tex.a);
        #include <colorspace_fragment>
      }
    `
  })
)
// RingGeometry 默认生成在局部 XY 平面（法线 +Z），必须转到星球赤道平面（局部 XZ，法线 +Y）——
// 环与星球赤道共面，环影/星球影的解析计算才与实际渲染几何一致。开发：TRAE / GLM / GLM-5.3
ring.rotation.x = -Math.PI / 2
tiltGroup.add(ring)

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
  // 星球绕自身倾斜轴自转；环系径向对称，视觉上不随自转变化
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
// 水平拖动改变方位角 theta，垂直拖动改变俯仰角 phi（clamp 在两极之间），相机始终看向土星中心。
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
  camera.lookAt(LOOK_AT)
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