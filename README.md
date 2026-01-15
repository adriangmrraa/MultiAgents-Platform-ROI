---

## 🚀 Guía de Inicio y Despliegue

### 1. Instalación Zero-Config
Ya no es necesario configurar la `OPENAI_API_KEY` o `GOOGLE_API_KEY` en el archivo `.env` para cada operación. El sistema ahora funciona así:
- **Herencia Automática**: Si pones las llaves en el `.env` al inicio, el sistema las "sedimenta" automáticamente en la base de datos para el primer inquilino.
- **Configuración via UI**: Los administradores pueden cargar y rotar las llaves directamente desde *Settings > Credenciales*.

### 2. Variables Mínimas (Globales)
- `ADMIN_TOKEN`: Seguridad para el túnel administrativo.
- `POSTGRES_DSN` & `REDIS_URL`: Infraestructura de datos.
- `SMTP_*`: Para notificaciones oficiales del sistema (Nexus Brand).

---

## 📚 Documentación Técnica
*   **[BACKEND_SPECIFICATION.md](./BACKEND_SPECIFICATION.md)**: El contrato de la Bóveda de Credenciales.
*   **[Manual de Vuelo v5.1](./Manual%20de%20Vuelo%20Nexus%20v5.md)**: Operaciones diarias y gestión soberana.
*   **[REPORTE_MASTER_REFACTORIZACIÓN.md](./REPORTE_MASTER_REFACTORIZACIÓN.md)**: Historial técnico del salto a la v5.1.

---

**© 2026 Platform AI Solutions - Sovereign Architecture**
