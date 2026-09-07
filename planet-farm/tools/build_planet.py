import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "assets"
SOURCE_DIR = ROOT / "source"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)
SOURCE_DIR.mkdir(parents=True, exist_ok=True)


def create_material(name, color, roughness=0.6, metallic=0.0):
    """Create one reusable PBR material. Codex / GPT-5 / model ID unavailable."""
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    diffuse = nodes.new("ShaderNodeBsdfDiffuse")
    shader_to_rgb = nodes.new("ShaderNodeShaderToRGB")
    ramp = nodes.new("ShaderNodeValToRGB")
    emission = nodes.new("ShaderNodeEmission")

    diffuse.inputs["Color"].default_value = (*color, 1.0)
    diffuse.inputs["Roughness"].default_value = roughness
    ramp.color_ramp.interpolation = "CONSTANT"
    dark = tuple(max(0.0, channel * 0.42) for channel in color)
    middle = tuple(min(1.0, channel * 0.78 + 0.035) for channel in color)
    light = tuple(min(1.0, channel * 1.08 + 0.045) for channel in color)
    ramp.color_ramp.elements[0].position = 0.34
    ramp.color_ramp.elements[0].color = (*dark, 1.0)
    mid = ramp.color_ramp.elements.new(0.58)
    mid.color = (*middle, 1.0)
    ramp.color_ramp.elements[-1].position = 0.74
    ramp.color_ramp.elements[-1].color = (*light, 1.0)

    links.new(diffuse.outputs["BSDF"], shader_to_rgb.inputs["Shader"])
    links.new(shader_to_rgb.outputs["Color"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], emission.inputs["Color"])
    links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return material


def assign_material(obj, material):
    obj.data.materials.append(material)


def parent_to_asset(obj, root):
    obj.parent = root
    return obj


def assign_integrated_surface(planet, grass_material, soil_material, water_material):
    """Paint farmland and a thin river into the planet mesh itself. Codex / GPT-5 / model ID unavailable."""
    planet.data.materials.append(grass_material)
    planet.data.materials.append(soil_material)
    planet.data.materials.append(water_material)
    farm_center = Vector((0.0, -0.48, 0.88)).normalized()
    farm_x = Vector((1.0, 0.0, 0.0))
    farm_y = farm_center.cross(farm_x).normalized()
    for polygon in planet.data.polygons:
        direction = polygon.center.normalized()
        local_x = direction.dot(farm_x)
        local_y = direction.dot(farm_y)
        rounded_field = (abs(local_x) / 0.37) ** 4 + (abs(local_y) / 0.23) ** 4 < 1.0
        faces_field = direction.dot(farm_center) > 0.91 and rounded_field

        river_center_x = 0.44 - 0.18 * (direction.z + 0.35) + 0.055 * math.sin(direction.z * 11.0)
        faces_river = (
            direction.y < -0.22
            and -0.58 < direction.z < 0.62
            and abs(direction.x - river_center_x) < 0.025
        )
        polygon.material_index = 2 if faces_river else (1 if faces_field else 0)


def add_tree(name, normal, planet_radius, materials, root, scale=1.0):
    """Place a stylized tree upright to the planet surface. Codex / GPT-5 / model ID unavailable."""
    normal = Vector(normal).normalized()
    rotation = normal.to_track_quat("Z", "Y").to_euler()

    bpy.ops.mesh.primitive_cone_add(
        vertices=12,
        radius1=0.105 * scale,
        radius2=0.065 * scale,
        depth=0.56 * scale,
        location=normal * (planet_radius + 0.20 * scale),
        rotation=rotation,
    )
    trunk = bpy.context.object
    trunk.name = f"{name}_Trunk"
    assign_material(trunk, materials["wood"])
    parent_to_asset(trunk, root)

    tangent_x = Vector((0, 0, 1)).cross(normal)
    if tangent_x.length < 0.001:
        tangent_x = Vector((1, 0, 0))
    tangent_x.normalize()
    tangent_y = normal.cross(tangent_x).normalized()
    crown_parts = [
        ((0.00, 0.00, 0.61), 0.30, "leaf"),
        ((-0.20, 0.01, 0.54), 0.23, "leaf_dark"),
        ((0.19, -0.02, 0.56), 0.24, "leaf"),
        ((0.02, 0.16, 0.68), 0.21, "leaf_light"),
        ((0.00, -0.13, 0.76), 0.19, "leaf_light"),
    ]
    for part_index, ((x, y, outward), radius, material_key) in enumerate(crown_parts, start=1):
        location = normal * (planet_radius + outward * scale) + tangent_x * x * scale + tangent_y * y * scale
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius * scale, location=location)
        crown = bpy.context.object
        crown.name = f"{name}_Crown_{part_index:02d}"
        crown.scale = (1.0, 0.88, 1.08)
        crown.rotation_euler = rotation
        assign_material(crown, materials[material_key])
        parent_to_asset(crown, root)


