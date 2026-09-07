// 自旋地球 Mini APP：THREE.js 透明背景渲染。
// 地表与夜灯来自 NASA GIBS 每日实拍卫星数据（VIIRS 真彩 + Black Marble 夜灯），
// 云来自 Live Cloud Maps 实时云图（3 小时），晨昏线按真实 UTC 时间计算；
// 未联网时地表回落到内置 8K 静态图、夜面无灯光、无云。
// 转速由宿主统一设置 rotationSpeed 控制（realtime 开启时由宿主置灰）；
// hidden/paused 生命周期时停止渲染循环与数据轮询节能。
// Imagery courtesy of NASA EOSDIS GIBS (public domain)。
// 开发：TRAE / GLM / GLM-5.3
import * as THREE from './vendor/three.module.min.js'

const VIEWPORT = 320
const EARTH_RADIUS = 1.8
const CAMERA_DISTANCE = 8

const stage = document.querySelector('.earth-stage')
if (!(stage instanceof HTMLElement)) throw new Error('自旋地球页面结构不完整')

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.setSize(VIEWPORT, VIEWPORT)
renderer.setClearColor(0x000000, 0)
stage.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
camera.position.set(0, 0, CAMERA_DISTANCE)

// 平行光模拟太阳（供云层 Lambert 材质），弱偏蓝环境光保留云层暗面轮廓；
// 地表昼夜由自定义 shader 的 sunDirection 决定，同一方向。
// 开发：TRAE / GLM / GLM-5.3
const sun = new THREE.DirectionalLight(0xfff2dc, 2.4)
sun.position.set(4, 1.5, 3)
scene.add(sun)
scene.add(new THREE.AmbientLight(0x2a3a55, 0.9))

const loader = new THREE.TextureLoader()
// 离线底图（Solar System Scope，CC BY 4.0）：未联网时显示；联网后作为 GIBS 瓦片的
// 画布底衬（个别瓦片缺失时透出，避免出现黑洞）。开发：TRAE / GLM / GLM-5.3
const colorMap = loader.load('textures/earth_day_8k.jpg')
colorMap.colorSpace = THREE.SRGBColorSpace
colorMap.anisotropy = renderer.capabilities.getMaxAnisotropy()

// 夜面初始为 1×1 黑贴图（无灯光），联网拉到 GIBS 夜灯后整体替换。
// 开发：TRAE / GLM / GLM-5.3
const blackNight = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
blackNight.needsUpdate = true

