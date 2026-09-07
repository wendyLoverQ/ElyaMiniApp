# Farm Planet model

This directory contains the first authored 3D model for the Elya farming Mini App concept. Its art direction is anime-inspired rather than realistic: bold silhouettes, clean color blocks, low-poly forms, bright pastel materials, stepped cel shading, and Blender Freestyle outlines.

- `assets/farm-planet.glb`: runtime asset for Three.js.
- `source/farm-planet.blend`: editable Blender source.
- `preview.png`: deterministic preview render.
- `tools/build_planet.py`: Blender CLI build script.

The GLB uses one continuous `Planet_Ground` mesh. Its arable soil is assigned directly to faces of that mesh, with no plot boards, decals, or overlay geometry. Eight invisible crop anchors (`CropAnchor_01` through `CropAnchor_08`) provide initial planting positions; future grass, trees, and crops grow outward along the actual planet surface normal.

Rebuild with Blender 5.2 LTS:

```powershell
G:\blender\blender.exe --background --python tools\build_planet.py
```
