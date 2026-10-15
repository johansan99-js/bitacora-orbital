# Retratos fotorrealistas de cada astro con Blender (Cycles) y texturas reales.
# Uso: python render_planets.py <carpeta_texturas_raw> <carpeta_salida> [ids...]
import math
import os
import sys

import bpy

RAW, OUT = sys.argv[1], sys.argv[2]
ONLY = set(sys.argv[3:])
os.makedirs(OUT, exist_ok=True)

# id: textura, relieve, inclinación del eje (°), extras
BODIES = {
    "sol": dict(tex="sunmap.jpg", emit=True),
    "mercurio": dict(tex="mercurymap.jpg", bump="mercurybump.jpg", rough=0.95, sat=0.2),
    "venus": dict(venus=True, tilt=3),
    "tierra": dict(earth=True, tilt=23.4),
    "luna": dict(tex="moon_1024.jpg", rough=0.95),
    "marte": dict(tex="marsmap1k.jpg", bump="marsbump1k.jpg", tilt=25.2, atmo=(0.85, 0.55, 0.4), atmo_k=0.25),
    "jupiter": dict(tex="jupitermap.jpg", tilt=3.1, rough=0.8),
    "saturno": dict(tex="saturnmap.jpg", tilt=26.7, rings=True, rough=0.8),
    "urano": dict(tex="uranusmap.jpg", tilt=97.8, atmo=(0.6, 0.9, 1.0), atmo_k=0.5, rough=0.7),
    "neptuno": dict(tex="neptunemap.jpg", tilt=28.3, atmo=(0.35, 0.5, 1.0), atmo_k=0.5, rough=0.7),
    "pluton": dict(tex="plutomap1k.jpg", bump="plutobump1k.jpg", rough=0.95),
}


def img(name, non_color=False):
    im = bpy.data.images.load(os.path.join(RAW, name), check_existing=True)
    if non_color:
        im.colorspace_settings.name = "Non-Color"
    return im


def sphere(name, r=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=160, ring_count=80, radius=r)
    ob = bpy.context.active_object
    ob.name = name
    bpy.ops.object.shade_smooth()
    return ob


def tex_node(nt, image, x=-600, y=0):
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = image
    n.location = (x, y)
    n.interpolation = "Cubic"
    return n


