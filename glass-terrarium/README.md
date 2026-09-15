# 玻璃生态瓶

一个透明桌面生态瓶。植物会依据经过的时间缓慢生长，湿度会下降；点击瓶颈右侧的金色水滴可以浇水。每个桌宠实例保存自己的生长与湿度状态。

## 文件

- `manifest.json`：Elya Mini APP 清单、设置与操作说明
- `index.html`：透明画布与浇水控件
- `styles.css`：宿主窗口尺寸与黄铜阀门命中区
- `vendor/`：本地 Three.js 与 glTF 加载模块，不依赖运行时网络
- `assets/fern-02/`：Poly Haven Fern 02 的 2K glTF 植株资源（CC0）
- `main.js`：实时三维瓶体、植物、动物、凝露、萤火虫、昼夜、浇水、生长和持久状态
- `preview.png`：由实时三维页面生成的透明预览

## 操作

- 拖动生态瓶：移动桌宠
- 点击金色水滴：浇水
- 缩放由 Elya 宿主手势处理

## 本地预览

在仓库根目录启动静态服务器后打开 `glass-terrarium/index.html`。浏览器预览没有 Elya Runtime，因此不会持久化状态，但绘制和浇水交互可正常运行。
