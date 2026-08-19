# Publicación — qué está hecho y qué falta

Estado a 17 de agosto de 2026.

---

## Lo primero: el riesgo que no arregla el código

### Google Play: riesgo bajo

La política prohíbe **facilitar la venta**: carrito de compra, reparto, recogida,
venta de productos con THC. Un portavoz de Google aclaró expresamente que no se
aplica a las apps relacionadas con cannabis en general, solo a las que venden.
Weedmaps y Eaze siguen en la tienda tras sacar el pedido fuera de la app.

CannaMet no tiene transacción de ningún tipo. Por esta vía no hay problema.

### Apple: aquí sí

La guideline 1.4.3 tiene dos cláusulas y la que importa no es la de la venta:

> "Apps that encourage consumption of tobacco and vape products, **illegal
> drugs**, or excessive amounts of alcohol are not permitted."

Apple encuadra la marihuana dentro de "illegal drugs". Hay un precedente directo
en el foro de desarrolladores: una app cuya única función era que la gente se
encontrara para consumir cannabis junta fue rechazada por 1.4.3, con el motivo
"parece promover usos excesivos o inapropiados de sustancias controladas".

**Conclusión: presenta primero en Google Play, no en App Store.** Es al revés de
lo que dice cualquier consejo genérico, pero aquí el orden importa.

**Decisión tomada (18 de agosto de 2026): solo Google Play, con el nombre
CannaMet.** La app recupera su identidad donde la política lo permite y renuncia
a la App Store, donde no cabe. Lo que **no** vuelve es el campo de preferencia de
consumo: el perfil sigue describiendo ambiente, así que no hay categoría especial
del art. 9 y la revisión legal sigue siendo la simple. La ficha completa, con
textos, clasificación por edad y Data Safety, está en `docs/ficha-play.md`.

### Ya aplicado: el perfil no declara consumo

El campo `preferencia_consumo` **se ha eliminado**. En su lugar hay `ambiente`,
que describe contexto —plan de casa, monte, música, quedadas, cocinar y crear— sin
mencionar sustancias. No queda en la app ni en la base de datos ninguna
declaración de consumo.

Con eso, la exposición a 1.4.3 baja a la de cualquier app social. Lo que queda es
mantener la coherencia fuera del código:

- App social para adultos donde se indican preferencias de estilo de vida.
- Nada en el nombre, subtítulo, palabras clave ni capturas que la convierta en
  "app de cannabis": sin hoja, sin "weed", sin "420", sin nombres de variedades.
- La descripción no debe sugerir quedar para consumir. CannaMet conecta personas;
  lo que hagan después no es funcionalidad de la app.
- Si el revisor pregunta, la respuesta honesta y verificable es que la app no
  recoge ningún dato sobre consumo de sustancias.

---

## Hecho en la app

| Requisito                                         | Dónde                                            |
| ------------------------------------------------- | ------------------------------------------------ |
| Verificación de edad con fecha de nacimiento      | Comprobada en servidor, no solo en el formulario |
| Edad recalculada a diario                         | `pg_cron`, 03:30                                 |
| Consentimiento con prueba (art. 7.1 RGPD)         | `aceptaciones_legales`, versionado               |
| Ninguna categoría especial de datos (art. 9 RGPD) | El perfil declara ambiente, no consumo           |
| Re-aceptación automática al cambiar los textos    | `config_moderacion.version_*`                    |
| Borrado de cuenta dentro de la app                | Obligatorio en App Store desde 2022              |
| Exportación de datos (art. 15)                    | Perfil → Tus datos                               |
| Bloqueo de usuarios                               | Apple 1.2                                        |
| Denuncia de usuarios                              | Apple 1.2                                        |
| Contacto de abusos publicado                      | Apple 1.2                                        |
| Aceptación de tolerancia cero                     | Pantalla de consentimiento                       |
| Moderación con actuación en 24 h                  | Panel + cola priorizada                          |
| Datos alojados en la UE                           | Supabase eu-west-3 (París)                       |

---

## Falta, y lo tienes que hacer tú

### Riesgo jurídico: resuelto por la vía corta

Al quitar la preferencia de consumo desaparece la duda del art. 9 RGPD. La app ya
no trata ninguna categoría especial de datos, y la política de privacidad lo
declara expresamente. Eso simplifica la revisión del abogado y evita el
consentimiento explícito separado.

