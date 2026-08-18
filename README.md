# MATCH

Social discovery para consumidores de cannabis. Expo + TypeScript + NativeWind + Supabase.

---

> **Antes de publicar, lee `PUBLICACION.md`.** Hay bloqueantes que no son código:
> textos legales sin rellenar, DPA con Supabase, y un riesgo real de rechazo en
> las tiendas por la temática.

## Arranque

```bash
npm install
cp .env.example .env      # ya trae la URL y la clave publicable del proyecto
npx expo start -c
```

El flag `-c` limpia la caché de Metro. Sin él, NativeWind puede no aplicar estilos
tras un cambio en `tailwind.config.js` y verás la app en blanco.

### Datos obligatorios antes de nada

`src/legal/textos.ts` tiene huecos `[ENTRE CORCHETES]`: razón social, NIF,
domicilio y emails de contacto. Sin ellos la política de privacidad incumple el
art. 13 RGPD, y la app muestra los corchetes en pantalla.

### Antes de registrar el primer usuario

Supabase trae **confirmación por email activada** por defecto. Si la dejas puesta,
el registro creará la cuenta pero no abrirá sesión, y la app mostrará el aviso
correspondiente. Para desarrollo:

> Dashboard → Authentication → Sign In / Providers → Email → desactivar _Confirm email_

La app funciona con las dos configuraciones; solo cambia si hay que pasar por el
buzón o no.

---

## Estructura

```
App.tsx                     fuentes + providers
src/
  lib/
    supabaseClient.ts       cliente y traducción de errores
    api.ts                  ÚNICO punto de contacto con el backend
    log.ts                  logs estructurados `[ámbito] evento { ms }`
    formato.ts              distancias y fechas
    notificaciones.ts       permiso, token de Expo y alta/baja del aparato
  types/
    database.ts             generado (npm run tipos)
    modelos.ts              tipos de dominio + etiquetas de UI
  contexts/SesionContext    sesión + perfil, fuente única de verdad
  hooks/                    lógica de negocio, una por caso de uso
  componentes/              presentacionales, sin llamadas de red
  pantallas/                composición
  navegacion/               stack + tabs, conmutación condicional
docs/                       páginas legales públicas (GitHub Pages) + art. 30
scripts/
  generar-legales.mjs       docs/ se genera desde src/legal/textos.ts
supabase/
  schema.sql                fuente de verdad: reconstruye la base entera
  migrations/               historial de decisiones, no replay garantizado
  functions/notificar/      Edge Function que entrega los avisos a Expo
```

La regla que sostiene todo: **las pantallas no llaman a Supabase**. Llaman a hooks,
los hooks llaman a `api.ts`, y `api.ts` es lo único que conoce el cliente. Cambiar
de backend toca un fichero.

---

## Cómo se protegen los datos

La app es un caso donde una fuga no es un fallo estético: la ubicación de alguien
que busca conocer gente es un vector de acoso. El backend está montado sobre eso.

| Qué                  | Cómo                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Coordenadas          | Nunca salen de Postgres. `descubrir_perfiles()` devuelve km redondeados. GRANT columnar impide leer `coordenadas` incluso con match.      |
| Reciprocidad         | El cliente no puede leer swipes ajenos, así que `registrar_swipe()` resuelve el match en servidor.                                        |
| Duplicados de match  | Constraint `usuario_1_id < usuario_2_id` + unique: A-B y B-A son la misma fila por definición.                                            |
| Mensajes ajenos      | GRANT columnar: el receptor solo puede escribir `leido`, nunca `contenido`.                                                               |
| Usuario sin relación | No ve ninguna fila de ninguna de las cuatro tablas. Verificado.                                                                           |
| `anon`               | `permission denied` en las seis tablas, antes incluso de evaluar RLS.                                                                     |
| Bloqueo              | Simétrico en efecto aunque unilateral en intención: desaparecéis el uno del otro en feed, chats, perfil y envío de mensajes.              |
| Reportes             | Sobreviven al borrado de la cuenta denunciada (`reportado_id` nullable + `reportado_nombre`). Freno de 10/hora contra la denuncia masiva. |

Las RPC son `SECURITY DEFINER` a propósito y todas filtran por `auth.uid()` con
`search_path` fijado. El linter de Supabase las marca; es esperado.

