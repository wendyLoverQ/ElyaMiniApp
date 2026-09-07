# Farm Planet model

This directory contains the first authored 3D model for the Elya farming Mini App concept. Its art direction is anime-inspired rather than realistic: bold silhouettes, clean color blocks, low-poly forms, bright pastel materials, stepped cel shading, and Blender Freestyle outlines.

- `assets/farm-planet.glb`: runtime asset for Three.js.
- `source/farm-planet.blend`: editable Blender source.
- `preview.png`: deterministic preview render.
- `tools/build_planet.py`: Blender CLI build script.

The GLB exposes eight named crop anchors (`CropAnchor_01` through `CropAnchor_08`) and matching curved plot meshes laid directly on the planet surface. The base model intentionally has no raised platform, farmhouse, windmill, or pond; future crops grow outward along each anchor's local surface normal.

Rebuild with Blender 5.2 LTS:

```powershell
G:\blender\blender.exe --background --python tools\build_planet.py
```