def atmosphere(r, color, k):
    """Capa fina con brillo en el borde (efecto Fresnel), como la luz dispersada por un gas."""
    ob = sphere("atmo", r)
    mat = bpy.data.materials.new("atmo")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.35
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 2.2
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = k
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    # el borde solo brilla en el lado iluminado: se multiplica por la luz que recibe (geometría · dirección del Sol)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = SUN_DIR
    clamp = nt.nodes.new("ShaderNodeMath")
    clamp.operation = "ADD"
    clamp.inputs[1].default_value = 0.35
    clamp.use_clamp = True
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.use_clamp = True
    nt.links.new(lw.outputs["Facing"], pw.inputs[0])
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    nt.links.new(dot.outputs["Value"], clamp.inputs[0])
    nt.links.new(pw.outputs[0], mul.inputs[0])
    nt.links.new(clamp.outputs[0], mul.inputs[1])
    nt.links.new(mul.outputs[0], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    ob.data.materials.append(mat)
    return ob


def planet_material(cfg):
    mat = bpy.data.materials.new("superficie")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = cfg.get("rough", 0.85)
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.2
    if cfg.get("venus"):
        # Venus se ve como un mar de nubes amarillentas: bandas suaves deformadas por ruido
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.bands_direction = "Z"
        wave.inputs["Scale"].default_value = 1.6
        wave.inputs["Distortion"].default_value = 9.0
        wave.inputs["Detail"].default_value = 6.0
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (0.78, 0.62, 0.38, 1)
        ramp.color_ramp.elements[1].color = (0.98, 0.9, 0.7, 1)
        nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.9
        return mat
    t = tex_node(nt, img(cfg["tex"]))
    if "sat" in cfg:  # Mercurio es gris: se le quita casi todo el color al mapa
        hs = nt.nodes.new("ShaderNodeHueSaturation")
        hs.inputs["Saturation"].default_value = cfg["sat"]
        nt.links.new(t.outputs["Color"], hs.inputs["Color"])
        nt.links.new(hs.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    if cfg.get("bump"):
        b = tex_node(nt, img(cfg["bump"], True), -600, -300)
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.35
        nt.links.new(b.outputs["Color"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def earth():
    ob = sphere("tierra")
    mat = bpy.data.materials.new("tierra")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    day = tex_node(nt, img("earth_atmos_2048.jpg"))
    spec = tex_node(nt, img("earth_specular_2048.jpg", True), -600, -300)
    nrm = tex_node(nt, img("earth_normal_2048.jpg", True), -600, -600)
    nt.links.new(day.outputs["Color"], bsdf.inputs["Base Color"])
    # océanos lisos (reflejan el Sol) y continentes ásperos
    inv = nt.nodes.new("ShaderNodeMapRange")
    inv.inputs["To Min"].default_value = 0.92
    inv.inputs["To Max"].default_value = 0.28
    nt.links.new(spec.outputs["Color"], inv.inputs["Value"])
    nt.links.new(inv.outputs["Result"], bsdf.inputs["Roughness"])
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.6
    nt.links.new(nrm.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    # luces de ciudades en el lado nocturno
    lights = tex_node(nt, img("earth_lights_2048.png"), -600, -900)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = SUN_DIR
    night = nt.nodes.new("ShaderNodeMapRange")
    night.inputs["From Min"].default_value = 0.05
    night.inputs["From Max"].default_value = -0.2
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    nt.links.new(dot.outputs["Value"], night.inputs["Value"])
    em_strength = nt.nodes.new("ShaderNodeMath")
    em_strength.operation = "MULTIPLY"
    em_strength.inputs[1].default_value = 2.5
    nt.links.new(night.outputs["Result"], em_strength.inputs[0])
    nt.links.new(lights.outputs["Color"], bsdf.inputs["Emission Color"])
    nt.links.new(em_strength.outputs[0], bsdf.inputs["Emission Strength"])
    ob.data.materials.append(mat)
    # nubes
    cl = sphere("nubes", 1.008)
    cm = bpy.data.materials.new("nubes")
    cm.use_nodes = True
    cnt = cm.node_tree
    cnt.nodes.clear()
    out = cnt.nodes.new("ShaderNodeOutputMaterial")
    ct = tex_node(cnt, img("earth_clouds_1024.png"))
    diff = cnt.nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1, 1, 1, 1)
    tr = cnt.nodes.new("ShaderNodeBsdfTransparent")
    mix = cnt.nodes.new("ShaderNodeMixShader")
    cnt.links.new(ct.outputs["Alpha"], mix.inputs[0])
    cnt.links.new(tr.outputs[0], mix.inputs[1])
    cnt.links.new(diff.outputs[0], mix.inputs[2])
    cnt.links.new(mix.outputs[0], out.inputs["Surface"])
    cl.data.materials.append(cm)
    atmosphere(1.025, (0.35, 0.6, 1.0), 1.0)
    return ob


def rings(r_in, r_out):
    """Anillo plano con UV radial: u = 0 en el borde interior, 1 en el exterior."""
    import bmesh
    me = bpy.data.meshes.new("anillos")
    bm = bmesh.new()
    seg = 256
    uv = bm.loops.layers.uv.new()
    vin = [bm.verts.new((r_in * math.cos(a), r_in * math.sin(a), 0)) for a in (2 * math.pi * i / seg for i in range(seg))]
    vout = [bm.verts.new((r_out * math.cos(a), r_out * math.sin(a), 0)) for a in (2 * math.pi * i / seg for i in range(seg))]
    for i in range(seg):
        j = (i + 1) % seg
        f = bm.faces.new((vin[i], vout[i], vout[j], vin[j]))
        for loop in f.loops:
            loop[uv].uv = (0.0 if loop.vert in vin else 1.0, 0.5)
    bm.to_mesh(me)
    ob = bpy.data.objects.new("anillos", me)
    bpy.context.collection.objects.link(ob)
    mat = bpy.data.materials.new("anillos")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    col = tex_node(nt, img("saturnringcolor.jpg"))
    pat = tex_node(nt, img("saturnringpattern.gif", True), -600, -300)
    for n in (col, pat):
        n.extension = "EXTEND"
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    boost = nt.nodes.new("ShaderNodeMath")  # el hielo de los anillos refleja mucha luz
    gain = nt.nodes.new("ShaderNodeMix")
    gain.data_type = "RGBA"
    gain.blend_type = "MULTIPLY"
    gain.inputs[0].default_value = 1.0
    gain.inputs[7].default_value = (1.75, 1.62, 1.45, 1)
    nt.nodes.remove(boost)
    nt.links.new(col.outputs["Color"], gain.inputs[6])
    nt.links.new(gain.outputs[2], diff.inputs["Color"])
    nt.links.new(pat.outputs["Color"], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(diff.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    ob.data.materials.append(mat)
    return ob


def render(bid, cfg):
    global SUN_DIR
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.resolution_x = sc.render.resolution_y = 720
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    sc.view_settings.look = "AgX - Medium High Contrast" if sc.view_settings.view_transform == "AgX" else "None"
    world = bpy.data.worlds.new("espacio")
    world.color = (0, 0, 0)
    sc.world = world

    # luz del Sol desde la izquierda y un poco por delante: se ve el terminador día/noche
    from mathutils import Vector
    SUN_DIR = tuple(Vector((-0.78, -0.55, 0.22)).normalized())  # hacia el Sol: izquierda, hacia la cámara y un poco arriba

    if cfg.get("earth"):
        root = earth()
    else:
        root = sphere(bid)
        if cfg.get("emit"):
            mat = bpy.data.materials.new("sol")
            mat.use_nodes = True
            nt = mat.node_tree
            nt.nodes.clear()
            out = nt.nodes.new("ShaderNodeOutputMaterial")
            em = nt.nodes.new("ShaderNodeEmission")
            em.inputs["Strength"].default_value = 1.6
            t = tex_node(nt, img(cfg["tex"]))
            # oscurecimiento del limbo: el borde del Sol se ve más oscuro y rojizo que el centro
            lw = nt.nodes.new("ShaderNodeLayerWeight")
            lw.inputs["Blend"].default_value = 0.5
            limb = nt.nodes.new("ShaderNodeMix")
            limb.data_type = "RGBA"
            limb.blend_type = "MULTIPLY"
            limb.inputs[7].default_value = (0.55, 0.22, 0.06, 1)
            nt.links.new(lw.outputs["Facing"], limb.inputs[0])
            nt.links.new(t.outputs["Color"], limb.inputs[6])
            nt.links.new(limb.outputs[2], em.inputs["Color"])
            nt.links.new(em.outputs[0], out.inputs["Surface"])
            root.data.materials.append(mat)
        else:
            root.data.materials.append(planet_material(cfg))
        if cfg.get("atmo"):
            atmosphere(1.02, cfg["atmo"], cfg.get("atmo_k", 0.4))
    if cfg.get("rings"):
        rings(1.24, 2.27)

    # inclinación del eje: todo gira alrededor del eje X (hacia la cámara)
    tilt = math.radians(cfg.get("tilt", 0))
    for ob in list(bpy.context.scene.objects):
        if ob.type == "MESH":
            if cfg.get("rings"):
                # el polo norte se inclina hacia la cámara: los anillos se ven abiertos, como en las fotos clásicas
                ob.rotation_euler = (tilt, math.radians(-14), math.radians(-100) if ob.name != "anillos" else 0)
            else:
                ob.rotation_euler = (0, tilt, math.radians(-100))

    if not cfg.get("emit"):
        bpy.ops.object.light_add(type="SUN")
        sun = bpy.context.active_object
        sun.data.energy = 4.2
        sun.data.angle = math.radians(0.53)
        # apuntar la luz en dirección contraria a SUN_DIR
        from mathutils import Vector
        sun.rotation_euler = (-Vector(SUN_DIR)).to_track_quat("-Z", "Y").to_euler()

    # cámara algo por encima del ecuador para ver los anillos
    bpy.ops.object.camera_add()
    cam = bpy.context.active_object
    sc.camera = cam
    cam.data.lens = 85
    dist = 12.5 if cfg.get("rings") else 6.4
    elev = math.radians(14 if cfg.get("rings") else 6)
    cam.location = (0, -dist * math.cos(elev), dist * math.sin(elev))
    from mathutils import Vector
    cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()

    sc.render.filepath = os.path.join(OUT, f"{bid}.png")
    bpy.ops.render.render(write_still=True)
    print("render listo:", bid, flush=True)


SUN_DIR = (1, 0, 0)
for bid, cfg in BODIES.items():
    if not ONLY or bid in ONLY:
        render(bid, cfg)