---

## Moderación

Bloquear y reportar son la misma acción vista desde dos sitios, así que el modal
de reporte trae **"bloquear también" activado por defecto**: nadie denuncia a
alguien con quien quiere seguir hablando.

El bloqueo se propaga por `es_miembro_de_match()`, que gobierna las tres políticas
de `mensajes` a la vez. Un solo punto de cambio en lugar de tres reglas que se
desincronizan.

Detalles con intención:

- **Bloquear inserta un `dislike`.** Sin eso, el perfil reaparecería en el feed
  al desbloquear, o si nunca hubo swipe previo.
- **Desbloquear no borra el `dislike`.** Dejar de bloquear no es volver a
  interesarse.
- **El bloqueado no lo nota.** No ve la tabla `bloqueos`, y para él el chat
  simplemente deja de existir.
- **"Parece menor de edad" encabeza la lista de motivos.** Es lo único que exige
  actuación inmediata y no puede quedar enterrado bajo "spam".
- **La lista de bloqueados vive en el perfil.** Un bloqueo irreversible es una
  trampa: la gente lo evita por miedo a equivocarse.

La cola de moderación (`public.reportes`, estado `pendiente`) solo es legible con
`service_role`. **No hay panel de revisión todavía** — eso es trabajo aparte.

---

## Evasión de bloqueos

Bloquear no impide crear otra cuenta. Eso no se arregla con SQL, así que la app
ataca el coste en vez de la identidad:

- **Cuota de 30 swipes** las primeras 24 h de vida de la cuenta.
- **Una cuenta nueva no puede abrir conversación**: solo responder. Frena la
  cuenta desechable que hace match y suelta un enlace de estafa.
- **Señal automática**: tres personas distintas bloqueando al mismo perfil en 30
  días generan un caso en la cola, sin que nadie denuncie.
- **Suspensiones** con duración, motivo visible para el sancionado y rastro de
  quién resolvió qué.

Lo que **no** se ha hecho, a propósito: verificación por SMS. Funcionaría, pero
ata un número de teléfono a un perfil de consumo de cannabis con geolocalización.
Esa base de datos es exactamente la que no querrías que se filtrara, ni tener que
entregar si te la reclaman. Para tus usuarios ese riesgo puede pesar más que el
del acosador que se hace otra cuenta. Si algún día hace falta, la decisión ya no
es técnica.

---

## Panel de moderación

Rol en tabla propia (`public.moderadores`), no un booleano en `perfiles`: el rol
no debe viajar nunca en la fila que se sirve a otros usuarios. Alta solo con
`service_role` desde el dashboard.

```sql
insert into public.moderadores (usuario_id, nota)
values ('<uuid del usuario>', 'quien y por que');
```

La pestaña aparece sola al reiniciar la app. Ordena por gravedad, no por fecha:
"parece menor de edad" y "acoso" van primero. Cada caso trae el contexto que
cambia la decisión — cuántos reportes y cuántos bloqueos acumula ese perfil.

La pestaña oculta es comodidad, no seguridad: cada RPC vuelve a comprobar el rol.

---

## Apelaciones

Una sanción sin vía de revisión es una condena. La pantalla de suspensión es
**pantalla completa**, no un aviso al margen: alguien que solo ve un feed vacío
asume que la app falla y se crea otra cuenta, justo lo que la sanción pretendía
evitar.

La garantía real está en el servidor: **quien impone una sanción no puede
resolver su propia apelación**. `perfiles.suspendido_por` guarda el moderador, y
`moderacion_resolver_apelacion()` rechaza el intento con un error, no solo
escondiendo el botón. Una apelación pendiente por persona, para que apelar en
bucle no sea otra vía de spam.

---

## Derechos del usuario (RGPD)

En la app, no en un formulario de contacto:

- **Art. 15, acceso** — `exportar_mis_datos()` devuelve todo en JSON. Incluye si
  hay ubicación, nunca el punto: no tiene sentido proteger las coordenadas en la
  base y luego materializarlas en un fichero que acabará en Drive.
- **Art. 17, supresión** — borrado real con doble confirmación. Cascadea perfil,
  swipes, matches, mensajes, bloqueos y apelaciones.
