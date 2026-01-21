obs = obslua

-- Intentar cargar FFI para captura de mouse
local ffi_available = false
local ffi = nil

pcall(function()
    ffi = require("ffi")
    ffi_available = true
end)

-- Declaraciones FFI según sistema operativo
if ffi_available then
    if ffi.os == "Windows" then
        ffi.cdef[[
            typedef struct { long x; long y; } POINT;
            int GetCursorPos(POINT* lpPoint);
        ]]
    elseif ffi.os == "Linux" then
        ffi.cdef[[
            typedef unsigned long Window;
            typedef struct _XDisplay Display;
            Display* XOpenDisplay(const char* display_name);
            int XCloseDisplay(Display* display);
            int XQueryPointer(Display* display, Window w, Window* root_return,
                              Window* child_return, int* root_x_return, int* root_y_return,
                              int* win_x_return, int* win_y_return, unsigned int* mask_return);
        ]]
    elseif ffi.os == "OSX" then
        ffi.cdef[[
            typedef struct { double x; double y; } CGPoint;
            void* CGEventCreate(void* source);
            CGPoint CGEventGetLocation(void* event);
            void CFRelease(void* cf);
        ]]
    end
end

-- Variables globales
source_name = ""
zoom_level = 2.0
smoothness = 0.15
enabled = false
scene_item = nil

-- Variables de estado
current_x = 0
current_y = 0
target_x = 0
target_y = 0

-- Variables para guardar transformación original
original_transform = nil
original_bounds = nil

-- Timer de actualización
timer_active = false

-- Función para obtener posición del mouse
function get_mouse_position()
    if not ffi_available then
        return nil, nil
    end
    
    if ffi.os == "Windows" then
        local point = ffi.new("POINT")
        if ffi.C.GetCursorPos(point) ~= 0 then
            return tonumber(point.x), tonumber(point.y)
        end
    elseif ffi.os == "Linux" then
        local display = ffi.C.XOpenDisplay(nil)
        if display ~= nil then
            local root_x = ffi.new("int[1]")
            local root_y = ffi.new("int[1]")
            local win_x = ffi.new("int[1]")
            local win_y = ffi.new("int[1]")
            local root_return = ffi.new("Window[1]")
            local child_return = ffi.new("Window[1]")
            local mask_return = ffi.new("unsigned int[1]")
            
            if ffi.C.XQueryPointer(display, 0, root_return, child_return,
                                   root_x, root_y, win_x, win_y, mask_return) ~= 0 then
                local x = tonumber(root_x[0])
                local y = tonumber(root_y[0])
                ffi.C.XCloseDisplay(display)
                return x, y
            end
            ffi.C.XCloseDisplay(display)
        end
    elseif ffi.os == "OSX" then
        local event = ffi.C.CGEventCreate(nil)
        if event ~= nil then
            local location = ffi.C.CGEventGetLocation(event)
            ffi.C.CFRelease(event)
            return tonumber(location.x), tonumber(location.y)
        end
    end
    
    return nil, nil
end

-- Función para obtener el scene item de la fuente
function get_scene_item()
    local current_scene = obs.obs_frontend_get_current_scene()
    if current_scene == nil then
        return nil
    end
    
    local scene = obs.obs_scene_from_source(current_scene)
    obs.obs_source_release(current_scene)
    
    if scene == nil then
        return nil
    end
    
    local item = obs.obs_scene_find_source(scene, source_name)
    return item
end

-- Función para interpolar linealmente (Lerp)
function lerp(start, target, alpha)
    return start + (target - start) * alpha
end

-- Función principal de actualización
function update_zoom()
    if not enabled then
        return
    end

    if source_name == "" then
        return
    end

    -- Obtener el scene item
    local item = get_scene_item()
    if item == nil then
        return
    end

    -- Obtener la fuente
    local source = obs.obs_sceneitem_get_source(item)
    if source == nil then
        return
    end

    -- Obtener dimensiones de la fuente
    local width = obs.obs_source_get_width(source)
    local height = obs.obs_source_get_height(source)

    if width == 0 or height == 0 then
        return
    end

    -- Obtener posición del mouse
    local mouse_x, mouse_y = get_mouse_position()
    
    if mouse_x == nil or mouse_y == nil then
        return
    end

    -- Calcular el área visible (viewport) según el nivel de zoom
    local viewport_width = width / zoom_level
    local viewport_height = height / zoom_level

    -- Calcular posición objetivo (centrar mouse en el viewport)
    target_x = mouse_x - viewport_width / 2
    target_y = mouse_y - viewport_height / 2

    -- Limitar a los bordes de la fuente
    target_x = math.max(0, math.min(target_x, width - viewport_width))
    target_y = math.max(0, math.min(target_y, height - viewport_height))

    -- Aplicar suavizado (Lerp)
    current_x = lerp(current_x, target_x, smoothness)
    current_y = lerp(current_y, target_y, smoothness)

    -- Obtener la estructura de crop actual
    local crop = obs.obs_sceneitem_crop()
    obs.obs_sceneitem_get_crop(item, crop)
    
    -- Modificar los valores
    crop.left = math.floor(current_x)
    crop.top = math.floor(current_y)
    crop.right = math.floor(width - current_x - viewport_width)
    crop.bottom = math.floor(height - current_y - viewport_height)
    
    -- Aplicar crop al scene item
    obs.obs_sceneitem_set_crop(item, crop)
