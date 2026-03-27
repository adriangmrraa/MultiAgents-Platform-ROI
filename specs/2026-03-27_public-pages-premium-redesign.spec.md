# SPEC: Public Pages Premium SaaS Redesign

**Fecha**: 2026-03-27
**Proyecto**: Platform AI Solutions (Future IA)
**Prioridad**: Alta — paginas publicas son la primera impresion

---

## 1. OBJETIVO

Redisenar TODAS las paginas publicas con estetica premium SaaS (nivel Stripe, Linear, Vercel). Crear 3 paginas nuevas para ventas y documentacion. Textos estrategicos para conversion.

**Referencia visual**: Login de ClinicForge (app.dralauradelgado.com) — dark, imagenes con opacidad, cards glassmorphic, gradients cyan→blue, animaciones float, stats counters, testimonial carousel.

---

## 2. PAGINAS A REDISENAR (8)

### 2.1 Login (`views/auth/Login.tsx` — 185 lineas)
**Estado actual**: Dark basico, card glassmorphic, boton rojo gradient. Funcional pero sin hero ni imagenes.
**Mejoras**:
- Split layout: izquierda hero con imagenes/features, derecha form (como ClinicForge)
- Floating cards con features: "Agente IA 24/7", "Multi-canal", "Analytics en tiempo real"
- Stats counters animados: "500+ tiendas", "1M+ mensajes", "99.9% uptime"
- Background: dark con orbs de glow animados
- Gradient button: evolucionar de rojo a purple→blue (mas premium)
- Testimonial mini-carousel abajo

### 2.2 Register (`views/auth/Register.tsx` — 243 lineas)
**Estado actual**: Formulario basico sobre fondo oscuro.
**Mejoras**:
- Split layout: izquierda beneficios con iconos, derecha formulario
- Steps indicator (1. Cuenta → 2. Tienda → 3. Listo)
- Beneficios: "Sin tarjeta de credito", "Setup en 5 min", "10 dias gratis"
- Social proof: logos de tiendas que usan la plataforma

### 2.3 ForgotPassword (`views/auth/ForgotPassword.tsx` — 117 lineas)
**Mejoras**: Card glassmorphic centrada con icono animado de candado, glow orbs

### 2.4 ResetPassword (`views/auth/ResetPassword.tsx` — 157 lineas)
**Mejoras**: Misma estetica que ForgotPassword, input dark con icono

### 2.5 VerifyEmail (`views/auth/VerifyEmail.tsx` — 121 lineas)
**Mejoras**: Animacion de check/email, confetti visual, dark glassmorphic

### 2.6 Landing (`views/Landing.tsx` — 192 lineas)
**Estado actual**: Existe pero basica.
**Rediseno completo**:
- **Hero**: Titulo grande con gradient, subtitulo, CTA buttons, mockup de la plataforma
- **Social proof**: Logos de clientes, counter animado
- **Features grid**: 6 features con iconos + descripcion (Agente IA, Multi-canal, Analytics, Knowledge Base, Voice Widget, Creative Studio)
- **How it works**: 3 pasos con iconos
- **Pricing preview**: 3 cards de planes
- **Testimonials**: Carousel con fotos y citas
- **FAQ**: Accordion
- **CTA final**: "Empeza gratis hoy"
- **Footer**: Links, social, legal

### 2.7 PrivacyPolicy (`views/PrivacyPolicy.tsx` — 181 lineas)
**Estado actual**: Ya dark premium. Solo polish menor.

### 2.8 TermsOfService (`views/TermsOfService.tsx` — 194 lineas)
**Estado actual**: Ya dark premium. Solo polish menor.

---

## 3. PAGINAS NUEVAS (3)

### 3.1 Meta Connection Guide (`views/MetaConnectionGuide.tsx`)
**Proposito**: Explicar como Future Platform se conecta a Meta (WhatsApp, Instagram, Facebook). Requerido por Meta para app review.
**Contenido**:
- Como funciona la conexion (OAuth → permisos → webhook)
- Que datos accedemos y para que
- Que NO hacemos con los datos (no vendemos, no usamos para ads)
- Seguridad: encriptacion, aislamiento por tenant
- Compliance: GDPR, ley de datos personales Argentina
- Screenshots del flujo de conexion
- FAQ tecnico
**Ruta**: `/meta-connection`

### 3.2 Platform Documentation (`views/Documentation.tsx`)
**Proposito**: Documentacion viva de la plataforma para usuarios y prospectos.
**Contenido**:
- Getting Started (5 pasos)
- Configuracion del Agente IA (prompt, reglas, diccionario)
- Canales (WhatsApp, Instagram, Facebook — como conectar cada uno)
- Productos (catalogo interno vs Tienda Nube)
- Analytics (que metricas hay, como interpretarlas)
- Knowledge Base (como subir documentos, que formatos)
- Voice Widget (como configurar y embeder)
- Creative Studio (como generar assets)
- Billing (planes, pagos, cancelacion)
- FAQ general
**Formato**: Sidebar con indice + contenido a la derecha. Buscador. Screenshots.
**Ruta**: `/docs`