- **Art. 5.1.e, plazo de conservación** — `pg_cron` purga a diario los reportes y
  apelaciones resueltos hace más de 180 días.

Lo que **no** se borra: los reportes sobre esa persona, anonimizados. Borrarse no
puede ser una vía de escape de la moderación.

---

## Compilar

`.github/workflows/build-apk.yml` compila el APK en un runner de GitHub y lo
publica en Releases. Este proyecto no versiona `android/`: lo regenera
`expo prebuild` en cada build.

Antes de tocar CI conviene ejecutar `npx expo export --platform android`, que
pasa Metro entero sin necesitar el SDK de Android. Los dos primeros builds
cayeron empaquetando el JavaScript y ese comando los habría cazado en local.

Detalles y firma para Play en `docs/BUILD.md`.

---

## Textos legales

`src/legal/textos.ts` es la única fuente. La app los enseña desde ahí y
`npm run legales` genera con ellos `docs/`, que GitHub Pages publica sin
configurar nada: las tiendas exigen un enlace accesible sin instalar la app.

Duplicar los textos a mano en una web garantiza que un día dejen de coincidir
con lo que la aplicación enseña y con la versión que la gente aceptó.

El script termina con código 1 mientras queden corchetes sin rellenar en
`DATOS_RESPONSABLE`: sin esos datos la política incumple el art. 13 del RGPD.

`docs/registro-actividades.md` es el registro del art. 30. No se publica: se
guarda y se enseña a la autoridad de control si lo pide.

---

## Avisos push

El disparador escribe en `notificaciones` y termina. Nadie envía nada dentro de
la transacción: si el envío viviera ahí, un corte de red en Expo bloquearía el
`INSERT` del mensaje y la app dejaría de funcionar por culpa del aviso.

```
mensaje/match/suspensión/apelación
        │  (trigger)
        ▼
public.notificaciones            cola, una fila por aviso
        │
        │  pg_cron cada minuto → notificaciones_despachar()
        │  (solo hace red si hay algo pendiente)
        ▼
pg_net POST → Edge Function `notificar`
        │  reclama en bloque, habla con Expo, cierra las filas
        ▼
Expo Push → APNs / FCM
```

Cuatro decisiones que explican el resto:

- **El cuerpo del aviso nunca lleva el texto del mensaje.** «Ana: te ha
  escrito», no lo que ha escrito. El push se pinta en la pantalla de bloqueo.
- **El token es la clave primaria de `dispositivos`.** Un móvil reinstalado por
  otra persona reutiliza el token; con clave `(usuario, token)` ese aparato
  acabaría recibiendo los avisos de su dueño anterior.
- **Un aviso por conversación sin cerrar.** Veinte mensajes seguidos son un solo
  push mientras no se haya entregado el primero.
- **Reclamar y cerrar son dos pasos.** Entre medias hay una llamada de red que
  puede fallar; un aviso perdido es mejor que uno repetido cada minuto.

El bloqueo se respeta en el propio trigger, y al cerrar sesión el aparato se da
de baja **antes** del `signOut`: después el token de acceso ya no vale y el móvil
seguiría recibiendo los avisos de una cuenta cerrada.

Sin los secretos de Vault o sin la Edge Function desplegada la cola simplemente
se llena y nada revienta. Sin `extra.eas.projectId` en `app.json` la app no pide
tokens y lo dice en el log: los avisos son un extra, no un requisito.

---

## Umbrales

Están en `public.config_moderacion`, fila única editable con `service_role` desde
el dashboard. Cambiar el umbral de la señal o la cuota de cuentas nuevas ya no
exige una migración.

```sql
update public.config_moderacion set bloqueos_para_senal = 5;
```

---

## Verificado contra la base

Ciclo completo con tres usuarios reales: alta de perfil con PostGIS, descubrimiento
(12,0 km entre Bilbao y Getxo), like unilateral sin match, like recíproco creando
match, mensajes, contador de no leídos, marcado de leídos. Más los intentos que
deben fallar: reescribir mensaje ajeno, leer coordenadas de un match, y un tercer
usuario mirando las cuatro tablas.

