# 🗺️ Mapa de Interconexión (System Wiring Map)

Este documento es el "Mapa de Cables" de Nexus. Define qué hace cada botón principal en la interfaz, a qué endpoint del backend llama y qué espera recibir.

---

## 1. Dashboard (Panel Principal)
| Acción de UI | Endpoint (Back) | Lógica de Negocio |
| :--- | :--- | :--- |
| **Carga Inicial** | `GET /admin/stats` | Agrega métricas de tokens, chats y órdenes desde Redis/DB. |
| **Activity Stream** | `GET /admin/logs/audit` | Recupera los últimos eventos de sistema filtrados por `tenant_id`. |
| **Ignition Status** | `GET /admin/integrations/status` | Verifica si Meta y TiendaNube están configurados. |

---

## 2. Gestión de Agentes (Agents & Wizard)
| Botón / Acción | Endpoint (Back) | Respuesta / Efecto |
| :--- | :--- | :--- |
| **Activar Agente Ventas** | `GET /admin/agents/sales-config/{tid}` | Busca si ya existe; si no, crea uno base y devuelve su ID. |
| **Guardar en Wizard** | `POST /admin/agents` (o `PUT`) | Guarda el 100% de la config (JSONB) y actualiza el cerebro en tiempo real. |
| **Mejorar con IA (🪄)** | `POST /admin/ai/improve-prompt` | Envía el texto actual y recibe una versión estructurada por GPT-4o. |
| **Simular Chat (Prueba)** | `POST /admin/agents/simulate` | Ejecuta la IA con una "configuración volátil" (sin guardar en DB). |
| **Eliminar Agente** | `DELETE /admin/agents/{id}` | Borra el agente. Si es el último de WhatsApp, desactiva el webhook. |

---

## 3. Base de Conocimiento (Knowledge Base)
| Botón / Acción | Endpoint (Back) | Respuesta / Efecto |
| :--- | :--- | :--- |
| **Subir PDF/Docs** | `POST /admin/rag/upload` | Guarda en S3/MinIO y encola la vectorización en Supabase. |
| **Actualizar Catálogo** | `POST /admin/tiendanube/sync` | Dispara el worker de sincronización de productos. |
| **Eliminar Documento** | `DELETE /admin/rag/docs/{id}` | Elimina el archivo y sus vectores asociados en `documents`. |

---

## 4. Configuración (Settings & Vault)
| Botón / Acción | Endpoint (Back) | Respuesta / Efecto |
| :--- | :--- | :--- |
| **Conectar con Meta** | `POST /admin/meta/connect` | Intercambia el código de Facebook por un token de 60 días. |
| **Guardar Credencial** | `POST /admin/credentials` | Cifra el valor con AES-256 antes de guardarlo en Postgres. |
| **Probar Conexión TN** | `GET /admin/connection/test` | Intenta llamar a la API de TiendaNube con el token guardado. |
| **Instalar Web Widget** | `GET /admin/web-widget/config` | Devuelve el script JS con el `tenant_id` inyectado. |

---

## 5. Centro de Chats (Live Chat)
| Botón / Acción | Endpoint (Back) | Respuesta / Efecto |
| :--- | :--- | :--- |
| **Enviar Respuesta** | `POST /admin/chat/send` | Envía mensaje manual vía WhatsApp/FB/IG (Bypass IA). |
| **Habilitar Override** | `POST /admin/chat/override` | Pausa el bot por N horas para atención humana directa. |
| **Cambiar Círculo** | `PUT /admin/chat/contacts/{id}` | Clasifica al cliente (Familia, Trabajo, Cliente) para prioridad RAG. |

---

## 🔬 Flujo Universal de Autenticación
1.  **Login**: El frontend llama a `/auth/login`.
2.  **Token**: Recibe un JWT que contiene `user_id` y `tenant_id`.
3.  **Encabezado**: Todas las llamadas de arriba incluyen `Authorization: Bearer <JWT>`.
4.  **Aislamiento**: El backend usa el `tenant_id` del JWT para filtrar todas las consultas SQL (`WHERE tenant_id = $1`).

**© 2026 Platform AI Solutions - Architecture Unit**