### 3.3 Enterprise/Education Landing (`views/Enterprise.tsx`)
**Proposito**: Vender la plataforma a instituciones educativas y empresas grandes como programa de capacitacion en IA.
**Pitch**:
- "Programa de introduccion rapida al uso de IA para aumentar ROI empresarial"
- "Arma infraestructura que sirva para escalar con IA"
- "Tus alumnos/empleados aprenden usando una plataforma real, no teoria"
**Contenido**:
- Hero con pitch educativo/enterprise
- Beneficios para instituciones (curricula lista, plataforma real, metricas de aprendizaje)
- Caso de uso: "Un alumno configura un agente de ventas en 1 hora"
- Pricing enterprise (custom, contacto)
- Formulario de contacto
- Logos de potenciales partners
**Ruta**: `/enterprise`

---

## 4. DESIGN SYSTEM

### Colores
- Background: `#09090b` (casi negro)
- Cards: `bg-white/5 backdrop-blur-xl border border-white/10`
- Primary gradient: `from-purple-600 to-blue-600` (evolucionar del rojo actual)
- Accent: `purple-500`, `blue-500`
- Text: `white`, `gray-400`, `gray-500`
- Success: `emerald-500`
- Warning: `amber-500`
- Error: `red-500`

### Animaciones
```css
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
@keyframes glow-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
@keyframes slide-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
```

### Componentes reutilizables
- `<GlowOrb color="purple" position="top-left" />` — orb de glow animado
- `<GlassmorphicCard>` — card con backdrop-blur
- `<GradientButton>` — boton con gradient y shadow
- `<StatCounter value={500} label="Tiendas" suffix="+" />` — counter animado
- `<FeatureCard icon={} title="" description="" />` — card de feature
- `<TestimonialCarousel />` — carousel de testimonios

---

## 5. ROUTING (agregar en App.tsx)

```tsx
// Nuevas rutas publicas
<Route path="/meta-connection" element={<MetaConnectionGuide />} />
<Route path="/docs" element={<Documentation />} />
<Route path="/enterprise" element={<Enterprise />} />
```

---

## 6. TEXTOS ESTRATEGICOS (Sales Copy)

### Landing Hero
- Titulo: "Tu vendedor IA que nunca duerme"
- Subtitulo: "Conecta WhatsApp, Instagram y Facebook. Deja que la IA responda, venda y cierre por vos. 24/7."
- CTA primario: "Empezar gratis"
- CTA secundario: "Ver demo"

### Features
1. "Agente de Ventas IA" — "Responde consultas, muestra productos, cierra ventas. Sin intervencion humana."
2. "Multi-canal" — "WhatsApp + Instagram + Facebook en un solo lugar."
3. "Analytics en Tiempo Real" — "Ve que vende, que falla, y que mejorar."
4. "Base de Conocimiento" — "Subi PDFs, textos, URLs. El agente aprende al instante."
5. "Voice Widget" — "Asistente de voz embebible en tu web."
6. "Creative Studio" — "Genera fotos de producto con IA. Sin fotografo."

### Stats
- "500+ tiendas activas"
- "1M+ mensajes procesados"
- "99.9% uptime"
- "$2M+ en ventas asistidas"

---

## 7. DEPENDENCIAS

Ninguna nueva. Todo usa React + Tailwind + lucide-react existentes.

---

## 8. ESTIMACION

| Pagina | Complejidad | Lineas estimadas |
|--------|------------|-----------------|
| Login redesign | Media | ~250 |
| Register redesign | Media | ~300 |
| ForgotPassword | Baja | ~100 |
| ResetPassword | Baja | ~120 |
| VerifyEmail | Baja | ~100 |
| Landing full | Alta | ~500 |
| Privacy polish | Baja | ~20 cambios |
| Terms polish | Baja | ~20 cambios |
| Meta Connection Guide | Media | ~300 |
| Documentation | Alta | ~600 |
| Enterprise Landing | Media-Alta | ~400 |
| **Total** | | **~2700 lineas** |

---

## 9. VERIFICACION

1. Todas las paginas publicas con fondo dark `#09090b`
2. Glassmorphic cards con backdrop-blur en todos los formularios
3. Gradient buttons (purple→blue) en todos los CTAs
4. Glow orbs animados en backgrounds
5. Mobile responsive (test en iPhone Safari + Android Chrome)
6. Textos de venta, no textos genericos
7. Stats counters con animacion
8. Feature cards con iconos lucide
9. Footer consistente en todas las paginas publicas
10. Todas las nuevas rutas funcionan en App.tsx
11. Meta Connection Guide tiene todo lo necesario para Meta app review
12. Documentation cubre todas las features de la plataforma
13. Enterprise landing tiene formulario de contacto funcional
