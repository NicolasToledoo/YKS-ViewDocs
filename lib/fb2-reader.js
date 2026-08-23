(function (global) {
  'use strict';

  function decodeText(bytes) {
    if (!bytes) return '';
    return new TextDecoder('utf-8').decode(bytes);
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

  function processNode(node, binaryMap, scope) {
    if (node.nodeType === 3) {
      return node.nodeValue;
    }
    if (node.nodeType !== 1) return '';

    var tagName = node.tagName.toLowerCase();
    var attrs = {};
    for (var a = 0; a < node.attributes.length; a++) {
      var attr = node.attributes[a];
      var local = attr.name.split(':').pop().toLowerCase();
      attrs[local] = attr.value;
    }

    var children = '';
    for (var c = 0; c < node.childNodes.length; c++) {
      children += processNode(node.childNodes[c], binaryMap, scope);
    }

    switch (tagName) {
      case 'section':
        return '<div class="fb2-section">' + children + '</div>';
      case 'p':
        return '<p>' + children + '</p>';
      case 'subtitle':
        return '<h4>' + children + '</h4>';
      case 'title':
        return '<h2>' + children + '</h2>';
      case 'empty-line':
        return '<br>';
      case 'strong':
      case 'b':
        return '<strong>' + children + '</strong>';
      case 'emphasis':
      case 'i':
        return '<em>' + children + '</em>';
      case 'code':
        return '<code>' + children + '</code>';
      case 'strikethrough':
      case 'st':
        return '<del>' + children + '</del>';
      case 'a':
        var href = attrs.href || '#';
        return '<a href="' + href + '">' + children + '</a>';
      case 'image': {
        var href = attrs.href || '';
        if (href.charAt(0) === '#') href = href.slice(1);
        var bin = binaryMap[href];
        if (bin) {
          return '<img src="' + bin.type + ';base64,' + bin.data + '" alt="' + (bin.id || href) + '">';
        }
        return '';
      }
      case 'poem':
        return '<div class="fb2-poem">' + children + '</div>';
      case 'stanza':
        return '<div class="fb2-stanza">' + children + '</div>';
      case 'v':
        return '<div class="fb2-v">' + children + '</div>';
      case 'cite':
        return '<cite>' + children + '</cite>';
      case 'text-author':
        return '<div class="fb2-author">' + children + '</div>';
      case 'date':
        return '<span class="fb2-date">' + children + '</span>';
      case 'annotation':
        return '<div class="fb2-annotation">' + children + '</div>';
      case 'epigraph':
        return '<div class="fb2-epigraph">' + children + '</div>';
      case 'table':
        return '<table>' + children + '</table>';
      case 'tr':
        return '<tr>' + children + '</tr>';
      case 'td':
      case 'th':
        return '<' + tagName + '>' + children + '</' + tagName + '>';
      case 'list':
        return '<ul>' + children + '</ul>';
      case 'li':
        return '<li>' + children + '</li>';
      default:
        return children;
    }
  }

  function fb2ToHtml(arrayBuffer) {
    var xml = decodeText(arrayBuffer);
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var parserError = doc.getElementsByTagName('parsererror');
    if (parserError.length) throw new Error('FB2 invalido: ' + parserError[0].textContent);

    var binaryEls = doc.getElementsByTagName('binary');
    var binaryMap = {};
    for (var i = 0; i < binaryEls.length; i++) {
      var el = binaryEls[i];
      var id = el.getAttribute('id');
      var contentType = el.getAttribute('content-type') || 'application/octet-stream';
      var text = el.textContent.trim();
      if (id && text) {
        binaryMap[id] = { id: id, type: contentType, data: text.replace(/\s/g, '') };
      }
    }

    var body = doc.getElementsByTagName('body')[0];
    if (!body) throw new Error('FB2 sem elemento body');

    var sections = body.getElementsByTagName('section');
    var html = [];
    for (var s = 0; s < sections.length; s++) {
      html.push(processNode(sections[s], binaryMap));
    }

    if (!html.length) html.push(processNode(body, binaryMap));

    return html.join('\n');
  }

  global.fb2ToHtml = fb2ToHtml;
})(typeof globalThis !== 'undefined' ? globalThis : this);
