# 🗼 Platform Tower (SuperAdmin Logic Deep Dive)

Este documento detalla la lógica de `PlatformTower.tsx`, el panel de control "God Mode" exclusivo para SuperAdministradores.

---

## 🏗️ Arquitectura de Telemetría

La Tower agrega datos de **toda la infraestructura**, rompiendo el aislamiento de inquilinos (solo visible para rol `SuperAdmin`).

### Componentes Clave
1.  **Metrics Aggregator**: Consolida contadores de PostgreSQL y Redis.
2.  **Infra Pulse**: Monitor de salud de los servicios Dockerizados.
3.  **Tenant Registry**: Listado maestro de todas las tiendas instaladas.
  
---

## 🔄 Flujo de Datos

### 1. Métricas Globales (Overview)
-   **Endpoint**: `GET /platform/overview`
-   **Datos**:
    -   `total_tenants`: `SELECT COUNT(*) FROM tenants`
    -   `total_users`: `SELECT COUNT(*) FROM users`
    -   `messages_24h`: Conteo de mensajes procesados en la ventana de 24 horas (desde Redis o DB).
    -   `revenue`: Estimación de GMV (Gross Merchandise Value) de todas las tiendas conectadas.

### 2. Salud de Infraestructura (Infrastructure)
-   **Endpoint**: `GET /platform/infrastructure`
-   **Lógica Backend**:
    -   Consulta `INFO MEMORY` a Redis para obtener uso de RAM.
    -   Consulta el tamaño físico de la base de datos PostgreSQL (`pg_database_size`).
    -   Verifica latencia de respuesta interna.
-   **UI**: Muestra alertas si el uso de memoria supera umbrales críticos.

### 3. Registro de Inquilinos (Tenant Registry)
-   **Endpoint**: `GET /platform/tenants`
-   **Propósito**: Administración centralizada. Permite ver quién está usando la plataforma.
-   **Datos Sensibles**: Muestra emails de dueños y teléfonos de bots. (Protegido por `verify_super_admin` en backend).

---

## ⚡ Simulación vs Realidad

Actualmente, el gráfico de "Global Message Volume" es **simulado** en el frontend (`Math.random()`) para propósitos de demostración visual en la v5.1.
> **Roadmap v6.0**: Este gráfico se conectará a una serie temporal real almacenada en Redis TimeSeries o InfluxDB.

---

## 🛡️ Seguridad

Esta vista implementa "Zero Content Access Enforced":
-   El SuperAdmin puede ver *metadatos* (cuántos mensajes, tamaño de DB).
-   **NO** puede leer el contenido de los mensajes de los inquilinos desde esta vista.
-   Esto cumple con el principio de Soberanía de Datos incluso al nivel de monitoreo.

---

## 🔬 Especificaciones Técnicas (Debugging Guide)

### 1. Requisitos de Acceso
*   **Role**: `SuperAdmin` (Obligatorio).
*   **Middleware**: Si un usuario normal (`Admin`) intenta acceder a estos endpoints, el backend devuelve `403 Forbidden`.

### 2. Endpoints de Telemetría

#### A. Overview
*   **Request**: `GET /api/platform/overview`
*   **Response**:
    ```json
    {
      "total_tenants": 12,
      "total_users": 50,
      "messages_24h": 1500,
      "formatted_revenue": "$125k"
    }
    ```
*   **Métrica GMV**: Actualmente es una estimación basada en tickets promedio, no es contabilidad real.

#### B. Infraestructura (Health Check)
*   **Request**: `GET /api/platform/infrastructure`
*   **Response**:
    ```json
    {
      "redis_memory": "12.5MB",
      "db_size": "450MB",
      "redis_ping": true
    }
    ```
*   **Error Crítico**: Si devuelve 500, significa que Redis o Postgres están caídos. La UI mostrará "N/A" o spinners infinitos.

### 3. Simulación de Datos
Si ves que el gráfico de barras se mueve "demasiado perfecto":
*   **Archivo**: `PlatformTower.tsx` (~Línea 116).
*   **Código**: `Math.random() * 80 + 20`.
*   **Acción Correctiva**: Para v6.0, reemplazar este bloque mapeando datos reales de `fetchApi('/platform/traffic-history')`.

