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


def bevel(obj, width=0.05, segments=3):
    modifier = obj.modifiers.new("Soft bevel", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def add_cube(name, location, scale, material, root, bevel_width=0.04):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel_width:
        bevel(obj, bevel_width)
    assign_material(obj, material)
    return parent_to_asset(obj, root)


def add_tree(name, normal, planet_radius, materials, root, scale=1.0):
    """Place a stylized tree upright to the planet surface. Codex / GPT-5 / model ID unavailable."""
    normal = Vector(normal).normalized()
    rotation = normal.to_track_quat("Z", "Y").to_euler()

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=10,
        radius=0.09 * scale,
        depth=0.48 * scale,
        location=normal * (planet_radius + 0.20 * scale),
        rotation=rotation,
    )
    trunk = bpy.context.object
    trunk.name = f"{name}_Trunk"
    assign_material(trunk, materials["wood"])
    parent_to_asset(trunk, root)

    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=2,
        radius=0.32 * scale,
        location=normal * (planet_radius + 0.55 * scale),
    )
    crown = bpy.context.object
    crown.name = f"{name}_Crown"
    crown.scale = (0.9, 0.9, 1.2)
    crown.rotation_euler = rotation
    assign_material(crown, materials["leaf"])
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
        "grass_light": create_material("Grass Light", (0.48, 0.88, 0.42), 1.0),
        "soil": create_material("Farm Soil", (0.58, 0.25, 0.14), 1.0),
        "furrow": create_material("Soil Furrow", (0.34, 0.10, 0.07), 1.0),
        "water": create_material("Pond Water", (0.12, 0.62, 0.96), 0.72),
        "stone": create_material("Stone", (0.48, 0.53, 0.68), 1.0),
        "wood": create_material("Wood", (0.46, 0.19, 0.10), 1.0),
        "leaf": create_material("Tree Leaf", (0.08, 0.56, 0.30), 1.0),
        "wall": create_material("Farmhouse Wall", (1.00, 0.84, 0.57), 1.0),
        "roof": create_material("Farmhouse Roof", (0.96, 0.24, 0.30), 1.0),
        "cream": create_material("Windmill Cream", (1.00, 0.95, 0.76), 1.0),
        "cloud": create_material("Cloud", (0.95, 0.98, 1.0), 1.0),
    }

    planet_radius = 2.5
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=planet_radius, location=(0, 0, 0))
    planet = bpy.context.object
    planet.name = "Planet_Ground"
    assign_material(planet, materials["grass"])
    parent_to_asset(planet, root)

    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1.43, depth=0.18, location=(0, 0, 2.47))
    plateau = bpy.context.object
    plateau.name = "Farm_Plateau"
    assign_material(plateau, materials["grass_light"])
    bevel(plateau, 0.08, 4)
    parent_to_asset(plateau, root)

    plot_positions = [
        (-0.72, -0.48), (-0.24, -0.48), (0.24, -0.48), (0.72, -0.48),
        (-0.72, 0.02), (-0.24, 0.02), (0.24, 0.02), (0.72, 0.02),
    ]
    for index, (x, y) in enumerate(plot_positions, start=1):
        plot = add_cube(
            f"Plot_{index:02d}",
            (x, y, 2.605),
            (0.205, 0.19, 0.045),
            materials["soil"],
            root,
            0.035,
        )
        for furrow_index in (-1, 0, 1):
            add_cube(
                f"Plot_{index:02d}_Furrow_{furrow_index + 2}",
                (x + furrow_index * 0.09, y, 2.66),
                (0.018, 0.145, 0.012),
                materials["furrow"],
                root,
                0.006,
            )
        anchor = bpy.data.objects.new(f"CropAnchor_{index:02d}", None)
        anchor.empty_display_type = "CIRCLE"
        anchor.empty_display_size = 0.12
        anchor.location = (x, y, 2.70)
        scene.collection.objects.link(anchor)
        parent_to_asset(anchor, root)
        plot["cropAnchor"] = anchor.name

    house = add_cube("Farmhouse_Body", (-0.73, 0.76, 2.86), (0.40, 0.34, 0.32), materials["wall"], root, 0.055)
    house.rotation_euler.z = math.radians(-8)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.62, radius2=0.0, depth=0.46, location=(-0.73, 0.76, 3.37), rotation=(0, 0, math.radians(45 - 8)))
    roof = bpy.context.object
    roof.name = "Farmhouse_Roof"
    roof.scale.y = 0.82
    assign_material(roof, materials["roof"])
    parent_to_asset(roof, root)
    add_cube("Farmhouse_Door", (-0.73, 0.405, 2.80), (0.105, 0.026, 0.20), materials["wood"], root, 0.018)

    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.16, depth=0.78, location=(0.83, 0.83, 2.91))
    tower = bpy.context.object
    tower.name = "Windmill_Tower"
    tower.scale = (1.0, 1.0, 1.18)
    assign_material(tower, materials["cream"])
    parent_to_asset(tower, root)
    add_cube("Windmill_Hub", (0.83, 0.65, 3.35), (0.10, 0.08, 0.10), materials["wood"], root, 0.02)
    for angle in (0, 90):
        blade = add_cube(
            f"Windmill_Blade_{angle}",
            (0.83, 0.54, 3.35),
            (0.055, 0.025, 0.39),
            materials["wood"],
            root,
            0.018,
        )
        blade.rotation_euler.y = math.radians(angle)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, location=(1.45, -0.30, 2.22))
    pond = bpy.context.object
    pond.name = "Pond"
    pond.scale = (0.58, 0.42, 0.07)
    assign_material(pond, materials["water"])
    parent_to_asset(pond, root)

    tree_normals = [
        (-0.76, 0.46, 0.46), (0.74, 0.48, 0.48), (-0.90, -0.20, 0.38),
        (0.91, -0.18, 0.38), (-0.55, -0.72, 0.42), (0.58, -0.70, 0.42),
        (-0.45, 0.82, 0.34), (0.47, 0.82, 0.34),
    ]
    for index, normal in enumerate(tree_normals, start=1):
        add_tree(f"Tree_{index:02d}", normal, planet_radius, materials, root, 0.72 + 0.08 * (index % 3))

    rock_normals = [(-0.15, -0.92, 0.36), (0.22, -0.95, 0.30), (-0.92, 0.08, -0.38), (0.86, 0.18, -0.48)]
    for index, normal in enumerate(rock_normals, start=1):
        normal_v = Vector(normal).normalized()
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.18, location=normal_v * 2.58)
        rock = bpy.context.object
        rock.name = f"Rock_{index:02d}"
        rock.scale = (1.2, 0.8, 0.75)
        assign_material(rock, materials["stone"])
        parent_to_asset(rock, root)

    for cloud_index, (location, scale) in enumerate([
        ((-3.0, 0.6, 2.7), 0.50), ((2.9, 0.9, 1.9), 0.42), ((0.7, 2.9, 2.4), 0.34)
    ], start=1):
        cloud_root = bpy.data.objects.new(f"Cloud_{cloud_index:02d}", None)
        cloud_root.location = location
        scene.collection.objects.link(cloud_root)
        parent_to_asset(cloud_root, root)
        for puff_index, offset in enumerate(((-0.32, 0, 0), (0, 0, 0.12), (0.32, 0, -0.02))):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=scale, location=Vector(location) + Vector(offset) * scale * 1.8)
            puff = bpy.context.object
            puff.name = f"Cloud_{cloud_index:02d}_Puff_{puff_index + 1}"
            puff.scale = (1.25, 0.65, 0.72)
            assign_material(puff, materials["cloud"])
            puff.parent = cloud_root

    root["assetType"] = "elya-farm-planet"
    root["plotCount"] = len(plot_positions)
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
