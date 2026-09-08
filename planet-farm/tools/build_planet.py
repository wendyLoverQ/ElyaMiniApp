import math
from pathlib import Path

import bpy
import numpy as np
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


def mix_color(base, overlay, amount):
    return tuple(base[index] * (1.0 - amount) + overlay[index] * amount for index in range(3))


def smooth_mask(signed_distance, feather):
    value = max(0.0, min(1.0, 0.5 - signed_distance / feather))
    return value * value * (3.0 - 2.0 * value)


def create_planet_surface_texture():
    """Rasterize a smooth field rectangle and river into one planet texture. Codex / GPT-5 / model ID unavailable."""
    width = 1024
    height = 512
    grass = (0.20, 0.72, 0.42)
    soil = (0.58, 0.25, 0.14)
    water = (0.08, 0.52, 0.92)
    farm_center = Vector((0.0, -0.48, 0.88)).normalized()
    farm_x = Vector((1.0, 0.0, 0.0))
    farm_y = farm_center.cross(farm_x).normalized()
    pixels = []

    for y in range(height):
        latitude = -math.pi * 0.5 + math.pi * (y + 0.5) / height
        cos_latitude = math.cos(latitude)
        for x in range(width):
            longitude = -math.pi + math.tau * (x + 0.5) / width
            direction = Vector((
                cos_latitude * math.cos(longitude),
                cos_latitude * math.sin(longitude),
                math.sin(latitude),
            ))

            local_x = direction.dot(farm_x)
            local_y = direction.dot(farm_y)
            corner_radius = 0.018
            qx = abs(local_x) - (0.36 - corner_radius)
            qy = abs(local_y) - (0.205 - corner_radius)
            field_distance = (
                math.sqrt(max(qx, 0.0) ** 2 + max(qy, 0.0) ** 2)
                + min(max(qx, qy), 0.0)
                - corner_radius
            )
            field_mask = smooth_mask(field_distance, 0.010) if direction.dot(farm_center) > 0.90 else 0.0

            river_center_x = 0.46 - 0.20 * (direction.z + 0.35) + 0.050 * math.sin(direction.z * 8.0)
            river_distance = abs(direction.x - river_center_x) - 0.014
            river_in_range = direction.y < -0.20 and -0.62 < direction.z < 0.63
            river_mask = smooth_mask(river_distance, 0.008) if river_in_range else 0.0

            color = mix_color(grass, soil, field_mask)
            color = mix_color(color, water, river_mask)
            pixels.extend((*color, 1.0))

    image = bpy.data.images.new("Planet Surface", width=width, height=height, alpha=True)
    image.pixels.foreach_set(np.asarray(pixels, dtype=np.float32))
    image.update()
    texture_path = SOURCE_DIR / "planet-surface.png"
    image.save_render(str(texture_path), scene=bpy.context.scene)
    bpy.data.images.remove(image)
    saved_image = bpy.data.images.load(str(texture_path), check_existing=False)
    saved_image.name = "Planet Surface"
    saved_image.colorspace_settings.name = "sRGB"
    saved_image.pack()
    return saved_image


def create_planet_material(surface_image):
    """Create the export-safe textured planet material. Codex / GPT-5 / model ID unavailable."""
    material = bpy.data.materials.new("Planet Surface Material")
    material.diffuse_color = (0.20, 0.72, 0.42, 1.0)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = surface_image
    texture.interpolation = "Linear"
    principled.inputs["Roughness"].default_value = 0.92
    principled.inputs["Specular IOR Level"].default_value = 0.18
    links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    return material


def add_tapered_segment(name, start, end, base_radius, tip_radius, material, root):
    direction = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cone_add(
        vertices=12,
        radius1=base_radius,
        radius2=tip_radius,
        depth=direction.length,
        location=(Vector(start) + Vector(end)) * 0.5,
        rotation=direction.to_track_quat("Z", "Y").to_euler(),
    )
    segment = bpy.context.object
    segment.name = name
    assign_material(segment, material)
    return parent_to_asset(segment, root)


def add_tree(name, normal, planet_radius, materials, root, scale=1.0):
    """Build an anime tree with a trunk, branches, and coherent crown. Codex / GPT-5 / model ID unavailable."""
    normal = Vector(normal).normalized()
    tangent_x = Vector((0, 0, 1)).cross(normal)
    if tangent_x.length < 0.001:
        tangent_x = Vector((1, 0, 0))
    tangent_x.normalize()
    tangent_y = normal.cross(tangent_x).normalized()
    trunk_start = normal * (planet_radius - 0.01)
    trunk_end = normal * (planet_radius + 0.60 * scale)
    add_tapered_segment(
        f"{name}_Trunk", trunk_start, trunk_end,
        0.105 * scale, 0.060 * scale, materials["wood"], root,
    )
    branch_origin = normal * (planet_radius + 0.35 * scale)
    add_tapered_segment(
        f"{name}_Branch_Left", branch_origin,
        normal * (planet_radius + 0.56 * scale) - tangent_x * 0.25 * scale,
        0.050 * scale, 0.022 * scale, materials["wood"], root,
    )
    add_tapered_segment(
        f"{name}_Branch_Right", branch_origin + normal * 0.05 * scale,
        normal * (planet_radius + 0.59 * scale) + tangent_x * 0.26 * scale,
        0.048 * scale, 0.020 * scale, materials["wood"], root,
    )

    rotation = normal.to_track_quat("Z", "Y").to_euler()
    crown_parts = [
        ((-0.20, 0.00, 0.66), (0.34, 0.29, 0.26), "leaf_dark"),
        ((0.20, -0.01, 0.68), (0.35, 0.30, 0.27), "leaf"),
        ((0.00, 0.05, 0.84), (0.38, 0.32, 0.30), "leaf_light"),
    ]
    for part_index, ((x, y, outward), dimensions, material_key) in enumerate(crown_parts, start=1):
        location = normal * (planet_radius + outward * scale) + tangent_x * x * scale + tangent_y * y * scale
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=1.0, location=location)
        crown = bpy.context.object
        crown.name = f"{name}_Crown_{part_index:02d}"
        crown.scale = tuple(dimension * scale for dimension in dimensions)
        crown.rotation_euler = rotation
        bpy.ops.object.shade_smooth()
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
        "wood": create_material("Wood", (0.46, 0.19, 0.10), 1.0),
        "leaf": create_material("Tree Leaf", (0.08, 0.56, 0.30), 1.0),
        "leaf_dark": create_material("Tree Leaf Dark", (0.035, 0.36, 0.22), 1.0),
        "leaf_light": create_material("Tree Leaf Light", (0.18, 0.68, 0.32), 1.0),
    }
    surface_image = create_planet_surface_texture()
    planet_material = create_planet_material(surface_image)

    planet_radius = 2.5
    bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=planet_radius, location=(0, 0, 0))
    planet = bpy.context.object
    planet.name = "Planet_Ground"
    bpy.ops.object.shade_smooth()
    assign_material(planet, planet_material)
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
        (-0.82, 0.42, 0.40), (0.78, 0.50, 0.37), (-0.90, -0.12, 0.32),
        (0.88, 0.18, 0.43), (-0.55, 0.76, 0.34), (0.45, 0.83, 0.33),
    ]
    for index, normal in enumerate(tree_normals, start=1):
        add_tree(f"Tree_{index:02d}", normal, planet_radius, materials, root, 0.72 + 0.08 * (index % 3))

    root["assetType"] = "elya-farm-planet"
    root["plantingSurface"] = planet.name
    root["plantingSlotCount"] = len(planting_normals)
    root["surfaceTexture"] = surface_image.name
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
