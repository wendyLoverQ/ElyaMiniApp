# 骑单车的鹈鹕

一个使用纯 SVG 绘制的 Elya Mini APP。背景完全透明，鹈鹕会由宿主托管位置能力在桌面上往返骑行。

## 使用

将 `pelican-bike` 文件夹直接导入 Elya。资源详情中可以调整：

- `车速`：0–160 px/s，0 为停止。
- `自动骑行`：关闭后停在当前位置。

拖动鹈鹕或单车可以移动它；滚轮与长按手势由 Elya 控制整体缩放。透明区域不会拦截桌面点击。

## 文件

- `index.html`：内联 SVG 角色与单车结构。
- `styles.css`：车轮、脚踏、身体和喉囊动画。
- `main.js`：设置同步、交互表面和宿主托管移动。
- `manifest.json`：Elya web-pet 资源声明。
- `preview.png`：资源预览图。

开发：Codex / GPT / gpt-5