Moderación, comprobada en los dos sentidos: tras reportar con bloqueo, Ane pasa a
ver 0 chats, 0 mensajes, 0 perfiles y 0 candidatos — y Koldo, el bloqueado,
exactamente lo mismo, sin ver la tabla `bloqueos` ni poder deshacer nada. Su
intento de escribir al match rebota contra la RLS. El desbloqueo restaura el chat
con su historial pero no lo devuelve al feed. Y el reporte sigue en la cola con el
nombre conservado después de que Koldo borre su cuenta.

Fricción y moderación, con cinco usuarios: la señal automática **no** salta al
segundo bloqueo y sí al tercero; una usuaria normal ve la cola vacía y
`soy_moderador() = false`; el moderador ve el caso con su contexto (3 bloqueos, 1
reporte); la suspensión de 7 días bloquea el swipe con `cuenta suspendida`; una
cuenta de 1 hora no puede abrir conversación pero sí responder en cuanto el otro
escribe; y levantar la suspensión la deja a `null`.

Apelaciones y RGPD: el moderador que sancionó ve `puedo_resolver = false` y su
intento de resolver rebota con `no puedes revisar una sancion que impusiste tu`;
otro moderador sí la acepta y la suspensión se levanta con rastro completo. El
borrado de cuenta deja el reporte vivo con `reportado_id = null` y el nombre
conservado — y, tras corregir el `ON DELETE CASCADE`, también sobrevive cuando
quien se borra es el **denunciante**.

`npx tsc --noEmit` pasa limpio en modo estricto.

**Sin verificar:** la app en un dispositivo real. El backend está probado a fondo,
pero los gestos, el teclado y los WebSockets de Realtime necesitan un móvil.

---

## Bugs encontrados y corregidos durante las pruebas

1. `guardar_perfil` — los parámetros OUT (`id`, `nombre`…) colisionaban con las
   columnas homónimas. Resuelto con `#variable_conflict use_column`.
2. `mensajes.creado_en` usaba `now()`, que es el instante de la _transacción_: dos
   mensajes seguidos compartían timestamp y el orden del chat quedaba indefinido.
   Ahora `clock_timestamp()` + desempate por `id`.
3. `listar_matches()` devolvía el primer mensaje en vez del último, consecuencia
   del anterior.
4. Un match podía leer las coordenadas exactas de la otra persona. Cerrado con
   GRANT columnar; obligó a pasar `guardar_perfil` a `SECURITY DEFINER`.
5. `reportes.reportado_id` era `not null` con `on delete set null`: habría
   reventado al borrarse la cuenta denunciada.
6. `reportes.reportante_id` tenía `on delete cascade`. Si la persona acosada
   borraba su cuenta, **sus denuncias se borraban con ella**. Ahora `set null`.
7. `moderacion_resolver_apelacion` comparaba un `case` de tipo `text` contra el
   enum `estado_apelacion`, sin cast.
8. La función del trigger `tg_senal_bloqueos_repetidos()` quedaba expuesta en
   `/rest/v1/rpc/` — Postgres concede `EXECUTE` a `PUBLIC` por defecto. Cualquiera,
   incluso sin sesión, podía fabricar reportes automáticos falsos. Revocada.

---

## Pendiente

- No hay fotos en el modelo. Las tarjetas son tipográficas por diseño, pero si
  quieres imágenes hace falta Supabase Storage y una política de acceso aparte.
- **Los avisos push no se han probado en un aparato real.** Falta subir la clave
  de FCM V1 a EAS o meter `google-services.json`; el APK actual instala y
  funciona, pero no recibe avisos. El recorrido de base
  de datos está verificado contra Postgres; lo que falta es un `eas build` con
  `extra.eas.projectId` puesto y las credenciales de APNs/FCM subidas.
- **Los textos legales son borradores.** Están estructurados, versionados y ya
  se publican solos en `docs/`, pero les faltan los datos del responsable y la
  revisión de un abogado.
- **La edad sigue siendo autodeclarada.** Ahora se pide fecha de nacimiento y el
  corte de 18 se comprueba en servidor, pero un menor decidido pone otra fecha.
  Sin verificación documental no hay más.
- Los umbrales por defecto (3 bloqueos, 30 swipes, 24 h) siguen siendo una
  conjetura razonable, aunque ahora se ajusten sin migrar.
- El radio de descubrimiento está fijo en 50 km (`useDescubrimiento.ts`).