// 地表材质：白天贴图与夜晚城市灯光按太阳方向混合——
// dayMix 由地表法线与太阳方向点积经 smoothstep 得出，晨昏带平滑过渡；
// 白天侧带简单漫反射明暗，夜晚侧显示实拍灯光（稍作提亮）。开发：TRAE / GLM / GLM-5.3
const earthUniforms = {
  dayMap: { value: colorMap },
  nightMap: { value: blackNight },
  sunDirection: { value: new THREE.Vector3(4, 1.5, 3).normalize() }
}
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_RADIUS, 96, 96),
  new THREE.ShaderMaterial({
    uniforms: earthUniforms,
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
      uniform sampler2D nightMap;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vec3 day = texture2D(dayMap, vUv).rgb;
        vec3 night = texture2D(nightMap, vUv).rgb;
        float d = dot(normalize(vWorldNormal), normalize(sunDirection));
        float dayMix = smoothstep(-0.15, 0.12, d);
        vec3 lit = day * (0.16 + 1.05 * max(d, 0.0));
        vec3 col = mix(night * 1.7, lit, dayMix);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `
  })
)
scene.add(earth)

// 云层：初始不可见（不内置静态云），仅在联网拉取到实时卫星云图后显示；
// 云球按约 10 km 云顶高度缩放，避免贴近地球边缘观察时出现夸张的悬空间隙；
// alphaTest 裁掉 JPG 黑底压缩产生的极低透明度灰边。开发：Codex / GPT / gpt-5
const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_RADIUS * 1.0015, 96, 96),
  new THREE.MeshLambertMaterial({
    color: 0xffffff,
    alphaMap: null,
    transparent: true,
    alphaTest: 0.06,
    depthWrite: false
  })
)
clouds.visible = false
scene.add(clouds)

let running = true
let frameHandle = 0
let lastTime = performance.now()

// 转速（rad/s）：来自宿主统一设置 rotationSpeed，0 表示停转；
// 无宿主环境（浏览器直接打开）时用默认值。开发：TRAE / GLM / GLM-5.3
let rotationSpeed = 0.12

// 实时模式：来自宿主统一设置 realtime。开启后太阳方向按真实 UTC 时间计算
// （直射点经度 + 季节赤纬，晨昏线对准真实位置），地球以真实角速度"自转"
// （一天一圈，视觉上由太阳绕行体现，暂停/恢复无漂移）。开发：TRAE / GLM / GLM-5.3
let realtime = false

// three.js SphereGeometry 的 UV：贴图中心（经度 0°，格林威治）在 +X，东经 90° 在 -Z，
// 因此地理经度 L 的方向向量为 (cos L, 0, -sin L)；earth.rotation.y=0 时贴图与经度对齐。
// 太阳直射经度 = (12 - UTC 小时) × 15°；赤纬按一年周期近似（春分第 80.75 天过零）。
// 开发：TRAE / GLM / GLM-5.3
function updateRealtimeSun() {
  const now = new Date()
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600 + now.getUTCMilliseconds() / 3_600_000
  const lon = ((12 - utcHours) * 15) * Math.PI / 180
  const dayOfYear = (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86_400_000
  const decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (dayOfYear - 80.75) / 365.25)
  const sunDistance = 5
  sun.position.set(
    Math.cos(lon) * Math.cos(decl) * sunDistance,
    Math.sin(decl) * sunDistance,
    -Math.sin(lon) * Math.cos(decl) * sunDistance
  )
}

function frame(now) {
  frameHandle = 0
  if (!running) return
  const delta = Math.min(0.1, (now - lastTime) / 1000)
  lastTime = now
  if (realtime) {
    // 实时模式：地球朝向锁定对齐（rotation.y=0），太阳每帧由 UTC 重算——直射点相对地表每天绕一圈，
    // 等价于地球真实自转；帧率波动或暂停恢复都不产生漂移。开发：TRAE / GLM / GLM-5.3
    earth.rotation.y = 0
    clouds.rotation.y = 0
    updateRealtimeSun()
  } else {
    earth.rotation.y += rotationSpeed * delta
    clouds.rotation.y += rotationSpeed * 1.25 * delta
  }
  // 地表昼夜 shader 与云层共用同一太阳方向
  earthUniforms.sunDirection.value.copy(sun.position).normalize()
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
// 水平拖动改变方位角 theta，垂直拖动改变俯仰角 phi（clamp 在两极之间），相机始终看向地球中心。
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
      // 切回非实时：恢复固定太阳位置（实时模式曾按 UTC 移动过 sun.position）
      if (!realtime) sun.position.set(4, 1.5, 3)
    }
  })

  // ---- 联网数据层：全部经宿主 network 代理拉取；云、白天地表和夜灯互不依赖并行加载。
  // 不在资源侧增加通用串行队列或固定请求间隔，避免一个慢服务阻塞其他实时内容。开发：Codex / GPT / gpt-5 ----
  const fetchTexture = (url) => runtime.network.fetch({ url, responseType: 'blob' })
  const networkReady = () => runtime.network !== undefined && runtime.network !== null

  // 实时云图（Live Cloud Maps，多颗气象卫星合成，CC0）：拉取后显示云层，每 3 小时刷新（与服务端更新节奏一致）。
  // 未授权或失败时保持无云（不显示任何静态假云），下个周期再试。开发：TRAE / GLM / GLM-5.3
  const CLOUD_URL = 'https://clouds.matteason.co.uk/images/2048x1024/clouds.jpg'
  const CLOUD_REFRESH_MS = 3 * 60 * 60 * 1000
  let cloudObjectUrl = null
  const applyLiveClouds = async () => {
    if (!networkReady()) return
    try {
      const response = await fetchTexture(CLOUD_URL)
      if (response.status !== 200 || !(response.blob instanceof Blob)) return
      const objectUrl = URL.createObjectURL(response.blob)
      loader.load(objectUrl, (texture) => {
        texture.colorSpace = THREE.NoColorSpace
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
        const previousAlphaMap = clouds.material.alphaMap
        clouds.material.alphaMap = texture
        clouds.material.needsUpdate = true
        clouds.visible = true
        if (previousAlphaMap !== null) previousAlphaMap.dispose()
        if (cloudObjectUrl !== null) URL.revokeObjectURL(cloudObjectUrl)
        cloudObjectUrl = objectUrl
      }, undefined, (error) => {
        URL.revokeObjectURL(objectUrl)
        console.warn('[spinning-earth] cloud texture decode failed', error)
      })
    } catch (error) {
      // 拉取失败保持无云，下个周期再试。开发：Codex / GPT / gpt-5
      console.warn('[spinning-earth] cloud request failed', error)
    }
  }


  // ---- NASA GIBS 每日实拍地表与夜灯 ----
  // 使用官方 EPSG:4326 WMS 一次取得 2048×1024 全球图；白天固定从昨日开始探测，夜灯从当日开始探测。
  // 每 6 小时复查新日期，已加载日期不会重复下载。Imagery courtesy of NASA EOSDIS GIBS (public domain)。
  // 开发：Codex / GPT / gpt-5
  const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi'
  const GIBS_WIDTH = 2048
  const GIBS_HEIGHT = 1024
  const GIBS_REFRESH_MS = 6 * 60 * 60 * 1000

  const utcDateOffset = (days) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

  // 空白图检测：GIBS 对尚未生成数据的日期会返回 HTTP 200、合法 PNG/JPEG、非零大小
  // 但内容全透明或全黑的"空图"（实测 2048×1024 仅 2KB、16384 采样点 0 个有内容），
  // 状态码/大小/类型校验全部通过，会被误当有效贴图加载（夜灯因此从未显示过）。
  // 这里解码缩到 256×128 后检查是否存在可见像素（非透明且非纯黑），空白则视为无效，
  // 让 fetchGibsLayer 继续探测下一个候选日期。解码失败（损坏图）抛异常由调用方
  // 的 try/catch 捕获后同样跳过该候选。开发：TRAE / GLM / GLM-5.3
  const hasVisibleContent = async (blob) => {
    const bitmap = await createImageBitmap(blob, { resizeWidth: 256, resizeHeight: 128, resizeQuality: 'low' })
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const data = ctx.getImageData(0, 0, 256, 128).data
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0 && (data[i] > 8 || data[i + 1] > 8 || data[i + 2] > 8)) return true
    }
    return false
  }

  // 返回第一个可用日期的整图 Blob；服务异常 XML、空响应或全空白图都不会被当作有效图片。开发：Codex / GPT / gpt-5
  const fetchGibsLayer = async ({ layer, format, dateCandidates, skipIfDate }) => {
    if (!networkReady()) return null
    for (const candidate of dateCandidates) {
      if (candidate === skipIfDate) return null
      try {
        const query = new URLSearchParams({
          SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layer, STYLES: '',
          FORMAT: format, TRANSPARENT: format === 'image/png' ? 'true' : 'false',
          HEIGHT: String(GIBS_HEIGHT), WIDTH: String(GIBS_WIDTH), CRS: 'EPSG:4326',
          BBOX: '-90,-180,90,180', TIME: candidate
        })
        const response = await fetchTexture(`${GIBS_WMS}?${query.toString()}`)
        if (response.status === 200 && response.blob instanceof Blob && response.blob.size > 0 && response.blob.type.startsWith('image/') &&
            await hasVisibleContent(response.blob)) {
          return { blob: response.blob, date: candidate }
        }
      } catch (error) {
        console.warn(`[spinning-earth] GIBS ${layer} request failed for ${candidate}`, error)
      }
    }
    return null
  }

  const applyLayerTexture = (uniformSlot, blob) => new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob)
    loader.load(objectUrl, (texture) => {
      URL.revokeObjectURL(objectUrl)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
      const previous = earthUniforms[uniformSlot].value
      earthUniforms[uniformSlot].value = texture
      if (previous !== null && previous !== undefined) previous.dispose()
      resolve()
    }, undefined, (error) => {
      URL.revokeObjectURL(objectUrl)
      reject(error)
    })
  })

  let loadedDayDate = null
  let loadedNightDate = null
  // 白天地表与夜灯互不依赖，并行探测与加载（此前串行，白天层慢会拖慢夜灯首显）；
  // 两层各自捕获异常，单层失败不影响另一层。开发：TRAE / GLM / GLM-5.3
  const applyGibsLayers = async () => {
    if (!networkReady()) return
    await Promise.all([
      (async () => {
        const day = await fetchGibsLayer({
          layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
          format: 'image/jpeg',
          dateCandidates: [utcDateOffset(-1), utcDateOffset(-2), utcDateOffset(-3)],
          skipIfDate: loadedDayDate
        })
        if (day === null) return
        try {
          await applyLayerTexture('dayMap', day.blob)
          loadedDayDate = day.date
        } catch (error) {
          console.warn('[spinning-earth] day texture decode failed', error)
        }
      })(),
      (async () => {
        const night = await fetchGibsLayer({
          layer: 'VIIRS_NOAA20_GapFilled_BRDF_Corrected_DayNightBand_Radiance',
          format: 'image/png',
          dateCandidates: [utcDateOffset(0), utcDateOffset(-1), utcDateOffset(-2), utcDateOffset(-3)],
          skipIfDate: loadedNightDate
        })
        if (night === null) return
        try {
          await applyLayerTexture('nightMap', night.blob)
          loadedNightDate = night.date
        } catch (error) {
          console.warn('[spinning-earth] night texture decode failed', error)
        }
      })()
    ])
  }

  // ---- 数据刷新生命周期管理：hidden/paused 时渲染已停，定时轮询只是浪费请求，
  // 同步暂停；shown/resumed 恢复定时器，并补拉已过期的云图（服务端约 3 小时更新一次，
  // 距上次拉取不足一个周期则跳过）。GIBS 复查同日期时 skipIfDate 直接跳过，无网络请求。
  // 开发：TRAE / GLM / GLM-5.3 ----
  let cloudTimer = 0
  let gibsTimer = 0
  let lastCloudFetchAt = 0
  const refreshClouds = () => {
    if (Date.now() - lastCloudFetchAt < CLOUD_REFRESH_MS) return
    lastCloudFetchAt = Date.now()
    void applyLiveClouds()
  }
  const startDataTimers = () => {
    if (cloudTimer === 0) cloudTimer = setInterval(() => { void refreshClouds() }, CLOUD_REFRESH_MS)
    if (gibsTimer === 0) gibsTimer = setInterval(() => { void applyGibsLayers() }, GIBS_REFRESH_MS)
  }
  const stopDataTimers = () => {
    if (cloudTimer !== 0) {
      clearInterval(cloudTimer)
      cloudTimer = 0
    }
    if (gibsTimer !== 0) {
      clearInterval(gibsTimer)
      gibsTimer = 0
    }
  }

  // 联网数据任务启动：权限 UI 在首次加载时弹出，授权总是发生在 iframe 启动之后；
  // 协议没有权限变化回调，而 runtime.network 是动态 getter（宿主推送 permissions-state 后立即生效），
  // 因此启动时未授权则以 5 秒轮询等待，授权后立即开始拉取云与 GIBS 实拍数据并停止轮询。
  // 开发：TRAE / GLM / GLM-5.3
  const startNetworkData = () => {
    lastCloudFetchAt = Date.now()
    void applyLiveClouds()
    void applyGibsLayers()
    startDataTimers()
  }
  if (networkReady()) {
    startNetworkData()
  } else {
    const permissionPoll = setInterval(() => {
      if (!networkReady()) return
      clearInterval(permissionPoll)
      startNetworkData()
    }, 5000)
  }

  // hidden/paused 暂停渲染与数据轮询，shown/resumed 恢复并补拉过期数据；
  // 未注册时事件丢弃，不影响渲染本身。开发：TRAE / GLM / GLM-5.3
  runtime.onLifecycle((state) => {
    if (state.type === 'hidden' || state.type === 'paused') {
      stopLoop()
      stopDataTimers()
    } else if (state.type === 'shown' || state.type === 'resumed') {
      startLoop()
      if (networkReady()) {
        refreshClouds()
        void applyGibsLayers()
        startDataTimers()
      }
    }
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