### Bloqueantes

1. **Rellenar `src/legal/textos.ts`.** Todos los `[CORCHETES]`: razón social,
   NIF, domicilio, emails. Sin esto la política incumple el art. 13 RGPD y las
   tiendas la rechazan de entrada.

2. **Revisión por abogado** de ambos textos. Son borradores estructurados, no
   documentos válidos. Pregunta expresamente por el art. 9 (dato de salud).

3. **Hospedar privacidad y términos en una URL pública.** Ya no hay que copiar
   nada: `npm run legales` genera `docs/` desde `textos.ts`. Queda encender
   GitHub Pages (Settings → Pages → rama, carpeta `/docs`) y poner las dos URL
   resultantes en `DATOS_RESPONSABLE`. Mientras queden corchetes sin rellenar el
   script termina con error a propósito.

4. **Firmar el DPA con Supabase** (encargado del tratamiento). Está en el
   dashboard, en la configuración de la organización.

5. **Registro de actividades de tratamiento** (art. 30 RGPD). Hay un borrador
   completo en `docs/registro-actividades.md` con las siete actividades, las
   bases jurídicas, los plazos y los encargados. Faltan los corchetes y el
   repaso del abogado. Ojo al apartado 5: el token de push viaja a Expo y de
   ahí a APNs/FCM, y esa vía hay que confirmarla.

6. **Dar de alta al menos un moderador**, o la cola no la lee nadie. Ahora
   mismo no hay ni un usuario registrado, así que no hay UUID que dar de alta
   todavía; en cuanto te registres:

   ```sql
   insert into public.moderadores (usuario_id, nota) values ('<uuid>', 'quien');
   ```

7. **Desactivar o mantener "Confirm email"** conscientemente en Supabase Auth.
   Con confirmación activada el registro es más lento pero filtra emails falsos.

### Fichas de tienda

- **Solo Google Play.** Ficha redactada en `docs/ficha-play.md`.
- **Clasificación por edad: 18+**. Declarar contenido sobre drogas y
  citas, sin adornos: mentir en el cuestionario es motivo de retirada.
- **Etiquetas de privacidad (Apple) / Data Safety (Google)**: declarar ubicación
  aproximada, identificadores y contenido de usuario. **No** hay datos de salud.
  El token de push cuenta como identificador de aparato: va en esa casilla. Y
  ahora hay **fotos**, que son contenido de usuario: marcar esa casilla también.
- **Justificación del permiso de ubicación**: ya está el texto en `app.json`.
- Capturas sin iconografía cannábica: la identidad la lleva el nombre, y cada
  hoja de más es una razón para que el revisor mire con lupa.

### Técnico pendiente

- **Notificaciones push: hechas, sin probar en aparato.** Cola en base de datos,
  Edge Function y cliente están escritos y el recorrido de servidor está
  verificado contra Postgres. Falta lo que solo se puede hacer con una build
  real: poner `extra.eas.projectId` en `app.json`, subir las credenciales de
  APNs y FCM a EAS, y comprobar la entrega en un móvil.
- **Probar en dispositivo.** El backend está verificado a fondo; los gestos, el
  teclado y los WebSockets de Realtime no. Ya hay APK compilado y firmado con la
  clave de depuración en la pestaña Releases del repositorio, etiqueta `apk`.
- **Build de producción** con EAS. Pasos exactos en `docs/BUILD.md`. El APK
  instalable sale del perfil `preview`; Play exige el AAB del perfil
  `production`.
- **CORREGIDO:** ningún perfil de `eas.json` llevaba la clave de Supabase. Toda
  build que no fuera `development` habría arrancado y muerto en la primera
  pantalla. Las tres la llevan ya.
- **Rotar la clave publicable** si el repositorio ha sido público en algún momento.

---

## Lo que sigue sin resolverse

- **La edad es autodeclarada.** Pedir la fecha de nacimiento y comprobarla en
  servidor es lo máximo sin verificación documental. Un menor decidido pone otra
  fecha. La denuncia "parece menor de edad" sigue siendo la red, y es reactiva.
- **Un bloqueado puede crear otra cuenta.** Mitigado con fricción y señal
  automática, no resuelto. Ver el README.
- **No hay verificación de identidad.** Los términos ya avisan de que la app no
  verifica quién es nadie, pero eso protege legalmente, no protege a las personas.
