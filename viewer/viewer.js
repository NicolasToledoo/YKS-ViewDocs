var SUPPORTED_FORMATS = [
  'pdf', 'doc', 'docx', 'rtf', 'txt', 'md', 'markdown'
];

var MAX_ATTEMPTS = 3;
var RETRY_DELAY = 500;
var STORAGE_CLEANUP_MS = 300000;

var fileNameEl = document.getElementById('fileName');
var fileBadgeEl = document.getElementById('fileBadge');
var viewerContent = document.getElementById('viewerContent');
var loadingIndicator = document.getElementById('loadingIndicator');
var errorIndicator = document.getElementById('errorIndicator');
var errorMessage = document.getElementById('errorMessage');
var downloadBtn = document.getElementById('downloadBtn');
var pickerView = document.getElementById('pickerView');
var pickerZone = document.getElementById('pickerZone');
var pickerInput = document.getElementById('pickerInput');

var currentDocData = null;
var currentDocName = null;

function getExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

function getFileBadge(ext) {
  var map = {
    pdf: 'PDF', docx: 'DOCX', doc: 'DOC',
    rtf: 'RTF', txt: 'TXT', md: 'MD', markdown: 'MD'
  };
  return map[ext] || ext.toUpperCase();
}

function arrayBufferToText(arrayBuffer) {
  return new TextDecoder().decode(arrayBuffer);
}

function arrayBufferToBase64(arrayBuffer) {
  var bytes = new Uint8Array(arrayBuffer);
  var binary = '';
  var chunkSize = 8192;
  for (var i = 0; i < bytes.length; i += chunkSize) {
    var chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  var binary = atob(base64);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function updateUI(name, ext) {
  document.title = 'YKS-ViewDocs — ' + name;
  fileNameEl.textContent = name;
  fileBadgeEl.textContent = getFileBadge(ext);
}

function showError(msg) {
  loadingIndicator.classList.add('hidden');
  pickerView.classList.add('hidden');
  errorIndicator.classList.remove('hidden');
  errorMessage.textContent = msg;
  console.error('YKS-ViewDocs:', msg);
}

function clearContent() {
  var nodes = viewerContent.querySelectorAll('.doc-content, .text-content, embed, iframe');
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].remove();
  }
}

function renderPDF(arrayBuffer) {
  loadingIndicator.classList.add('hidden');
  var blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  var url = URL.createObjectURL(blob);
  var embed = document.createElement('embed');
  embed.src = url;
  embed.type = 'application/pdf';
  embed.onload = function () {
    URL.revokeObjectURL(url);
  };
  embed.onerror = function () {
    URL.revokeObjectURL(url);
    showError('Não foi possível renderizar o PDF.');
  };
  viewerContent.appendChild(embed);
}

function renderDOCX(arrayBuffer) {
  loadingIndicator.classList.add('hidden');
  ensureMammoth().then(function () {
    mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
      .then(function (result) {
        var div = document.createElement('div');
        div.className = 'doc-content';
        div.innerHTML = result.value;
        viewerContent.appendChild(div);
        if (result.messages.length > 0) {
          console.warn('YKS-ViewDocs: Avisos do mammoth:', result.messages);
        }
      })
      .catch(function (err) {
        showError('Erro ao processar DOCX: ' + err.message);
      });
  }).catch(function () {
    showError('Erro ao carregar biblioteca DOCX.');
  });
}

function renderDOC(arrayBuffer) {
  var text = arrayBufferToText(arrayBuffer);
  var clean = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
  loadingIndicator.classList.add('hidden');
  var pre = document.createElement('pre');
  pre.className = 'text-content';
  pre.textContent = clean;
  viewerContent.appendChild(pre);
}

