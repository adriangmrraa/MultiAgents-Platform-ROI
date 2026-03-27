# SPEC: Pre-Launch Features Bundle

## Fecha: 2026-03-18
## Prioridad: P0 — Requerido para lanzamiento

---

## FEATURES A IMPLEMENTAR

### 1. Landing Page Publica (`/`)
- Pagina visible sin login para visitantes nuevos
- Hero con propuesta de valor de Future
- Features destacadas (Omnichannel, AI Agents, RAG, Creative Studio)
- Social proof / metricas
- CTA: "Comenzar gratis" → /register, "Ver precios" → /pricing
- Mobile-first

### 2. Pricing Page Publica (`/pricing`)
- Visible sin login
- 3 planes: Free Trial (10 dias, 50 msgs), Pro ($49/mes), Enterprise ($199/mes)
- Toggle mensual/anual con -20% descuento
- USD/ARS toggle
- Features comparativas por plan
- CTAs: "Empezar gratis" → /register, "Elegir plan" → /register
- Fetch desde GET /billing/plans (endpoint ya publico)

### 3. Cancelar Suscripcion
- Backend: POST /billing/cancel-subscription
  - Marca subscription status = 'canceled'
  - Si es Stripe: llama stripe.Subscription.cancel()
  - Si es MP: cancela preapproval via API
  - Registra en audit_logs
- Frontend: boton "Cancelar suscripcion" en Billing.tsx (solo para paid users)
  - Confirmacion doble antes de cancelar
  - Muestra que datos se preservan

### 4. Webhook Stripe End-to-End
- Verificar que checkout.session.completed activa la suscripcion
- Verificar que invoice.paid registra factura
- Verificar que customer.subscription.deleted marca canceled
- Testear con Stripe CLI o tarjeta de prueba

### 5. Webhook MercadoPago End-to-End
- Verificar que payment event activa la suscripcion
- Parsear external_reference para tenant_id + plan_name
- Registrar invoice en DB

### 6. Terminos de Servicio y Politica de Privacidad
- Actualizar contenido existente (TermsOfService.tsx, PrivacyPolicy.tsx)
- Reemplazar "Nexus" por "Future Platform"
- Agregar clausulas de pagos recurrentes, datos, IA

### 7. Password Reset (Olvide mi contrasena)
- Backend:
  - POST /auth/forgot-password → genera token, envia email
  - POST /auth/reset-password → valida token, actualiza password
- Frontend:
  - /forgot-password → formulario email
  - /reset-password?token=xxx → formulario nueva contrasena
- Email con misma estetica que los otros emails de Future
- Link "Olvide mi contrasena" en Login.tsx

---

## ARCHIVOS A CREAR

- `frontend_react/src/views/Landing.tsx`
- `frontend_react/src/views/Pricing.tsx`
- `frontend_react/src/views/auth/ForgotPassword.tsx`
- `frontend_react/src/views/auth/ResetPassword.tsx`

## ARCHIVOS A MODIFICAR

- `frontend_react/src/App.tsx` — agregar rutas publicas
- `frontend_react/src/views/auth/Login.tsx` — link forgot password
- `frontend_react/src/views/Billing.tsx` — boton cancelar
- `frontend_react/src/views/TermsOfService.tsx` — actualizar contenido
- `frontend_react/src/views/PrivacyPolicy.tsx` — actualizar contenido
- `orchestrator_service/app/routes/auth_routes.py` — forgot/reset password
- `orchestrator_service/app/routes/billing_routes.py` — cancel subscription + webhook fixes

---

## CRITERIOS DE ACEPTACION

- [ ] Visitante sin login ve landing page en /
- [ ] Visitante puede ver precios en /pricing sin registrarse
- [ ] Usuario puede cancelar su suscripcion desde /billing
- [ ] Pago con Stripe activa el plan automaticamente via webhook
- [ ] Pago con MercadoPago activa el plan automaticamente via webhook
- [ ] Usuario puede resetear password via email
- [ ] Link "Olvide mi contrasena" visible en login
- [ ] ToS y Privacy Policy dicen "Future Platform"
- [ ] Todo responsive en mobile
