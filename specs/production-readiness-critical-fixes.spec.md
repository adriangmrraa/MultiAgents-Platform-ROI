# SPEC: Production Readiness - Critical Fixes

## 1. Objetivos de Negocio

Preparar Platform AI Solutions para producción eliminando anti-patterns de seguridad y configuración.

---

## 2. Contexto

### Gaps Críticos Identificados

1. **Silent Error Handling**: 8+ lugares con `except: pass` - errores se ignoran silenciosamente
2. **Logging Configuration**: Sin LOG_LEVEL configurable
3. **Health Check Incompleto**: /health no verifica dependencias
4. **Graceful Shutdown**: Falta cleanup de conexiones

---

## 3. Requisitos Funcionales

### RF-301: Fix Silent Error Handling

- **Problema**: `except: pass` ignora errores silenciosamente
- **Requerimiento**: Reemplazar con logging adecuado
- **Archivos**:
  - `main.py`: líneas 2566, 2738, 3417
  - `app/api/deps.py`: línea 84
  - `app/core/engine.py`: líneas 225, 463, 474

### RF-302: Logging Configuration

- **Problema**: Sin configuración de nivel de logging
- **Requerimiento**: Agregar LOG_LEVEL env var con validación
- **Valores**: DEBUG, INFO, WARNING, ERROR, CRITICAL

### RF-303: Enhanced Health Checks

- **Problema**: /health no verifica DB ni Redis
- **Requerimiento**: Health check completo
- **Checks**: DB connection, Redis connection, external services

### RF-304: Graceful Shutdown

- **Problema**: No hay cleanup al apagar
- **Requerimiento**: Cleanup connections en lifespan shutdown

---

## 4. Criterios de Aceptación

- [ ] 0 instances de `except: pass` en código de producción
- [ ] LOG_LEVEL configurable via env var
- [ ] /health verifica DB + Redis
- [ ] Lifespan incluye cleanup de conexiones

---

## 5. Estimación

- **Tiempo**: 2 horas
- **Dependencies**: Ninguna