end

-- Función para resetear la fuente a su estado normal
function reset_source()
    if source_name == "" then
        return
    end
    
    local item = get_scene_item()
    if item == nil then
        return
    end

    -- Obtener y resetear crop
    local crop = obs.obs_sceneitem_crop()
    crop.left = 0
    crop.top = 0
    crop.right = 0
    crop.bottom = 0
    obs.obs_sceneitem_set_crop(item, crop)
end

-- Callback del timer (con manejo de errores)
function timer_callback()
    local status, err = pcall(update_zoom)
    if not status then
        obs.script_log(obs.LOG_ERROR, "Error en update_zoom: " .. tostring(err))
        enabled = false
        stop_timer()
        reset_source()
    end
end

-- Iniciar el timer
function start_timer()
    if not timer_active then
        obs.timer_add(timer_callback, 16) -- ~60 FPS
        timer_active = true
    end
end

-- Detener el timer
function stop_timer()
    if timer_active then
        obs.timer_remove(timer_callback)
        timer_active = false
    end
end

-- Toggle para activar/desactivar
function toggle_zoom()
    if not ffi_available then
        obs.script_log(obs.LOG_WARNING, "FFI no disponible. No se puede capturar posición del mouse.")
        return
    end
    
    enabled = not enabled
    
    if enabled then
        if source_name == "" then
            obs.script_log(obs.LOG_WARNING, "No hay fuente seleccionada")
            enabled = false
            return
        end
        
        -- Verificar que la fuente existe
        local source = obs.obs_get_source_by_name(source_name)
        if source == nil then
            obs.script_log(obs.LOG_WARNING, "No se encontró la fuente: " .. source_name)
            enabled = false
            return
        end
        
        local width = obs.obs_source_get_width(source)
        local height = obs.obs_source_get_height(source)
        local id = obs.obs_source_get_id(source)
        
        obs.script_log(obs.LOG_INFO, string.format("Fuente seleccionada: '%s' | Tipo: %s | Dimensiones: %dx%d", 
            source_name, id, width, height))
        
        obs.obs_source_release(source)
        
        if width == 0 or height == 0 then
            obs.script_log(obs.LOG_ERROR, "La fuente tiene dimensiones inválidas (0x0)")
            obs.script_log(obs.LOG_ERROR, "Posibles causas:")
            obs.script_log(obs.LOG_ERROR, "1. No es una fuente de tipo Display Capture")
            obs.script_log(obs.LOG_ERROR, "2. La fuente no está configurada correctamente")
            obs.script_log(obs.LOG_ERROR, "3. Necesitas esperar unos segundos después de crear la fuente")
            enabled = false
            return
        end
        
        -- Inicializar posición actual con el centro de la pantalla
        current_x = width / 2
        current_y = height / 2
        
        obs.script_log(obs.LOG_INFO, "✓ Zoom activado correctamente en: " .. source_name)
        start_timer()
    else
        obs.script_log(obs.LOG_INFO, "Zoom desactivado")
        stop_timer()
        reset_source()
    end
end

-- Hotkey callback
function toggle_hotkey(pressed)
    if pressed then
        toggle_zoom()
    end
end