function renderRTF(arrayBuffer) {
  var text = arrayBufferToText(arrayBuffer);
  loadingIndicator.classList.add('hidden');
  ensureRtfParser().then(function () {
    try {
      var html = rtfToHtml(text);
      var div = document.createElement('div');
      div.className = 'doc-content';
      div.innerHTML = html;
      viewerContent.appendChild(div);
    } catch (err) {
      showError('Erro ao processar RTF: ' + err.message);
    }
  }).catch(function () {
    showError('Erro ao carregar biblioteca RTF.');
  });
}

function renderTXT(arrayBuffer) {
  var text = arrayBufferToText(arrayBuffer);
  loadingIndicator.classList.add('hidden');
  var pre = document.createElement('pre');
  pre.className = 'text-content';
  pre.textContent = text;
  viewerContent.appendChild(pre);
}

function renderMD(arrayBuffer) {
  var text = arrayBufferToText(arrayBuffer);
  loadingIndicator.classList.add('hidden');
  ensureMarked().then(function () {
    var div = document.createElement('div');
    div.className = 'doc-content';
    div.innerHTML = marked.parse(text);
    viewerContent.appendChild(div);
  }).catch(function () {
    showError('Erro ao carregar biblioteca Markdown.');
  });
}

function renderDoc(ext, data) {
  clearContent();
  switch (ext) {
    case 'pdf': renderPDF(data); break;
    case 'docx': renderDOCX(data); break;
    case 'doc': renderDOC(data); break;
    case 'rtf': renderRTF(data); break;
    case 'txt': renderTXT(data); break;
    case 'md':
    case 'markdown': renderMD(data); break;
    default: showError('Formato não suportado: .' + ext);
  }
}

function loadDocument(id, attempt) {
  console.log('YKS-ViewDocs: Tentativa', attempt + 1, 'de', MAX_ATTEMPTS, 'para id:', id);

  chrome.storage.local.get(id, function (result) {
    if (chrome.runtime.lastError) {
      console.error('YKS-ViewDocs: Erro ao ler storage:', chrome.runtime.lastError.message);
      showError('Erro ao acessar armazenamento.');
      return;
    }

    var doc = result[id];

    if (!doc) {
      if (attempt < MAX_ATTEMPTS - 1) {
        console.warn('YKS-ViewDocs: Documento não encontrado, tentando novamente em', RETRY_DELAY, 'ms...');
        setTimeout(function () {
          loadDocument(id, attempt + 1);
        }, RETRY_DELAY);
      } else {
        showError('Documento não encontrado ou expirado.');
      }
      return;
    }

    console.log('YKS-ViewDocs: Documento encontrado:', doc.name, doc.size, 'bytes');

    var ext = getExtension(doc.name);
    if (!SUPPORTED_FORMATS.includes(ext)) {
      showError('Formato não suportado: .' + ext);
      return;
    }

    updateUI(doc.name, ext);

    var arrayBuffer = base64ToArrayBuffer(doc.data);
    currentDocData = doc.data;
    currentDocName = doc.name;

    renderDoc(ext, arrayBuffer);

    chrome.storage.local.remove(id, function () {
      if (chrome.runtime.lastError) {
        console.warn('YKS-ViewDocs: Erro ao limpar storage:', chrome.runtime.lastError.message);
      } else {
        console.log('YKS-ViewDocs: Documento removido do storage');
      }
    });
  });
}

