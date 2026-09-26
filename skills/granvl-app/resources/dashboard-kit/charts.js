/* granvl dashboard kit — tiny dependency-free SVG charts.
 *
 * Two helpers, both return an SVG string you drop into a card:
 *
 *   gvkBars(el, { series: [{ label:'Wed', a:41, b:4 }, ...], keys:['a','b'],
 *                 colors:['var(--gvk-blue)','var(--gvk-green)'] })
 *   gvkLine(el, { points: [12, 18, 9, 22, 31], color:'var(--gvk-blue)' })
 *
 * `el` is a container element (the chart fills its width). Edit freely —
 * this is your copy.
 */

/* Labels and colours may come from campaign names or other data you did not
 * write, so they are escaped / validated before entering the markup. */
function gvkEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function gvkNum(v) { v = Number(v); return isFinite(v) ? v : 0; }
function gvkColor(c, fallback) {
  c = String(c == null ? '' : c).trim();
  return /^(var\(--[A-Za-z0-9_-]+\)|#[0-9A-Fa-f]{3,8}|[a-zA-Z]{3,20}|rgba?\([0-9.,\s%]+\)|hsla?\([0-9.,\s%]+\))$/.test(c) ? c : fallback;
}

function gvkBars(el, opts) {
  var series = opts.series || [];
  var keys = opts.keys || ['value'];
  var colors = (opts.colors || ['var(--gvk-blue)', 'var(--gvk-green)']).map(function (c) { return gvkColor(c, 'var(--gvk-blue)'); });
  var w = el.clientWidth || 600;
  var h = gvkNum(opts.height) || 180;
  var pad = 22;
  var max = 1;
  series.forEach(function (s) {
    keys.forEach(function (k) { if (gvkNum(s[k]) > max) max = gvkNum(s[k]); });
  });
  var groupW = (w - pad * 2) / Math.max(series.length, 1);
  var barW = Math.min(18, (groupW - 10) / keys.length);
  var svg = '<svg width="' + w + '" height="' + h + '" role="img">';
  series.forEach(function (s, i) {
    var gx = pad + i * groupW + (groupW - barW * keys.length - 4 * (keys.length - 1)) / 2;
    keys.forEach(function (k, ki) {
      var v = gvkNum(s[k]);
      var bh = Math.round((v / max) * (h - 46));
      var x = gx + ki * (barW + 4);
      var y = h - 26 - bh;
      svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + bh +
        '" rx="3" fill="' + colors[ki % colors.length] + '"></rect>';
      if (v > 0 && bh > 14) {
        svg += '<text class="chart-label" x="' + (x + barW / 2) + '" y="' + (y - 5) +
          '" text-anchor="middle">' + v + '</text>';
      }
    });
    svg += '<text class="chart-label" x="' + (gx + (barW * keys.length + 4 * (keys.length - 1)) / 2) +
      '" y="' + (h - 8) + '" text-anchor="middle">' + gvkEsc(s.label) + '</text>';
  });
  svg += '</svg>';
  el.innerHTML = svg;
}

function gvkLine(el, opts) {
  var pts = (opts.points || []).map(gvkNum);
  var w = el.clientWidth || 600;
  var h = gvkNum(opts.height) || 140;
  var pad = 10;
  var max = Math.max.apply(null, pts.concat([1]));
  var min = Math.min.apply(null, pts.concat([0]));
  var span = max - min || 1;
  var step = (w - pad * 2) / Math.max(pts.length - 1, 1);
  var coords = pts.map(function (v, i) {
    return [pad + i * step, h - pad - ((v - min) / span) * (h - pad * 2)];
  });
  var d = coords.map(function (c, i) {
    return (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ' ' + c[1].toFixed(1);
  }).join(' ');
  var last = coords[coords.length - 1];
  var color = gvkColor(opts.color, 'var(--gvk-blue)');
  var svg = '<svg width="' + w + '" height="' + h + '" role="img">' +
    '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round"></path>';
  if (last) {
    svg += '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="3.5" fill="' + color + '"></circle>';
  }
  svg += '</svg>';
  el.innerHTML = svg;
}
