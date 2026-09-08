# Farm Planet model

This directory contains the first authored 3D model for the Elya farming Mini App concept. Its art direction is anime-inspired rather than realistic: bold silhouettes, clean color blocks, low-poly forms, bright pastel materials, stepped cel shading, and Blender Freestyle outlines.

- `assets/farm-planet.glb`: runtime asset for Three.js.
- `source/farm-planet.blend`: editable Blender source.
- `source/planet-surface.png`: baked grass, farmland, and river surface texture.
- `preview.png`: deterministic preview render.
- `tools/build_planet.py`: Blender CLI build script.

The GLB uses one continuous `Planet_Ground` mesh. A baked surface texture gives it a clean, sphere-projected rectangular field and an anti-aliased winding river without plot boards or block-shaped material faces. Eight invisible crop anchors (`CropAnchor_01` through `CropAnchor_08`) provide initial planting positions; future grass, trees, and crops grow outward along the actual planet surface normal. Trees use tapered trunks, visible branches, and coherent three-part crowns; decorative rocks are intentionally omitted from this version.

Rebuild with Blender 5.2 LTS:

```powershell
G:\blender\blender.exe --background --python tools\build_planet.py
```
