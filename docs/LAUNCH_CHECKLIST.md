# Future Platform — Launch Checklist

Guia paso a paso para pasar de entorno de prueba a produccion.

---

## Estado Actual (Marzo 2026)

| Servicio | Estado | Notas |
|----------|--------|-------|
| **MercadoPago** | PRODUCCION | Access Token `APP_USR-` activo. Pagos reales. |
| **Stripe** | TEST | Key `sk_test_`. Solo tarjetas de prueba. |
| **Meta (IG/FB/WA)** | PRODUCCION | Webhooks activos, DMs llegan en tiempo real. |
| **AI Agents** | PRODUCCION | OpenAI/Gemini conectados con keys reales. |
| **Frontend** | PRODUCCION | Deployado en EasyPanel. |

---

## 1. Stripe — Pasar a Produccion

### Paso 1: Activar modo live en Stripe
1. Ir a [dashboard.stripe.com](https://dashboard.stripe.com)
2. Arriba a la derecha, desactivar el toggle **"Test mode"**
3. Stripe puede pedir verificar la identidad del negocio (KYC)
   - Nombre de la empresa
   - Direccion
   - Cuenta bancaria para recibir depositos
   - Documento del titular

### Paso 2: Obtener keys de produccion
1. Ir a **Developers → API Keys** (en modo live)
2. Copiar la **Secret key** (`sk_live_...`)
3. Crear un **nuevo webhook endpoint** en modo live:
   - URL: `https://multiagents-orchestrator.yn8wow.easypanel.host/billing/webhook/stripe`
   - Eventos:
     - `checkout.session.completed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.deleted`
4. Copiar el **Signing secret** del webhook (`whsec_...`)

### Paso 3: Actualizar variables en EasyPanel
```env
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxx
```

### Paso 4: Reiniciar orchestrator
Los productos y precios se crean automaticamente en Stripe la primera vez que alguien paga.

### Tarjeta de prueba (modo test)
Mientras estes en modo test, usa:
- Numero: `4242 4242 4242 4242`
- Vencimiento: cualquier fecha futura
- CVC: cualquier 3 digitos

---

## 2. MercadoPago — Ya en Produccion

MercadoPago esta activo con credenciales de produccion.

### Si necesitas cambiar la cuenta receptora:
1. Ir a [mercadopago.com.ar/developers/panel/app](https://www.mercadopago.com.ar/developers/panel/app)
2. Seleccionar la aplicacion con **Checkout Pro** habilitado
3. Ir a **Credenciales de produccion**
4. Copiar el nuevo **Access Token** (`APP_USR-...`)
5. Actualizar en EasyPanel:
```env
MP_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxx
```

### Webhook de notificaciones (opcional)
Para recibir notificaciones de pago automaticas:
1. En la app de MP Developers → **Configuracion → Notificaciones IPN**
2. URL: `https://multiagents-orchestrator.yn8wow.easypanel.host/billing/webhook/mercadopago`

### Notas importantes
- MercadoPago Argentina solo acepta **ARS** (el sistema convierte automaticamente)
- Los pagos llegan al balance de la cuenta de MP del titular
- Los retiros se hacen desde la app/web de MercadoPago a tu cuenta bancaria

---

## 3. Meta (Instagram, Facebook, WhatsApp) — Ya en Produccion

### Verificacion de la app (si no esta hecha)
Para que cualquier usuario pueda conectar su cuenta de Meta (no solo admins/testers):
1. Ir a [developers.facebook.com](https://developers.facebook.com) → Tu App
2. Ir a **App Review → Permissions and Features**
3. Solicitar aprobacion de:
   - `pages_messaging` — enviar/recibir mensajes de Messenger
   - `instagram_basic` — acceso basico a Instagram
   - `instagram_manage_messages` — enviar/recibir DMs de Instagram
   - `pages_read_engagement` — leer info de paginas
4. Completar la **Business Verification** si no esta hecha
5. Cambiar el estado de la app a **"Live"** (arriba en el dashboard)

### Variables de entorno
```env
META_APP_ID=tu_app_id
META_APP_SECRET=tu_app_secret
META_VERIFY_TOKEN=nexus_verification_token
VITE_FACEBOOK_APP_ID=tu_app_id
VITE_META_CONFIG_ID=tu_meta_config_id
```

### Webhook URLs configuradas en Meta Dashboard
| Producto | URL |
|----------|-----|
| Messenger | `https://multiagents-metaservice.yn8wow.easypanel.host/webhook` |
| Instagram | misma URL |
| WhatsApp | misma URL |

---

## 4. Dominio Personalizado (Opcional)

Para usar tu propio dominio en vez de `yn8wow.easypanel.host`:

### Paso 1: Comprar dominio
Ej: `futureplatform.com` en Namecheap, GoDaddy, Cloudflare, etc.

### Paso 2: Configurar DNS
Agregar registros CNAME apuntando a EasyPanel:

| Subdominio | Tipo | Destino |
|------------|------|---------|
| `app.futureplatform.com` | CNAME | `multiagents-frontend.yn8wow.easypanel.host` |
| `api.futureplatform.com` | CNAME | `multiagents-orchestrator.yn8wow.easypanel.host` |
| `meta.futureplatform.com` | CNAME | `multiagents-metaservice.yn8wow.easypanel.host` |

### Paso 3: Actualizar variables
```env
FRONTEND_URL=https://app.futureplatform.com
VITE_API_URL=https://api.futureplatform.com
```

### Paso 4: Actualizar URLs en servicios externos
- Stripe webhook URL
- MercadoPago back_urls
- Meta webhook URL
- Meta App → Valid OAuth Redirect URIs

---

## 5. Email (SMTP) para Notificaciones

El sistema envia emails de verificacion, trial warnings, y receipts.

### Opciones recomendadas:
| Servicio | Precio | Setup |
|----------|--------|-------|
| **Resend** | 3000 emails/mes gratis | API key |
| **Brevo (Sendinblue)** | 300 emails/dia gratis | SMTP |
| **Gmail SMTP** | Gratis (limite 500/dia) | App password |

### Variables
```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=re_xxxxxx
SMTP_FROM=noreply@futureplatform.com
```

---

## 6. Seguridad Pre-Launch

### Checklist
- [ ] Cambiar `ADMIN_TOKEN` a un valor largo y aleatorio (no el default)
- [ ] Cambiar `SECRET_KEY` (JWT) a un valor aleatorio de 64+ caracteres
- [ ] Cambiar `INTERNAL_API_TOKEN` y `INTERNAL_SECRET_KEY` a valores unicos
- [ ] Verificar que `META_APP_SECRET` este configurado (HMAC webhook verification)
- [ ] Configurar `SUPER_ADMIN_EMAIL` con tu email real
- [ ] Verificar que las credenciales de OpenAI tengan limites de gasto configurados
- [ ] Revisar que Google API keys tengan restricciones de dominio

### Generar secrets aleatorios (usar en terminal):
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## 7. Monitoreo Post-Launch

### Que revisar diariamente (primera semana):
- **Platform Tower** (`/platform`): MRR, tenants activos, errores
- **Logs del orchestrator**: buscar `error` o `failed`
- **Stripe Dashboard**: pagos recibidos, disputes
- **MercadoPago Dashboard**: balance, pagos recibidos
- **Meta App Dashboard**: webhooks health, API errors

### Alertas recomendadas:
- Stripe envia emails automaticos por pagos fallidos
- MercadoPago envia notificaciones de cobros
- Configurar uptimerobot.com para monitorear `/health` de cada servicio

---

## 8. Variables de Entorno Completas (Produccion)

```env
# === Core ===
SECRET_KEY=<aleatorio-64-chars>
POSTGRES_DSN=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://redis:6379
ADMIN_TOKEN=<aleatorio-48-chars>
INTERNAL_API_TOKEN=<aleatorio-48-chars>
INTERNAL_SECRET_KEY=<mismo-valor-que-INTERNAL_API_TOKEN>
SUPER_ADMIN_EMAIL=tu@email.com
FRONTEND_URL=https://multiagents-frontend.yn8wow.easypanel.host

# === AI ===
OPENAI_API_KEY=sk-xxxxxxxx
GOOGLE_API_KEY=AIzaSyxxxxxxxx  (opcional, per-tenant override)

# === Stripe (PRODUCCION) ===
STRIPE_SECRET_KEY=sk_live_xxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx

# === MercadoPago (PRODUCCION) ===
MP_ACCESS_TOKEN=APP_USR-xxxxxxxx

# === Meta ===
META_APP_ID=xxxxxxxx
META_APP_SECRET=xxxxxxxx
META_VERIFY_TOKEN=nexus_verification_token
VITE_FACEBOOK_APP_ID=xxxxxxxx
VITE_META_CONFIG_ID=xxxxxxxx

# === OAuth ===
GOOGLE_OAUTH_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
VITE_GOOGLE_OAUTH_CLIENT_ID=mismo-valor

# === Email (opcional) ===
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=re_xxxxxxxx
SMTP_FROM=noreply@tudominio.com

# === Services ===
ORCHESTRATOR_URL=http://orchestrator:8000
WHATSAPP_SERVICE_URL=http://whatsapp-service:8002
META_SERVICE_URL=http://meta-service:8000
```

---

## Resumen Rapido: Que Hacer Para Lanzar

| # | Tarea | Tiempo | Quien |
|---|-------|--------|-------|
| 1 | Completar verificacion de Stripe (KYC) | 1-3 dias | Admin |
| 2 | Cambiar Stripe keys a `sk_live_` + nuevo webhook | 10 min | Dev |
| 3 | Verificar app de Meta (App Review) | 3-7 dias | Admin |
| 4 | Cambiar secrets a valores aleatorios | 5 min | Dev |
| 5 | Configurar SMTP para emails | 10 min | Dev |
| 6 | (Opcional) Configurar dominio personalizado | 30 min | Dev |
| 7 | Probar flujo completo: registro → trial → pago → uso | 20 min | QA |
| 8 | Lanzar | 0 min | Todos |
