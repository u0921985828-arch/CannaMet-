/**
 * BORRADORES. No son documentos jurídicos válidos hasta que los revise un
 * abogado con los datos reales del responsable del tratamiento.
 *
 * Los huecos [ENTRE CORCHETES] son obligatorios: sin ellos la política de
 * privacidad incumple el art. 13 RGPD y las tiendas la rechazan.
 *
 * Si cambias un texto, sube la versión en config_moderacion. La app detecta
 * el cambio y vuelve a pedir aceptación sola.
 */

export const VERSION_TERMINOS = '2026-08-2';
export const VERSION_PRIVACIDAD = '2026-08-2';

/** Rellenar antes de publicar. Aparecen en los textos y en las fichas de tienda. */
export const DATOS_RESPONSABLE = {
  titular: '[NOMBRE O RAZÓN SOCIAL]',
  nif: '[NIF/CIF]',
  domicilio: '[DOMICILIO COMPLETO]',
  emailContacto: '[correo@dominio]',
  emailAbusos: '[abusos@dominio]',
  urlPrivacidad: '[https://dominio/privacidad]',
  urlTerminos: '[https://dominio/terminos]',
} as const;

export const TERMINOS = `# Condiciones de uso

Versión ${VERSION_TERMINOS}

## 1. Quién presta el servicio
MATCH es una aplicación operada por ${DATOS_RESPONSABLE.titular}, NIF ${DATOS_RESPONSABLE.nif}, con domicilio en ${DATOS_RESPONSABLE.domicilio}. Puedes escribirnos a ${DATOS_RESPONSABLE.emailContacto}.

## 2. Qué es y qué no es MATCH
MATCH sirve para conocer personas cercanas con intereses afines. **No es un mercado.** Está prohibido usar la aplicación para ofrecer, vender, comprar, intercambiar o promocionar sustancias de cualquier tipo, sean legales o no, gratis o de pago. Detectarlo implica la retirada inmediata de la cuenta.

MATCH no verifica la identidad de las personas usuarias. Quedar con alguien que has conocido aquí es tu decisión y tu responsabilidad.

## 3. Edad mínima
Solo para mayores de 18 años. Facilitar una fecha de nacimiento falsa es motivo de cierre inmediato de la cuenta. Si detectamos o nos informan de que una cuenta pertenece a un menor, la suspendemos sin previo aviso.

## 4. Tolerancia cero con el contenido y la conducta abusiva
No se permite:
- acoso, amenazas, insultos o incitación al odio;
- contenido sexual no solicitado;
- suplantación de identidad o perfiles falsos;
- spam, publicidad, estafas o petición de dinero;
- cualquier contenido que sexualice a menores, que se comunica a las autoridades.

Puedes **bloquear** a cualquier persona y **denunciar** cualquier perfil o conversación desde la propia aplicación. Revisamos las denuncias y actuamos, como máximo, en 24 horas. También puedes escribir a ${DATOS_RESPONSABLE.emailAbusos}.

Al crear una cuenta aceptas estas normas y aceptas que no toleramos contenido ni conductas abusivas.

## 5. Suspensiones y apelación
Podemos suspender una cuenta que incumpla estas condiciones. Te informamos del motivo y de la duración dentro de la aplicación, y puedes apelar desde ahí. La apelación la revisa una persona distinta de la que aplicó la sanción.

## 6. Tu contenido
Lo que escribes sigue siendo tuyo. Nos concedes permiso para almacenarlo y mostrarlo a las personas con las que tienes match, con el único fin de prestar el servicio.

## 7. Cierre de la cuenta
Puedes borrar tu cuenta en cualquier momento desde Perfil → Tus datos. El borrado es inmediato e irreversible. Las denuncias presentadas sobre tu cuenta se conservan sin tus datos personales: borrarse no cancela una revisión en curso.

## 8. Limitación de responsabilidad
MATCH se presta "tal cual". No garantizamos disponibilidad ininterrumpida ni respondemos de lo que ocurra en los encuentros que se acuerden a través de la aplicación, en la medida en que lo permita la ley aplicable.

## 9. Ley aplicable
Legislación española. Si eres consumidor, conservas los derechos que te reconoce la normativa de tu lugar de residencia.

## 10. Cambios
Si modificamos estas condiciones, te pediremos que las aceptes de nuevo antes de seguir usando la aplicación.
`;

export const PRIVACIDAD = `# Política de privacidad

Versión ${VERSION_PRIVACIDAD}

## Responsable
${DATOS_RESPONSABLE.titular}, NIF ${DATOS_RESPONSABLE.nif}, ${DATOS_RESPONSABLE.domicilio}. Contacto: ${DATOS_RESPONSABLE.emailContacto}.

## Qué datos tratamos

| Dato | Para qué | Base legal |
|---|---|---|
| Email y contraseña | Crear y proteger tu cuenta | Ejecución del contrato |
| Nombre, fecha de nacimiento, biografía | Mostrar tu perfil y verificar que eres mayor de edad | Ejecución del contrato |
| Ambiente preferido | Mostrarlo en tu perfil | Ejecución del contrato |
| Ubicación aproximada | Ordenar perfiles por cercanía | Consentimiento |
| Mensajes | Prestar el servicio de chat | Ejecución del contrato |
| Bloqueos y denuncias | Seguridad de las personas usuarias | Interés legítimo |

## Lo que no te pedimos
No preguntamos por tu salud, ni por consumo de sustancias, ni por orientación, ideología, religión ni origen. No tratamos ninguna categoría especial de datos del artículo 9 del RGPD.

## Tu ubicación
Guardamos un punto geográfico asociado a tu cuenta. **Nunca se lo mostramos a nadie.** Otras personas solo ven una distancia aproximada en kilómetros, calculada en nuestro servidor. Ni siquiera las personas con las que tienes match pueden acceder a tus coordenadas.

Puedes usar la aplicación sin dar la ubicación, aunque entonces no verás perfiles.

## Con quién compartimos
Con nadie, salvo con nuestro proveedor de infraestructura, Supabase, que actúa como encargado del tratamiento. Los datos se alojan en la Unión Europea (París, eu-west-3). No vendemos datos ni hacemos publicidad.

## Cuánto tiempo
- Perfil, mensajes y matches: mientras tengas la cuenta activa.
- Denuncias resueltas: [180] días desde su resolución.
- Denuncias sobre ti: se conservan sin tus datos personales aunque borres la cuenta, por interés legítimo en la seguridad de otras personas.

## Tus derechos
Acceso, rectificación, supresión, oposición, limitación y portabilidad. Dos de ellos están directamente en la aplicación, en Perfil → Tus datos: **descargar tus datos** y **borrar la cuenta**. Para el resto, escríbenos a ${DATOS_RESPONSABLE.emailContacto}.

Si crees que no tratamos bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).

## Menores
La aplicación es solo para mayores de 18 años. Si detectamos una cuenta de un menor, la eliminamos y borramos sus datos.

## Seguridad
El acceso a los datos está restringido a nivel de base de datos: cada persona solo puede leer lo suyo y lo de sus matches. Las coordenadas están excluidas por completo del acceso desde la aplicación.
`;
