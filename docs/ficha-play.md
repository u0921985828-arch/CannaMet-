# Ficha de Google Play — CannaMet

Borrador para rellenar Play Console. **Solo Google Play**: la App Store queda
fuera por decisión de producto, porque su guideline 1.4.3 prohíbe las apps que
fomenten el consumo de drogas ilegales y ahí la identidad cannábica no cabe.

La línea que no se puede cruzar en Play es una sola: **facilitar la venta**.
Carrito, catálogo de producto, precios, reparto, recogida, contacto con
dispensarios. Nada de eso existe en CannaMet ni debe insinuarlo la ficha.
Hablar de comunidad, de cultura y de conocer gente sí está permitido —Weedmaps
y Leafly siguen publicadas—.

---

## Textos

**Nombre de la app** (30 caracteres máx.)

```
CannaMet
```

**Descripción corta** (80 caracteres máx.)

```
Conoce gente afín cerca de ti. Comunidad para mayores de 18 años.
```

**Descripción completa** (4000 caracteres máx.)

```
CannaMet conecta a personas adultas con intereses afines que están cerca.

CÓMO FUNCIONA
Creas un perfil con tu nombre, tu edad, una foto si quieres y una descripción
breve. Eliges qué tipo
de planes te van: casa, monte, música, quedadas o cocinar y crear. Ves perfiles
cercanos, y cuando el interés es mutuo se abre un chat privado.

TU UBICACIÓN NO SE COMPARTE
Otras personas ven a cuántos kilómetros estás, redondeado. Nunca tu punto
exacto. Las coordenadas no salen del servidor: ni siquiera las personas con las
que haces match pueden acceder a ellas, y tampoco aparecen en la descarga de
tus datos.

SOLO MAYORES DE 18 AÑOS
Pedimos la fecha de nacimiento y el corte se comprueba en el servidor, no solo
en el formulario. Las cuentas denunciadas por pertenecer a menores se revisan
las primeras y se suspenden sin previo aviso.

SEGURIDAD Y MODERACIÓN
Puedes bloquear y denunciar a cualquier persona desde la propia app. Revisamos
las denuncias en menos de 24 horas y las de acoso o sospecha de minoría de edad
van al principio de la cola. Si te sancionamos te decimos por qué y puedes
apelar; la apelación la revisa una persona distinta de la que aplicó la
sanción.

TUS DATOS
Puedes descargar todo lo que tenemos sobre ti y borrar tu cuenta desde el propio
perfil, sin escribir a nadie. El borrado es inmediato. Los datos están alojados
en la Unión Europea.

QUÉ NO ES CANNAMET
No es un mercado. Está prohibido usar la aplicación para ofrecer, vender,
comprar, intercambiar o promocionar sustancias de cualquier tipo, sean legales
o no. Detectarlo implica la retirada inmediata de la cuenta. CannaMet tampoco
verifica la identidad de nadie: quedar con alguien que has conocido aquí es tu
decisión y tu responsabilidad.
```

> El bloque final no es un descargo de responsabilidad de adorno: es la
> diferencia entre una app de comunidad y una que facilita la venta, y conviene
> que el revisor la lea sin buscarla.

---

## Capturas

Cinco, en este orden, que es el del recorrido real:

1. Alta, paso 1 de 5 — la barra de progreso deja claro que es corto.
2. Descubrir — una tarjeta con nombre, edad, distancia y ambiente.
3. Chat abierto.
4. Perfil → Tus datos, con «Descargar mis datos» y «Borrar cuenta» a la vista.
5. Modal de denuncia con los motivos desplegados.

Sin hojas, sin humo, sin cogollos, sin «420» ni nombres de variedades. La
identidad la lleva el nombre; la ficha no necesita más y cada elemento gráfico
de más es una razón para que el revisor mire con lupa.

---

## Clasificación por edad

Cuestionario de la IARC. **Responder con la verdad**: mentir aquí no es una
infracción menor, es motivo de retirada, y se comprueba.

| Pregunta                                               | Respuesta                                     |
| ------------------------------------------------------ | --------------------------------------------- |
| ¿Interacción entre usuarios?                           | Sí — chat privado entre personas con match    |
| ¿Compartir ubicación con otros usuarios?               | Sí — distancia aproximada, nunca el punto     |
| ¿Contenido generado por usuarios sin moderar a priori? | Sí — con denuncia, bloqueo y revisión en 24 h |
| ¿Referencias a drogas?                                 | Sí                                            |
| ¿Fomenta el consumo de drogas?                         | No                                            |
| ¿Facilita la compra de drogas?                         | No                                            |
| ¿Contenido sexual?                                     | No                                            |
| ¿Compras dentro de la app?                             | No                                            |
| Clasificación esperada                                 | **18+**                                       |

Marcar además la app como **app de citas**, si Play lo pregunta en el
cuestionario de contenido: lo es funcionalmente, y ocultarlo no sale gratis.

---

## Seguridad de los datos (Data Safety)

| Dato                           | Se recoge | Se comparte | Obligatorio | Para qué                         |
| ------------------------------ | --------- | ----------- | ----------- | -------------------------------- |
| Correo electrónico             | Sí        | No          | Sí          | Gestión de la cuenta             |
| Nombre mostrado                | Sí        | No          | Sí          | Funciones de la app              |
| Fecha de nacimiento            | Sí        | No          | Sí          | Verificar mayoría de edad        |
| Ubicación aproximada           | Sí        | No          | No          | Funciones de la app              |
| Mensajes                       | Sí        | No          | Sí          | Funciones de la app              |
| Identificadores de dispositivo | Sí        | Sí          | No          | Notificaciones push (Expo → FCM) |
| **Datos de salud**             | **No**    | **No**      | —           | —                                |
| Fotos                          | Sí        | No          | No          | Foto de perfil, opcional         |

Declarar también:

- Cifrado en tránsito: **sí**.
- Se puede solicitar la eliminación de los datos: **sí**, y desde la propia app.
- El token de notificaciones viaja a Expo y de ahí a FCM: por eso
  «identificadores de dispositivo» sí se marca como compartido.

La casilla de datos de salud va en **No** y eso es verificable: el perfil no
recoge consumo de sustancias, y el esquema de la base de datos no tiene ninguna
columna donde guardarlo.

---

## Antes de enviar

- [ ] Rellenar `DATOS_RESPONSABLE` en `src/legal/textos.ts` y ejecutar
      `npm run legales`.
- [ ] Publicar `docs/` en GitHub Pages y pegar las dos URL en la ficha
      (política de privacidad es campo obligatorio en Play).
- [ ] Cuenta de desarrollador verificada. Ojo: Play publica el nombre y la
      dirección del desarrollador en la ficha. Ver la conversación sobre
      domiciliación antes de decidir con qué cuenta subes.
- [ ] Subir el **AAB** del perfil `production`, no el APK
      (`docs/BUILD.md`), firmado con tu propio keystore.
- [ ] Correo de contacto operativo: es donde Play te escribe si hay
      reclamaciones.
