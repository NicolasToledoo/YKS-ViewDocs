var SUPPORTED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'rtf', 'txt', 'md', 'markdown'
];

var STORAGE_CLEANUP_MS = 300000;

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

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    id: 'open-with-yks-viewdocs',
    title: 'Abrir com YKS-ViewDocs',
    contexts: ['link'],
    targetUrlPatterns: [
      '*://*/*.pdf', '*://*/*.docx', '*://*/*.doc',
      '*://*/*.rtf', '*://*/*.txt', '*://*/*.md', '*://*/*.markdown',
      '*://*/*.PDF', '*://*/*.DOCX', '*://*/*.DOC',
      '*://*/*.RTF', '*://*/*.TXT', '*://*/*.MD'
    ]
  });
  console.log('YKS-ViewDocs: Context menu registrado');
});

chrome.action.onClicked.addListener(function () {
  var viewerUrl = chrome.runtime.getURL('viewer/viewer.html');
  console.log('YKS-ViewDocs: Icone clicado, abrindo viewer...');
  chrome.tabs.create({ url: viewerUrl });
});

function storeAndOpen(docData, sendResponse) {
  var id = crypto.randomUUID();
  var storeData = {
    name: docData.name,
    type: docData.type,
    size: docData.size,
    data: docData.data
  };

  console.log('YKS-ViewDocs: Armazenando documento...', id, docData.name, docData.size);

  chrome.storage.local.set({ [id]: storeData }, function () {
    if (chrome.runtime.lastError) {
      console.error('YKS-ViewDocs: Erro no storage:', chrome.runtime.lastError.message);
      if (sendResponse) {
        sendResponse({ success: false, error: 'Erro ao salvar: ' + chrome.runtime.lastError.message });
      }
      return;
    }

    setTimeout(function () {
      chrome.storage.local.remove(id);
    }, STORAGE_CLEANUP_MS);

    var viewerUrl = chrome.runtime.getURL('viewer/viewer.html') + '?id=' + id;
    console.log('YKS-ViewDocs: Storage ok, criando aba...');

    try {
      chrome.tabs.create({ url: viewerUrl }, function (tab) {
        if (chrome.runtime.lastError) {
          console.error('YKS-ViewDocs: Erro ao criar aba:', chrome.runtime.lastError.message);
          if (sendResponse) {
            sendResponse({ success: false, error: 'Erro ao abrir aba: ' + chrome.runtime.lastError.message });
          }
          return;
        }
        console.log('YKS-ViewDocs: Aba criada com sucesso', tab.id);
        if (sendResponse) {
          sendResponse({ success: true });
        }
      });
    } catch (err) {
      console.error('YKS-ViewDocs: Exceção ao criar aba:', err);
      if (sendResponse) {
        sendResponse({ success: false, error: 'Erro ao criar aba: ' + err.message });
      }
    }
  });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'openDocument') {
    console.log('YKS-ViewDocs: Mensagem recebida de popup/content:', sender.tab ? 'content script' : 'popup');
    storeAndOpen(message.data, sendResponse);
    return true;
  }
});

chrome.contextMenus.onClicked.addListener(function (info) {
  if (info.menuItemId !== 'open-with-yks-viewdocs' || !info.linkUrl) {
    return;
  }

  console.log('YKS-ViewDocs: Context menu clicado, baixando:', info.linkUrl);

  fetch(info.linkUrl)
    .then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' ' + response.statusText);
      }
      return response.blob();
    })
    .then(function (blob) {
      console.log('YKS-ViewDocs: Download ok, tamanho:', blob.size, 'tipo:', blob.type);
      var reader = new FileReader();

      reader.onerror = function () {
        console.error('YKS-ViewDocs: Erro ao ler blob com FileReader');
      };

      reader.onload = function (e) {
        var type = blob.type;
        blob = null;
        storeAndOpen({
          name: info.linkUrl.split('/').pop().split('?')[0] || 'document',
          type: type,
          size: e.target.result.byteLength,
          data: arrayBufferToBase64(e.target.result)
        }, null);
      };

      reader.readAsArrayBuffer(blob);
    })
    .catch(function (error) {
      console.error('YKS-ViewDocs: Erro ao baixar documento:', error.message, info.linkUrl);
    });
});