def look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def build_scene():
    """Build the authored farm planet and interaction anchors. Codex / GPT-5 / model ID unavailable."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    root = bpy.data.objects.new("FarmPlanet_Root", None)
    scene.collection.objects.link(root)

    materials = {
        "grass": create_material("Grass", (0.20, 0.72, 0.42), 1.0),
        "soil": create_material("Farm Soil", (0.58, 0.25, 0.14), 1.0),
        "water": create_material("River Water", (0.08, 0.52, 0.92), 0.75),
        "wood": create_material("Wood", (0.46, 0.19, 0.10), 1.0),
        "leaf": create_material("Tree Leaf", (0.08, 0.56, 0.30), 1.0),
        "leaf_dark": create_material("Tree Leaf Dark", (0.035, 0.36, 0.22), 1.0),
        "leaf_light": create_material("Tree Leaf Light", (0.24, 0.76, 0.39), 1.0),
    }

    planet_radius = 2.5
    bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=planet_radius, location=(0, 0, 0))
    planet = bpy.context.object
    planet.name = "Planet_Ground"
    bpy.ops.object.shade_smooth()
    assign_integrated_surface(planet, materials["grass"], materials["soil"], materials["water"])
    parent_to_asset(planet, root)

    planting_normals = [
        (-0.46, -0.36, 0.82), (-0.16, -0.46, 0.88), (0.16, -0.46, 0.88), (0.46, -0.36, 0.82),
        (-0.49, -0.64, 0.60), (-0.17, -0.72, 0.67), (0.17, -0.72, 0.67), (0.49, -0.64, 0.60),
    ]
    for index, normal in enumerate(planting_normals, start=1):
        normal_v = Vector(normal).normalized()
        anchor = bpy.data.objects.new(f"CropAnchor_{index:02d}", None)
        anchor.empty_display_type = "CIRCLE"
        anchor.empty_display_size = 0.12
        anchor.location = normal_v * (planet_radius + 0.025)
        anchor.rotation_euler = normal_v.to_track_quat("Z", "Y").to_euler()
        scene.collection.objects.link(anchor)
        parent_to_asset(anchor, root)

    tree_normals = [
        (-0.76, 0.46, 0.46), (0.74, 0.48, 0.48), (-0.90, -0.20, 0.38),
        (0.91, -0.18, 0.38), (-0.55, -0.72, 0.42), (0.58, -0.70, 0.42),
        (-0.45, 0.82, 0.34), (0.47, 0.82, 0.34),
    ]
    for index, normal in enumerate(tree_normals, start=1):
        add_tree(f"Tree_{index:02d}", normal, planet_radius, materials, root, 0.72 + 0.08 * (index % 3))

    root["assetType"] = "elya-farm-planet"
    root["plantingSurface"] = planet.name
    root["plantingSlotCount"] = len(planting_normals)
    return root


def render_preview(asset_root):
    """Render a deterministic preview of the GLB asset. Codex / GPT-5 / model ID unavailable."""
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Preview World") if not scene.world else scene.world
    scene.world = world
    world.color = (0.13, 0.20, 0.42)
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.16, 0.23, 0.48, 1.0)
    background.inputs["Strength"].default_value = 0.8

    bpy.ops.object.light_add(type="AREA", location=(5.0, -5.0, 7.0))
    key = bpy.context.object
    key.data.energy = 1250
    key.data.shape = "DISK"
    key.data.size = 5.0
    key.data.color = (1.0, 0.78, 0.55)
    look_at(key, (0, 0, 0.5))

    bpy.ops.object.light_add(type="AREA", location=(-5.0, -1.5, 4.0))
    fill = bpy.context.object
    fill.data.energy = 900
    fill.data.size = 4.0
    fill.data.color = (0.30, 0.55, 1.0)
    look_at(fill, (0, 0, 0.3))

    bpy.ops.object.light_add(type="AREA", location=(0, 4.5, 5.0))
    rim = bpy.context.object
    rim.data.energy = 1000
    rim.data.size = 3.0
    rim.data.color = (0.45, 1.0, 0.60)
    look_at(rim, (0, 0, 0.7))

    bpy.ops.object.camera_add(location=(7.1, -8.4, 6.4))
    camera = bpy.context.object
    camera.data.lens = 58
    look_at(camera, (0, 0, 0.45))
    scene.camera = camera

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.use_freestyle = True
    scene.render.line_thickness = 1.15
    freestyle = scene.view_layers[0].freestyle_settings
    line_set = freestyle.linesets[0]
    line_style = line_set.linestyle
    if line_style is None:
        line_style = bpy.data.linestyles.new("Anime Outline")
        line_set.linestyle = line_style
    line_style.color = (0.075, 0.045, 0.11)
    line_style.thickness = 1.15
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(ROOT / "preview.png")
    bpy.ops.render.render(write_still=True)

    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_DIR / "farm-planet.blend"))

    bpy.ops.object.select_all(action="DESELECT")
    asset_root.select_set(True)
    for child in asset_root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = asset_root
    bpy.ops.export_scene.gltf(
        filepath=str(ASSETS_DIR / "farm-planet.glb"),
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_apply=True,
        export_animations=False,
    )


asset = build_scene()
render_preview(asset)
print(f"FARM_PLANET_READY={ASSETS_DIR / 'farm-planet.glb'}")
