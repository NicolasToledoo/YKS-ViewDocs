# Plano: Suporte a mais formatos de e-books (MOBI, FB2, CBZ)

## Objetivo
Expandir o YKS-ViewDocs para ler os principais formatos de e-book:
**MOBI, AZW, AZW3 (KF8)** e **FB2**, mais **CBZ** (comics). PDF e EPUB já estão implementados.

---

## Escopo recomendado

| Formato | Estratégia | Lib externa? | Síncrono? |
|---------|-----------|--------------|-----------|
| MOBI / AZW / AZW3 (KF8) | `foliate-js/mobi.js` (auto-detecta MOBI vs combo/KF8, descompacta PalmDOC + HUFF/CDIC) | Sim (fflate usado para `unzlib`) | Assíncrono (`MOBI.open`) |
| FB2 | Parser **caseiro** (DOMParser + XML) — estilo do `rtf-parser.js` | Não | Sim (imagem inline base64 → data URI) |
| CBZ | Reutiliza `fflate.unzipSync` (já incluído) para listar/descompactar imagens | Não | Sim |
| FB2 `.fb2.zip` (facultativo) | `fflate.gunzipSync` + parser FB2 | Não | Sim |

### Fora de escopo (complexos/decodificadores pesados)
- **CBR/RAR** – exigiria `unrar` em JS (não viável sem build).
- **DjVu** – precisa de decoder (djvu.js/wasm) → muito pesado.
- **LIT** (Microsoft/OCF) – raramente usado + encriptação histórica.
- **DRM / AZW criptografado** – não decifrável sem chaves → **mostrar erro amigável** ("e-book protegido por DRM").

---

## Decisões de arquitetura

### 1. Carregamento de libs
- **ESM (só MOBI):** `foliate-js/mobi.js` é **ESM puro e auto-contido** (sem imports internos — validado). Carrega‑se via **dynamic `import()`** (novo helper `loadModule(url)` usando `chrome.runtime.getURL`), pois `<script>` não carrega ESM. A CSP padrão MV3 (`script-src 'self'`) permite `import()` de recursos `self`. Confirma‑se exports `{ MOBI, isMOBI }` (testado).
- **UMD (existente):** `fflate`, `mammoth`, etc. continuam via `loadScript` (global).
- Nenhuma lib nova pode ser carregada de CDN (CSP `script-src 'self'`). Tudo em `lib/` e já em `web_accessible_resources`.

### 2. API do MOBI (foliate-js)
```js
import { isMOBI, MOBI } from chrome-extension-url('lib/foliate-mobi.js');
const blob = new Blob([arrayBuffer], { type: 'application/x-mobipocket-ebook' });
if (!(await isMOBI(blob))) throw new Error('Arquivo MOBI inválido');
const mobi = new MOBI({ unzlib: window.fflate.unzlibSync }); // KF8 fonts
const book = await mobi.open(blob);        // retorna leitor MOBI6/KF8
// book.sections[].load() -> Document ; book.replaceResources(doc) -> imagens recindex
// book.metadata, book.getCover()
```
- Imagens: usar `book.replaceResources(doc)` (blob URLs) **ou** resolver `book.mobi.loadResource(idx)` → data URI reaproveitando `toBase64` (para consistência e evitar *revocation* de blob URLs). Decidir na implementação; opção data-URI recomendada por consistência com EPUB.
- DRM: `mobi.open()` lança em arquivos encriptados → capturar e mostrar erro.

### 3. Imagens / recursos em geral
Unificar em **data URIs base64** (mesmo padrão do `lib/epub-reader.js`): `<img>` e URLs de CSS (`url()`). Isso evita depender de `blob:`/`<base>` e mantém tudo inline e offline. `btoa` sobre Latin1 já funciona em Chrome (mesmo padrão usado por `arrayBufferToBase64`).

### 4. Integração no viewer
- `renderX(ext, data)` no `switch` de `renderDoc` (`renderMOBI`, `renderFB2`, `renderCBZ`), seguindo o padrão async de `renderEPUB`.
- `ensureX()` lazy-load (novo `loadModule` para ESM; `loadScript` para UMD/auto-contido).
- Saída renderizada dentro de `.doc-content` (limpeza via `clearContent` já existente).

---

## Passos de implementação

1. **Vender foliate-js**
   - `curl` de `https://cdn.jsdelivr.net/npm/foliate-js@1.0.1/mobi.js` → `lib/foliate-mobi.js` (auto-contido, sem imports — OK).
2. **`viewer.js`: loader ESM**
   - Novo `loadModule(url)`: `return import(url)` em volta de `chrome.runtime.getURL`.
   - `ensureMobi()`: carrega `lib/foliate-mobi.js` via `loadModule` + garante `fflate`.
3. **`viewer.js`: `renderMOBI`**
   - Blob a partir do ArrayBuffer → `isMOBI` → `new MOBI({unzlib})` → `open` → iterar `book.sections`, `load()` + resolver imagens → data URIs → append em `.doc-content`. Erros → `showError`.
4. **`lib/fb2-reader.js`: parser FB2 (caseiro, síncrono)**
   - `DOMParser` (xml) → caminhar `body/section` → mapear tags FB2 (`p`, `subtitle`, `empty-line`, `image`, `table`, `list`, `cite`, `poem/v`, `title`) → HTML.
   - Imagens: `<image xlink:href="#id">` → `<img src="data:...">` do `<binary id="id" content-type="...">base64</binary>`.
   - Expor `window.fb2ToHtml(arrayBuffer)`. Registrar `ensureFB2`/`renderFB2`/switch/badge/mime.
5. **`viewer.js`: `renderCBZ`**
   - `fflate.unzipSync` → ordenar chaves de imagens (`*.png|jpe?g|gif`) → renderizar `<img>` data-URI em `.doc-content` (um por linha). Registrar switch/badge/mime.
6. **Registro global (mesmo padrão EPUB)**
   - `viewer.js`: `SUPPORTED_FORMATS`, `switch renderDoc`, `getFileBadge`, `mimeMap` (cbz→application/vnd.comic+zip).
   - `service-worker.js`: `SUPPORTED_EXTENSIONS` + `targetUrlPatterns` (.mobi, .azw, .azw3, .fb2, .cbz, maiúsculas).
   - `viewer.html`: `accept` do input + badges `MOBI`, `FB2`, `CBZ`.
   - `manifest.json`: descrição; `README.md`: tabela de formatos + estrutura.
7. **Validação**
   - `node --check` em todos os `.js`; JSON manifest.
   - jsdom: carregar `lib/foliate-mobi.js` via `import()` de um MOBI real (ou fixture) → confirmar `isMOBI`/`open`/`sections`; FB2 síncrono em um `.fb2` real; CBZ com imagens reais.
   - CSP: `data:`/`blob:` para `<img>` são permitidos (não há `img-src`/`default-src` na CSP MV3 padrão).

---

## Riscos / notas
- **DRM:** não suportado; detectar e falhar com mensagem clara.
- **MOBI muito grande (>100MB):** `chrome.storage.local` base64 pode ficar pesado — já existe `unlimitedStorage`; usar como EPUB.
- **HUFF/CDIC** (MOBI comprimido) é suportado por foliate-js internamente (não precisa de mais deps).
- **FB2 híbrido `.fb2.zip`:** usar `fflate.gunzipSync`(?) — EPUB usa zip (unzipSync), FB2.zip usa gzip (gunzipSync); validar.
- **`scopeCss`/`url()` inline** do `epub-reader.js` pode ser reaproveitado por FB2 (body→.doc-content).
