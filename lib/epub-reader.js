(function (global) {
  'use strict';

  var TEXT_DECODER = new TextDecoder('utf-8');

  function decodeText(bytes) {
    if (!bytes) return '';
    return TEXT_DECODER.decode(bytes);
  }

  function resolvePath(baseDir, href) {
    var parts = (baseDir + href).split('/');
    var result = [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part === '' || part === '.') continue;
      if (part === '..') { result.pop(); continue; }
      result.push(part);
    }
    return result.join('/');
  }

  function getDirPath(path) {
    var idx = path.lastIndexOf('/');
    return idx === -1 ? '' : path.substring(0, idx + 1);
  }

  function mimeFromPath(path) {
    var ext = path.split('.').pop().toLowerCase();
    var map = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', svg: 'image/svg+xml', bmp: 'image/bmp',
      webp: 'image/webp'
    };
    return map[ext] || 'application/octet-stream';
  }

  function toBase64(bytes) {
    var binary = '';
    var len = bytes.length;
    for (var i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function findFileKey(files, candidates) {
    var keys = Object.keys(files);
    for (var c = 0; c < candidates.length; c++) {
      var candidate = candidates[c].toLowerCase();
      for (var k = 0; k < keys.length; k++) {
        if (keys[k].toLowerCase() === candidate) return keys[k];
      }
    }
    return null;
  }

  function lookupFile(files, path) {
    if (files[path]) return files[path];
    var lower = path.toLowerCase();
    var keys = Object.keys(files);
    for (var k = 0; k < keys.length; k++) {
      if (keys[k].toLowerCase() === lower) return files[keys[k]];
    }
    return null;
  }

  function toDataUri(src, baseDir, files) {
    if (!src || /^data:/i.test(src) || /^(?:https?:)?\/\//i.test(src)) return src;
    var key = resolvePath(baseDir, src);
    var bytes = lookupFile(files, key);
    if (!bytes) return src;
    return 'data:' + mimeFromPath(key) + ';base64,' + toBase64(bytes);
  }

  function resolveCssUrls(cssText, baseDir, files) {
    return cssText.replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, function (match, quote, url) {
      var resolved = toDataUri(url, baseDir, files);
      if (/^data:/i.test(resolved)) return 'url(' + resolved + ')';
      return match;
    });
  }

  function scopeCss(cssText) {
    return cssText.replace(/\bhtml\b/gi, '.epub-book').replace(/\bbody\b/gi, '.epub-book');
  }

  function parseContainerXml(containerBytes) {
    var doc = new DOMParser().parseFromString(decodeText(containerBytes), 'application/xml');
    var rootfiles = doc.getElementsByTagNameNS('*', 'rootfile');
    if (!rootfiles.length) throw new Error('container.xml sem rootfile');
    var rootfile = rootfiles[0];
    var fullPath = rootfile.getAttribute('full-path');
    if (!fullPath) throw new Error('rootfile sem full-path');
    return fullPath;
  }

  function parseOpf(opfBytes, opfPath) {
    var xml = decodeText(opfBytes);
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var parserError = doc.getElementsByTagName('parsererror');
    if (parserError.length) throw new Error('OPF invalido: ' + parserError[0].textContent);

    var manifest = {};
    var manifestEl = doc.getElementsByTagNameNS('*', 'manifest')[0];
    if (manifestEl) {
      var items = manifestEl.getElementsByTagNameNS('*', 'item');
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var id = item.getAttribute('id');
        var href = item.getAttribute('href');
        var mediaType = item.getAttribute('media-type') || '';
        if (id && href) {
          manifest[id] = { href: href, mediaType: mediaType, properties: item.getAttribute('properties') || '' };
        }
      }
    }

    var spineIds = [];
    var spineEl = doc.getElementsByTagNameNS('*', 'spine')[0];
    if (spineEl) {
      var itemrefs = spineEl.getElementsByTagNameNS('*', 'itemref');
      for (var j = 0; j < itemrefs.length; j++) {
        var ref = itemrefs[j];
        if (ref.getAttribute('linear') === 'no') continue;
        spineIds.push(ref.getAttribute('idref'));
      }
    }

    return { manifest: manifest, spineIds: spineIds, opfDir: getDirPath(opfPath) };
  }

  function isContentDoc(href, mediaType) {
    var lower = href.toLowerCase();
    if (/\.(xhtml|html|htm)$/.test(lower)) return true;
    if (/\.(xml)$/.test(lower) && /xhtml/.test(mediaType)) return true;
    return false;
  }

  function processStyles(doc, contentDir, files) {
    var cssList = [];
    var headStyles = doc.querySelectorAll('style');
    for (var s = 0; s < headStyles.length; s++) {
      var css = headStyles[s].textContent;
      if (css) cssList.push(scopeCss(resolveCssUrls(css, contentDir, files)));
    }
    var links = doc.querySelectorAll('link[rel~="stylesheet"][href]');
    for (var l = 0; l < links.length; l++) {
      var href = links[l].getAttribute('href');
      if (!href || /^(?:https?:)?\/\//i.test(href) || /^data:/i.test(href)) continue;
      var key = resolvePath(contentDir, href);
      var cssBytes = lookupFile(files, key);
      if (cssBytes) {
        var cssDir = getDirPath(key);
        cssList.push(scopeCss(resolveCssUrls(decodeText(cssBytes), cssDir, files)));
      }
    }
    return cssList;
  }

  function processImages(body, contentDir, files) {
    var imgs = body.querySelectorAll('img[src]');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var src = img.getAttribute('src');
      var uri = toDataUri(src, contentDir, files);
      if (uri !== src) img.setAttribute('src', uri);
    }
  }

  function extractSection(xhtmlText, contentDir, files) {
    var doc = new DOMParser().parseFromString(xhtmlText, 'text/html');
    var body = doc.body;
    if (!body) return '';

    var cssList = processStyles(doc, contentDir, files);
    processImages(body, contentDir, files);

    var inner = body.innerHTML;
    var styles = '';
    for (var i = 0; i < cssList.length; i++) styles += '<style>' + cssList[i] + '</style>';
    return '<div class="epub-book">' + styles + inner + '</div>';
  }

  function epubToHtml(arrayBuffer) {
    if (!global.fflate || !global.fflate.unzipSync) {
      throw new Error('Biblioteca fflate nao carregada');
    }

    var files = global.fflate.unzipSync(new Uint8Array(arrayBuffer));
    var containerKey = findFileKey(files, ['META-INF/container.xml']);
    if (!containerKey) throw new Error('container.xml nao encontrado');

    var opfPath = parseContainerXml(files[containerKey]);
    var opfKey = findFileKey(files, [opfPath]);
    if (!opfKey) throw new Error('OPF nao encontrado: ' + opfPath);

    var parsed = parseOpf(files[opfKey], opfPath);
    var manifest = parsed.manifest;
    var spineIds = parsed.spineIds;
    var opfDir = parsed.opfDir;

    var sections = [];
    for (var i = 0; i < spineIds.length; i++) {
      var id = spineIds[i];
      var item = manifest[id];
      if (!item) continue;
      if (!isContentDoc(item.href, item.mediaType)) continue;

      var contentKey = resolvePath(opfDir, item.href);
      var xhtmlBytes = files[contentKey];
      if (!xhtmlBytes) continue;

      var xhtmlText = decodeText(xhtmlBytes);
      var contentDir = getDirPath(contentKey);
      sections.push(extractSection(xhtmlText, contentDir, files));
    }

    if (!sections.length) throw new Error('Nenhum conteudo encontrado no EPUB');

    return sections.join('\n');
  }

  global.epubToHtml = epubToHtml;
})(typeof globalThis !== 'undefined' ? globalThis : this);
