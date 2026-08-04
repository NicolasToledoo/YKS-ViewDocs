# YKS-ViewDocs

Visualize documentos PDF, DOC, DOCX, RTF, TXT e MD diretamente no navegador sem sair da página atual.

## Formatos suportados

| Extensão | Tipo |
|----------|------|
| `.pdf`   | PDF (via `<embed>` nativo) |
| `.docx`  | DOCX (via Mammoth) |
| `.doc`   | DOC (extração de texto) |
| `.rtf`   | RTF (via rtf-parser) |
| `.txt`   | Texto puro |
| `.md` / `.markdown` | Markdown (via Marked) |

## Como usar

### Menu de contexto
Clique com o botão direito em um link de documento e selecione **Abrir com YKS-ViewDocs**. A extensão fará o download do arquivo e abrirá em uma nova aba com o visualizador integrado.

### Icone da extensão
Clique no ícone da extensão para abrir o visualizador em branco e selecionar um arquivo local.

### Visualizador
- **Arraste e solte** um arquivo na zona de inserção
- **Clique** na zona para abrir o seletor de arquivos
- **Baixe** o documento visualizado usando o botão de download no cabeçalho
- Documentos são temporariamente armazenados no `chrome.storage.local` e limpos automaticamente em 5 minutos

## Instalação

1. Abra `chrome://extensions/` no Chrome/Chromium
2. Ative **Modo desenvolvedor**
3. Clique em **Carregar sem compactação**
4. Selecione a pasta raiz deste projeto

## Estrutura

```
YKS-ViewDocs/
├── manifest.json              # Manifesto da extensão (MV3)
├── icons/                     # Ícones (16, 48, 128px + SVG)
├── lib/                       # Bibliotecas de terceiros
│   ├── mammoth.browser.js     # Conversor DOCX → HTML
│   ├── marked.min.js          # Processador de Markdown
│   └── rtf-parser.js          # Conversor RTF → HTML
├── styles/
│   └── global.css             # Estilos base (tema escuro)
├── background/
│   └── service-worker.js      # Service worker (MV3)
└── viewer/
    ├── viewer.html            # Página do visualizador
    ├── viewer.js              # Lógica de renderização
    └── viewer.css             # Estilos do visualizador
```

## Permissões

| Permissão | Motivo |
|-----------|--------|
| `contextMenus` | Registrar o item "Abrir com YKS-ViewDocs" no menu de contexto |
| `storage` / `unlimitedStorage` | Armazenar temporariamente o conteúdo do documento |
| `downloads` | Permitir download de arquivos locais |
| `<all_urls>` | Acessar links de documentos em qualquer página |

## Customização

O tema escuro pode ser ajustado em `styles/global.css` (variáveis CSS em `:root`). As cores principais incluem `--accent` (laranja) e `--bg-primary` (preto).