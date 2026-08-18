# Registro de actividades de tratamiento

Artículo 30 del RGPD. **Borrador**: hay que completar los corchetes y revisarlo
con el abogado junto con los otros dos textos. No se publica en la web; se
guarda y se enseña a la autoridad de control si la reclama.

Última revisión: [FECHA] · Versión de los textos legales: 2026-08-2

---

## 1. Responsable del tratamiento

| Campo                           | Valor                            |
| ------------------------------- | -------------------------------- |
| Identidad                       | [NOMBRE O RAZÓN SOCIAL]          |
| NIF/CIF                         | [NIF/CIF]                        |
| Domicilio                       | [DOMICILIO COMPLETO]             |
| Contacto                        | [correo@dominio]                 |
| Delegado de protección de datos | [No procede / nombre y contacto] |

> Un DPD solo es obligatorio si hay observación habitual y sistemática de
> interesados a gran escala, o tratamiento a gran escala de categorías
> especiales. CannaMet no trata categorías especiales; el volumen decide el resto.
> Que lo confirme el abogado.

---

## 2. Actividades

### 2.1 Gestión de cuentas de personas usuarias

- **Fines:** alta, autenticación, verificación de mayoría de edad y baja.
- **Categorías de interesados:** personas usuarias mayores de 18 años.
- **Categorías de datos:** email, contraseña (con hash, gestionada por Supabase
  Auth), nombre mostrado, fecha de nacimiento, edad derivada, biografía,
  ambiente preferido.
- **Base jurídica:** art. 6.1.b — ejecución del contrato.
- **Plazo:** mientras la cuenta esté activa. El borrado desde la app es
  inmediato e irreversible (`borrar_mi_cuenta`).
- **Destinatarios:** Supabase (encargado).

### 2.2 Descubrimiento por cercanía

- **Fines:** ordenar perfiles por distancia.
- **Categorías de datos:** punto geográfico aproximado asociado a la cuenta.
- **Base jurídica:** art. 6.1.a — consentimiento, otorgado en el permiso de
  ubicación del sistema operativo y retirable desde los ajustes del móvil.
- **Medida relevante:** las coordenadas **no salen nunca al cliente**. Están
  revocadas a nivel de columna y el descubrimiento devuelve una distancia en
  kilómetros calculada en el servidor. Tampoco se incluyen en la exportación
  del art. 15.
- **Plazo:** mientras la cuenta esté activa.

### 2.3 Mensajería entre personas con match

- **Fines:** prestar el servicio de chat.
- **Categorías de datos:** contenido de los mensajes, marca de tiempo, estado
  de leído.
- **Base jurídica:** art. 6.1.b — ejecución del contrato.
- **Plazo:** mientras exista la cuenta de cualquiera de las dos partes.
- **Destinatarios:** la otra persona del match. Nadie más.

### 2.4 Seguridad, bloqueos y denuncias

- **Fines:** proteger a las personas usuarias de acoso, fraude, suplantación y
  cuentas de menores; cumplir las políticas de las tiendas de aplicaciones.
- **Categorías de datos:** identificador de quien denuncia y de la persona
  denunciada, nombre mostrado en el momento de la denuncia, motivo, detalle
  libre, historial de bloqueos, resolución y nota de moderación.
- **Base jurídica:** art. 6.1.f — interés legítimo en la seguridad de las
  personas usuarias y de terceros. Ponderación: el interés de quien es
  denunciado en que el expediente desaparezca cede frente al de quien podría
  sufrir el mismo comportamiento después.
- **Plazo:** 180 días desde la resolución (`dias_retencion_reportes`,
  ajustable). Las denuncias **sobre** una persona sobreviven al borrado de su
  cuenta, ya anonimizadas: el identificador queda a `NULL` y solo permanece el
  nombre mostrado en su día. Borrarse no cancela una revisión en curso.
- **Decisiones automatizadas:** ninguna con efectos jurídicos. El sistema genera
  una señal automática cuando varias personas distintas bloquean el mismo perfil
  en una ventana de tiempo, pero esa señal solo **encola** el caso: la sanción
  siempre la decide una persona.

### 2.5 Suspensiones y apelaciones

- **Fines:** aplicar y revisar sanciones.
- **Categorías de datos:** fecha de fin de suspensión, motivo, texto de la
  apelación, resolución y nota.