-- Descripción del script
function script_description()
    local desc = [[<h2>Lupa con Seguimiento de Mouse</h2>
<p>Este script permite hacer zoom y seguir el cursor del mouse en una fuente de captura de pantalla.</p>
<ul>
<li><b>Fuente:</b> Selecciona la fuente a la que aplicar el efecto (Display Capture recomendado)</li>
<li><b>Nivel de Zoom:</b> Ajusta qué tan cerca es el zoom (1x-4x)</li>
<li><b>Suavizado:</b> Controla la suavidad del movimiento (0.05-0.5)</li>
<li><b>Activar:</b> Marca para activar el seguimiento</li>
</ul>
<p>También puedes usar el Hotkey configurado para activar/desactivar rápidamente.</p>
<p><b>Requisitos:</b> La fuente debe estar presente en la escena actual.</p>]]
    
    if ffi_available then
        desc = desc .. "<p><b>Estado:</b> FFI disponible - Captura de mouse funcionando ✓</p>"
    else
        desc = desc .. "<p><b>Advertencia:</b> FFI no disponible - Este script requiere FFI para funcionar</p>"
    end
    
    return desc
end

-- Propiedades del script
function script_properties()
    local props = obs.obs_properties_create()

    -- Lista de fuentes
    local source_list = obs.obs_properties_add_list(props, "source", "Fuente a Aplicar Zoom",
        obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    
    -- Obtener todas las fuentes disponibles y mostrar información
    local sources = obs.obs_enum_sources()
    if sources ~= nil then
        obs.script_log(obs.LOG_INFO, "=== Fuentes Disponibles ===")
        for _, source in ipairs(sources) do
            local name = obs.obs_source_get_name(source)
            local id = obs.obs_source_get_id(source)
            local width = obs.obs_source_get_width(source)
            local height = obs.obs_source_get_height(source)
            
            obs.script_log(obs.LOG_INFO, string.format("Fuente: '%s' | Tipo: %s | Dimensiones: %dx%d", 
                name, id, width, height))
            
            -- Solo agregar fuentes con dimensiones válidas o fuentes de captura de pantalla
            if width > 0 and height > 0 then
                -- El primer parámetro es lo que ve el usuario, el segundo es el valor que se guarda
                obs.obs_property_list_add_string(source_list, 
                    string.format("%s (%dx%d)", name, width, height), name)
            elseif id == "monitor_capture" or id == "xcomposite_input" or id == "display_capture" then
                obs.obs_property_list_add_string(source_list, 
                    string.format("%s [Sin configurar]", name), name)
            end
        end
        obs.script_log(obs.LOG_INFO, "===========================")
    end
    obs.source_list_release(sources)

    -- Nivel de zoom
    obs.obs_properties_add_float_slider(props, "zoom", "Nivel de Zoom", 1.0, 4.0, 0.1)

    -- Suavizado
    obs.obs_properties_add_float_slider(props, "smooth", "Suavizado (menor = más fluido)", 0.05, 0.5, 0.01)

    -- Checkbox para activar/desactivar
    obs.obs_properties_add_bool(props, "enable", "Activar Seguimiento")

    return props
end

-- Valores por defecto
function script_defaults(settings)
    obs.obs_data_set_default_double(settings, "zoom", 2.0)
    obs.obs_data_set_default_double(settings, "smooth", 0.15)
    obs.obs_data_set_default_bool(settings, "enable", false)
end

-- Actualizar configuración
function script_update(settings)
    source_name = obs.obs_data_get_string(settings, "source")
    zoom_level = obs.obs_data_get_double(settings, "zoom")
    smoothness = obs.obs_data_get_double(settings, "smooth")
    local new_enabled = obs.obs_data_get_bool(settings, "enable")

    -- Si cambió el estado de activación
    if new_enabled ~= enabled then
        toggle_zoom()
    end
end

-- Cargar script
function script_load(settings)
    obs.script_log(obs.LOG_INFO, "Script de zoom cargado")
    if ffi_available then
        obs.script_log(obs.LOG_INFO, "FFI disponible - Sistema: " .. ffi.os)
    else
        obs.script_log(obs.LOG_WARNING, "FFI no disponible - El script no funcionará")
    end
    
    -- Registrar hotkey
    local hotkey_id = obs.obs_hotkey_register_frontend("mouse_zoom_toggle", 
        "Activar/Desactivar Lupa de Mouse", toggle_hotkey)
    
    local hotkey_save_array = obs.obs_data_get_array(settings, "mouse_zoom_toggle")
    obs.obs_hotkey_load(hotkey_id, hotkey_save_array)
    obs.obs_data_array_release(hotkey_save_array)
end

-- Guardar script
function script_save(settings)
    local hotkey_save_array = obs.obs_hotkey_save("mouse_zoom_toggle")
    obs.obs_data_set_array(settings, "mouse_zoom_toggle", hotkey_save_array)
    obs.obs_data_array_release(hotkey_save_array)
end

-- Descargar script
function script_unload()
    obs.script_log(obs.LOG_INFO, "Script de zoom descargado")
    stop_timer()
    reset_source()
end