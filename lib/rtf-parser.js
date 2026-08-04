function rtfToHtml(rtfContent) {
  let text = rtfContent;
  text = text.replace(/\\par[ds]?\b/gi, '\n');
  text = text.replace(/\\line\b/gi, '\n');
  text = text.replace(/\\tab\b/gi, '\t');
  text = text.replace(/\\page\b/gi, '\n---\n');
  text = text.replace(/\\sect\b/gi, '\n');
  text = text.replace(/\\pard\b/gi, '');
  text = text.replace(/\\plain\b/gi, '');
  text = text.replace(/\\b\b/gi, '');
  text = text.replace(/\\b0\b/gi, '');
  text = text.replace(/\\i\b/gi, '');
  text = text.replace(/\\i0\b/gi, '');
  text = text.replace(/\\ul\b/gi, '');
  text = text.replace(/\\ul0\b/gi, '');
  text = text.replace(/\\strike\b/gi, '');
  text = text.replace(/\\super\b/gi, '');
  text = text.replace(/\\sub\b/gi, '');
  text = text.replace(/\\fs\d+\b/gi, '');
  text = text.replace(/\\f\d+\b/gi, '');
  text = text.replace(/\\cf\d+\b/gi, '');
  text = text.replace(/\\cb\d+\b/gi, '');
  text = text.replace(/\\highlight\d+\b/gi, '');
  text = text.replace(/\\ltrpar\b/gi, '');
  text = text.replace(/\\rtlpar\b/gi, '');
  text = text.replace(/\\ltrrow\b/gi, '');
  text = text.replace(/\\rtlrow\b/gi, '');
  text = text.replace(/\\cell\b/gi, '\t');
  text = text.replace(/\\nestcell\b/gi, '\t');
  text = text.replace(/\\trowd\b/gi, '');
  text = text.replace(/\\row\b/gi, '\n');
  text = text.replace(/\\intbl\b/gi, '');
  text = text.replace(/\\cellx\d+\b/gi, '');
  text = text.replace(/\\colno\d+\b/gi, '');
  text = text.replace(/\\ts\d+\b/gi, '');
  text = text.replace(/\\tr[leftrightcenter]+\d+/gi, '');
  text = text.replace(/\\cl[wxy]\d+/gi, '');
  text = text.replace(/\\p[nm]?\d+/gi, '');
  text = text.replace(/\\sa\d+\b/gi, '');
  text = text.replace(/\\sb\d+\b/gi, '');
  text = text.replace(/\\sl\d+\b/gi, '');
  text = text.replace(/\\slmult\d?\b/gi, '');
  text = text.replace(/\\fi\d+\b/gi, '');
  text = text.replace(/\\li\d+\b/gi, '');
  text = text.replace(/\\ri\d+\b/gi, '');
  text = text.replace(/\\ql\b/gi, '');
  text = text.replace(/\\qr\b/gi, '');
  text = text.replace(/\\qc\b/gi, '');
  text = text.replace(/\\qj\b/gi, '');
  text = text.replace(/\{\\fonttbl[^}]*\}/gi, '');
  text = text.replace(/\{\\colortbl[^}]*\}/gi, '');
  text = text.replace(/\{\\stylesheet[^}]*\}/gi, '');
  text = text.replace(/\{\*[^}]*\}/gi, '');
  text = text.replace(/\{[^}]*\}/g, '');
  text = text.replace(/\\'([0-9a-f]{2})/gi, (match, hex) => {
    const code = parseInt(hex, 16);
    return String.fromCharCode(code);
  });
  text = text.replace(/\\u(\d+)/gi, (match, num) => {
    return String.fromCharCode(parseInt(num, 10));
  });
  text = text.replace(/\\(?:[a-z]+)(?:-?\d+)?/gi, '');
  text = text.replace(/\{|\}/g, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  const paragraphs = text.split('\n');
  const htmlParagraphs = paragraphs.map(p => {
    const trimmed = p.trim();
    if (!trimmed) return '';
    return `<p>${escapeHtml(trimmed)}</p>`;
  });

  return htmlParagraphs.join('\n');
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}