- **Base jurídica:** art. 6.1.b y art. 6.1.f.
- **Garantía:** quien impuso la sanción no puede resolver su apelación; está
  impedido en la base de datos, no solo en el procedimiento.
- **Plazo:** igual que las denuncias.

### 2.6 Prueba del consentimiento legal

- **Fines:** demostrar la aceptación de condiciones y política de privacidad
  (art. 7.1).
- **Categorías de datos:** identificador, versión aceptada de cada texto y
  fecha. **No se guarda la dirección IP**: sería un dato personal adicional que
  no hace falta para probar nada.
- **Base jurídica:** art. 6.1.c — obligación legal.
- **Plazo:** mientras la cuenta esté activa; histórico inmutable por versión.

### 2.7 Avisos push

- **Fines:** avisar de mensajes, matches, suspensiones y apelaciones resueltas.
- **Categorías de datos:** token de aparato de Expo, plataforma, fechas de alta
  y último uso; cola de avisos con título y cuerpo.
- **Base jurídica:** art. 6.1.b para los avisos del servicio; el permiso del
  sistema operativo es revocable en cualquier momento y, al cerrar sesión, el
  aparato se da de baja solo.
- **Medida relevante:** el cuerpo del aviso **nunca contiene el texto del
  mensaje**, solo quién escribe, porque el push se muestra en la pantalla de
  bloqueo.
- **Plazo:** los avisos se borran a los 30 días; el token, al desinstalar la
  app, al cerrar sesión o cuando Expo responde `DeviceNotRegistered`.

---

## 3. Categorías especiales (art. 9)

**Ninguna.** El perfil no declara consumo de sustancias ni ningún otro dato de
salud. El campo `preferencia_consumo` se eliminó del modelo y de la base; en su
lugar hay `ambiente`, que describe contexto (casa, monte, música, quedadas,
crear) sin mencionar sustancias. No se recogen datos de orientación sexual,
ideología, religión, origen étnico ni biometría.

---

## 4. Transferencias internacionales

**Ninguna prevista.** Los datos se alojan en la Unión Europea: Supabase, región
`eu-west-3` (París). Si en el futuro se contrata un subencargado fuera del EEE,
hay que revisar este apartado y las cláusulas contractuales tipo.

---

## 5. Encargados del tratamiento

| Encargado                   | Servicio                                | Ubicación  | Contrato                             |
| --------------------------- | --------------------------------------- | ---------- | ------------------------------------ |
| Supabase                    | Base de datos, autenticación, funciones | UE (París) | DPA — [firmado el FECHA / PENDIENTE] |
| Expo (Expo Push)            | Entrega de notificaciones push          | EE. UU.    | [Revisar términos y DPA]             |
| Apple (APNs) / Google (FCM) | Transporte de las notificaciones        | —          | [Revisar]                            |

> El token de push viaja a Expo y de ahí a APNs o FCM. Como el cuerpo del aviso
> no lleva el contenido del mensaje, lo que sale es el nombre mostrado de quien
> escribe. Aun así, el abogado debe confirmar la vía de esta transferencia.

---

## 6. Medidas técnicas y organizativas (art. 32)

- Row Level Security activa en todas las tablas; cada persona solo alcanza sus
  filas y las de sus matches.
- Permisos recortados **por columna**: las coordenadas y el identificador del
  moderador que sanciona no se pueden leer desde la aplicación.
- Escrituras sensibles solo por funciones `security definer` con `search_path`
  fijado; el cliente no hace `INSERT` directo en swipes, matches, bloqueos,
  denuncias, apelaciones, aceptaciones, aparatos ni avisos.
- Contraseñas gestionadas por Supabase Auth; el proyecto no las almacena.
- Cifrado en tránsito (TLS) y en reposo, a cargo del proveedor.
- Secretos de servidor en Vault, no en el código ni en el repositorio.
- Límites contra el abuso: cuota de swipes para cuentas nuevas, tope de
  denuncias por hora, y una cuenta nueva no puede abrir conversación, solo
  responder.
- Purga automática diaria de denuncias y apelaciones resueltas y de avisos
  caducados.

---

## 7. Brechas de seguridad

Notificación a la AEPD en 72 horas desde que se tenga constancia (art. 33) y
comunicación a las personas afectadas si el riesgo es alto (art. 34).
Responsable de la notificación: [NOMBRE].