function handlePickerFile(file) {
  removePickerListeners();

  var ext = getExtension(file.name);
  if (!SUPPORTED_FORMATS.includes(ext)) {
    showPickerStatus('Formato não suportado: .' + ext, 'error');
    return;
  }

  showPickerStatus('Carregando...', 'loading');

  var reader = new FileReader();
  reader.onerror = function () {
    console.error('YKS-ViewDocs: Erro ao ler arquivo no picker');
    showPickerStatus('Erro ao ler o arquivo.', 'error');
  };

  reader.onload = function (e) {
    var id = crypto.randomUUID();
    var docData = {
      name: file.name,
      type: file.type,
      size: file.size,
      data: arrayBufferToBase64(e.target.result)
    };

    console.log('YKS-ViewDocs: Armazenando documento...', id, file.name, file.size);

    chrome.storage.local.set({ [id]: docData }, function () {
      if (chrome.runtime.lastError) {
        console.error('YKS-ViewDocs: Erro no storage:', chrome.runtime.lastError.message);
        showPickerStatus('Erro ao salvar: ' + chrome.runtime.lastError.message, 'error');
        return;
      }

      setTimeout(function () {
        chrome.storage.local.remove(id);
      }, STORAGE_CLEANUP_MS);

      console.log('YKS-ViewDocs: Storage ok, atualizando URL e renderizando...');
      history.replaceState(null, '', '?id=' + id);

      pickerView.classList.add('hidden');
      loadingIndicator.classList.remove('hidden');

      loadDocument(id, 0);
    });
  };

  reader.readAsArrayBuffer(file);
}

function showPickerStatus(msg, type) {
  var existing = document.querySelector('.picker-status');
  if (existing) existing.remove();

  var div = document.createElement('div');
  div.className = 'picker-status ' + type;
  div.textContent = msg;
  pickerView.appendChild(div);
}

function onPickerClick() {
  pickerInput.click();
}

function onPickerDragOver(e) {
  e.preventDefault();
  pickerZone.classList.add('drag-over');
}

function onPickerDragLeave() {
  pickerZone.classList.remove('drag-over');
}

function onPickerDrop(e) {
  e.preventDefault();
  pickerZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) {
    handlePickerFile(e.dataTransfer.files[0]);
  }
}

function onPickerChange() {
  if (pickerInput.files.length > 0) {
    handlePickerFile(pickerInput.files[0]);
  }
}

function removePickerListeners() {
  pickerZone.removeEventListener('click', onPickerClick);
  pickerZone.removeEventListener('dragover', onPickerDragOver);
  pickerZone.removeEventListener('dragleave', onPickerDragLeave);
  pickerZone.removeEventListener('drop', onPickerDrop);
  pickerInput.removeEventListener('change', onPickerChange);
}

function initPicker() {
  loadingIndicator.classList.add('hidden');
  pickerView.classList.remove('hidden');

  document.title = 'YKS-ViewDocs — Selecionar documento';
  fileNameEl.textContent = '';
  fileBadgeEl.textContent = '';

  console.log('YKS-ViewDocs: Modo picker (sem ?id=)');

  pickerZone.addEventListener('click', onPickerClick);
  pickerZone.addEventListener('dragover', onPickerDragOver);
  pickerZone.addEventListener('dragleave', onPickerDragLeave);
  pickerZone.addEventListener('drop', onPickerDrop);
  pickerInput.addEventListener('change', onPickerChange);
}

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

function ensureMammoth() {
  if (window.mammoth) return Promise.resolve();
  return loadScript('../lib/mammoth.browser.js');
}

function ensureMarked() {
  if (window.marked) return Promise.resolve();
  return loadScript('../lib/marked.min.js');
}

function ensureRtfParser() {
  if (window.rtfToHtml) return Promise.resolve();
  return loadScript('../lib/rtf-parser.js');
}

function init() {
  downloadBtn.addEventListener('click', function () {
    if (!currentDocData || !currentDocName) return;
    var ext = getExtension(currentDocName);
    var mimeMap = {
      pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword', rtf: 'application/rtf', txt: 'text/plain',
      md: 'text/markdown', markdown: 'text/markdown'
    };
    var mime = mimeMap[ext] || 'application/octet-stream';
    var a = document.createElement('a');
    a.href = 'data:' + mime + ';base64,' + currentDocData;
    a.download = currentDocName;
    a.click();
  });

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');

  if (!id) {
    initPicker();
    return;
  }

  console.log('YKS-ViewDocs: Inicializando viewer para id:', id);
  loadDocument(id, 0);
}

document.addEventListener('DOMContentLoaded', init);
