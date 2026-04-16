import { bundle } from 'emit';
import { transform as minifyCss } from 'lightningcss';

const DEBUG = Deno.env.get('DEBUG');
const { compilerOptions, imports } = JSON.parse(Deno.readTextFileSync('deno.json'));
const bundleOptions = { compilerOptions, importMap: { imports } };

function logPublicContent() {
  console.table(
    Array.from(Deno.readDirSync('public')).reduce((table, entry) => {
      const { size, mtime } = Deno.statSync('public/' + entry.name);
      table[entry.name] = {
        size,
        modified: new Date(mtime).toLocaleTimeString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
          fractionalSecondDigits: 3,
        }),
      };
      return table;
    }, {}),
  );
}

// TODO: replace deprecated emit file
async function emit(src, out) {
  return Deno.writeTextFile(out, (await bundle(src, bundleOptions)).code);
}

async function downloadAndMinify(
  src,
  out,
  { transform = (uint8array) => uint8array, minifyDownload = false } = {},
) {
  Deno.mkdirSync(out.split('/').slice(0, -1).join('/'), { recursive: true });
  const resolvedUrl = import.meta.resolve(src);
  const res = await fetch(resolvedUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${resolvedUrl}. ${res.status} ${res.statusText}`);
  }
  let transformed = transform(new Uint8Array(await res.arrayBuffer()));
  if (minifyDownload) {
    const { code } = minifyCss({
      minify: true,
      code: transformed,
      filename: out,
    });
    transformed = code;
  }
  Deno.writeFileSync(out, transformed);
}

if (DEBUG) {
  logPublicContent();

  new Deno.Command('git', {
    args: ['branch', '--all'],
  }).spawn();
}

const result = await Promise.allSettled([
  emit('app/src/main.ts', 'public/main.bundle.js'),
  emit('app/src/webview.ts', 'public/webview.js'),
  emit('client/src/script.ts', 'public/script.bundle.js'),
  downloadAndMinify('github-markdown-css', 'public/github-markdown.min.css', {
    transform: (uint8array) => {
      return new TextEncoder().encode(
        new TextDecoder()
          .decode(uint8array)
          .replace('@media (prefers-color-scheme:dark)', '[data-theme=dark]')
          .replace('@media (prefers-color-scheme:light)', '[data-theme=light]'),
      );
    },
    minifyDownload: true,
  }),
  downloadAndMinify('mermaid-min', 'public/mermaid.min.js'),
  downloadAndMinify('katex-css', 'public/katex.min.css', { minifyDownload: true }),
  ...[
    'KaTeX_AMS-Regular.woff2',
    'KaTeX_Caligraphic-Bold.woff2',
    'KaTeX_Caligraphic-Regular.woff2',
    'KaTeX_Fraktur-Bold.woff2',
    'KaTeX_Fraktur-Regular.woff2',
    'KaTeX_Main-Bold.woff2',
    'KaTeX_Main-BoldItalic.woff2',
    'KaTeX_Main-Italic.woff2',
    'KaTeX_Main-Regular.woff2',
    'KaTeX_Math-BoldItalic.woff2',
    'KaTeX_Math-Italic.woff2',
    'KaTeX_SansSerif-Bold.woff2',
    'KaTeX_SansSerif-Italic.woff2',
    'KaTeX_SansSerif-Regular.woff2',
    'KaTeX_Script-Regular.woff2',
    'KaTeX_Size1-Regular.woff2',
    'KaTeX_Size2-Regular.woff2',
    'KaTeX_Size3-Regular.woff2',
    'KaTeX_Size4-Regular.woff2',
    'KaTeX_Typewriter-Regular.woff2',
  ].map((font) =>
    downloadAndMinify(
      `https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/${font}`,
      `public/fonts/${font}`,
    ),
  ),
]);

result.forEach((res) => {
  if (res.status === 'rejected') console.error(res.reason);
});

if (DEBUG) {
  logPublicContent();
}
