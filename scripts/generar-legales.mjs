/**
 * Genera las páginas públicas de términos y privacidad a partir de
 * `src/legal/textos.ts`, que sigue siendo la única fuente.
 *
 * Las tiendas exigen un enlace accesible sin instalar la app. Duplicar los
 * textos a mano en una web garantiza que un día dejen de coincidir con lo que
 * la aplicación enseña y con la versión que la gente aceptó.
 *
 *   npm run legales
 *
 * La salida va a `docs/`, que es lo que GitHub Pages publica sin configuración.
 */
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SALIDA = path.join(RAIZ, 'docs');
const TEMP = path.join(RAIZ, 'node_modules', '.cache-legales');

/** `textos.ts` es TypeScript; se transpila con el compilador que ya está instalado. */
async function cargarTextos() {
  const fuente = readFileSync(path.join(RAIZ, 'src/legal/textos.ts'), 'utf8');
  const { outputText } = ts.transpileModule(fuente, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  mkdirSync(TEMP, { recursive: true });
  const destino = path.join(TEMP, 'textos.mjs');
  writeFileSync(destino, outputText);
  try {
    return await import(pathToFileURL(destino).href);
  } finally {
    rmSync(TEMP, { recursive: true, force: true });
  }
}

const escapar = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const enLinea = (t) => escapar(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const celdas = (fila) =>
  fila
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

/**
 * Markdown mínimo: el que usan estos dos textos y ninguno más. Una librería
 * entera para seis construcciones es dependencia que hay que mantener.
 */
function aHtml(markdown) {
  const lineas = markdown.split('\n');
  const salida = [];
  let i = 0;

  while (i < lineas.length) {
    const linea = lineas[i];

    if (!linea.trim()) {
      i++;
      continue;
    }

    if (linea.startsWith('## ')) {
      salida.push(`<h2>${enLinea(linea.slice(3))}</h2>`);
      i++;
      continue;
    }

    if (linea.startsWith('# ')) {
      salida.push(`<h1>${enLinea(linea.slice(2))}</h1>`);
      i++;
      continue;
    }

    if (linea.startsWith('|')) {
      const cabecera = celdas(linea);
      i += 2; // la fila de guiones no se pinta
      const filas = [];
      while (i < lineas.length && lineas[i].startsWith('|')) {
        filas.push(celdas(lineas[i]));
        i++;
      }
      salida.push(
        '<table><thead><tr>' +
          cabecera.map((c) => `<th>${enLinea(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          filas
            .map((f) => `<tr>${f.map((c) => `<td>${enLinea(c)}</td>`).join('')}</tr>`)
            .join('') +
          '</tbody></table>',
      );
      continue;
    }

    if (linea.startsWith('- ')) {
      const puntos = [];
      while (i < lineas.length && lineas[i].startsWith('- ')) {
        puntos.push(`<li>${enLinea(lineas[i].slice(2))}</li>`);
        i++;
      }
      salida.push(`<ul>${puntos.join('')}</ul>`);
      continue;
    }

    salida.push(`<p>${enLinea(linea)}</p>`);
    i++;
  }

  return salida.join('\n');
}

const PLANTILLA = (titulo, cuerpo) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo)} — MATCH</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0 auto; max-width: 46rem; padding: 3rem 1.25rem 6rem;
    background: #14110E; color: #EDE6DA; line-height: 1.65;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  h1 { font-size: 1.9rem; margin: 0 0 2rem; letter-spacing: -0.01em; }
  h2 { font-size: 1.15rem; margin: 2.5rem 0 0.75rem; color: #D99B3C; }
  p, li { color: #D6CCBC; }
  strong { color: #EDE6DA; }
  ul { padding-left: 1.1rem; }
  li { margin: 0.35rem 0; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.94rem; }
  th, td { text-align: left; padding: 0.55rem 0.6rem; border-bottom: 1px solid #2E2822; vertical-align: top; }
  th { color: #D99B3C; font-weight: 600; }
  a { color: #D99B3C; }
  nav { margin-bottom: 2.5rem; font-size: 0.9rem; }
  nav a { margin-right: 1.25rem; }
  footer { margin-top: 4rem; padding-top: 1.5rem; border-top: 1px solid #2E2822;
           color: #8A8078; font-size: 0.85rem; }
</style>
</head>
<body>
<nav><a href="./index.html">MATCH</a><a href="./terminos.html">Condiciones</a><a href="./privacidad.html">Privacidad</a></nav>
${cuerpo}
<footer>MATCH — aplicación social para mayores de 18 años.</footer>
</body>
</html>
`;

const { TERMINOS, PRIVACIDAD, VERSION_TERMINOS, VERSION_PRIVACIDAD, DATOS_RESPONSABLE } =
  await cargarTextos();

mkdirSync(SALIDA, { recursive: true });
writeFileSync(
  path.join(SALIDA, 'terminos.html'),
  PLANTILLA('Condiciones de uso', aHtml(TERMINOS)),
);
writeFileSync(
  path.join(SALIDA, 'privacidad.html'),
  PLANTILLA('Política de privacidad', aHtml(PRIVACIDAD)),
);
writeFileSync(
  path.join(SALIDA, 'index.html'),
  PLANTILLA(
    'Documentos legales',
    aHtml(
      `# MATCH\n\nAplicación social para mayores de 18 años.\n\n## Documentos\n\n- [Condiciones de uso](./terminos.html) — versión ${VERSION_TERMINOS}\n- [Política de privacidad](./privacidad.html) — versión ${VERSION_PRIVACIDAD}\n\n## Contacto\n\nDudas: ${DATOS_RESPONSABLE.emailContacto}\n\nAbusos: ${DATOS_RESPONSABLE.emailAbusos}\n`,
    ).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'),
  ),
);

const huecos = JSON.stringify(DATOS_RESPONSABLE).match(/\[[^\]]+\]/g);
if (huecos) {
  console.warn(
    `\n⚠  Quedan ${huecos.length} huecos sin rellenar en DATOS_RESPONSABLE: ${huecos.join(', ')}` +
      '\n   Las páginas se han generado igual, pero así incumplen el art. 13 del RGPD.\n',
  );
  process.exitCode = 1;
}

console.warn(
  `docs/ generado desde src/legal/textos.ts (t${VERSION_TERMINOS} · p${VERSION_PRIVACIDAD})`,
);
