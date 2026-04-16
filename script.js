// Fallback formatter usado apenas em modo local (fora do Looker)
function formatValue(value) {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + ' Mi';
  } else if (value >= 1000) {
    return (value / 1000).toFixed(1) + ' K';
  }
  return value.toFixed(1);
}

let currentData = null;

function extractFields(row) {
  // objectTransform retorna {fieldId: [{value, formattedValue}]} no Looker
  // ou {fieldId: rawValue} dependendo da versão
  const fields = Object.values(row);
  return fields.map(function(f) {
    if (Array.isArray(f) && f[0] && typeof f[0] === 'object') {
      return {
        raw: parseFloat(f[0].value) || 0,
        fmt: f[0].formattedValue || formatValue(parseFloat(f[0].value) || 0)
      };
    }
    const raw = parseFloat(f) || 0;
    return { raw: raw, fmt: formatValue(raw) };
  });
}

function drawGauge(data) {
  let realizado, expectativa, orcado;
  let realizadoFmt, expectativaFmt, orcadoFmt;

  if (data.tables.DEFAULT && data.tables.DEFAULT[0]) {
    const row = data.tables.DEFAULT[0];
    if (Array.isArray(row)) {
      // Modo local de teste
      realizado   = parseFloat(row[0]);
      expectativa = parseFloat(row[1]);
      orcado      = parseFloat(row[2]);
      realizadoFmt   = formatValue(realizado);
      expectativaFmt = formatValue(expectativa);
      orcadoFmt      = formatValue(orcado);
    } else {
      // Looker Studio: usa formattedValue do próprio Looker
      const fields = extractFields(row);
      realizado      = fields[0].raw;  realizadoFmt   = fields[0].fmt;
      expectativa    = fields[1].raw;  expectativaFmt = fields[1].fmt;
      orcado         = fields[2].raw;  orcadoFmt      = fields[2].fmt;
    }
  }

  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Título: nomes dos campos enviados pelo Looker
  let title = '';
  if (data.fields) {
    title = Object.values(data.fields)
      .map(function(f) { return Array.isArray(f) ? f[0].name : f.name; })
      .join(', ');
  }
  const lookerTitleSize = data.style && data.style.titulo && data.style.titulo.fontSize
    ? parseFloat(data.style.titulo.fontSize.value)
    : null;
  const titleSize = lookerTitleSize || Math.max(14, Math.min(20, W * 0.055));
  ctx.font = `${titleSize}px Arial`;
  ctx.fillStyle = '#555';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(title, W / 2, H * 0.04);

  // Geometria do gauge
  const centerX = W / 2;
  const centerY = H * 0.70;
  const topMargin = H * 0.15;
  const radius = Math.min(W * 0.43, centerY - topMargin);
  const arcThick = radius * 0.22;
  const midR = radius - arcThick * 0.5;
  const outerR = midR + arcThick * 0.5;
  const innerR = midR - arcThick * 0.5;

  // Arco: sentido horário da esquerda (PI) pelo topo até a direita (2*PI)
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;

  // Fundo do arco (cinza)
  ctx.beginPath();
  ctx.arc(centerX, centerY, midR, startAngle, endAngle, false);
  ctx.lineWidth = arcThick;
  ctx.strokeStyle = '#dedede';
  ctx.lineCap = 'butt';
  ctx.stroke();

  // Preenchimento realizado (ciano)
  const rRatio = Math.min(Math.max(realizado / orcado, 0), 1);
  if (rRatio > 0) {
    const rAngle = startAngle + Math.PI * rRatio;
    ctx.beginPath();
    ctx.arc(centerX, centerY, midR, startAngle, rAngle, false);
    ctx.lineWidth = arcThick;
    ctx.strokeStyle = '#20b2aa';
    ctx.lineCap = 'butt';
    ctx.stroke();
  }

  // Marcador da expectativa (traço preto)
  const eRatio = Math.min(Math.max(expectativa / orcado, 0), 1);
  const eAngle = startAngle + Math.PI * eRatio;
  ctx.beginPath();
  ctx.moveTo(centerX + outerR * Math.cos(eAngle), centerY + outerR * Math.sin(eAngle));
  ctx.lineTo(centerX + innerR * Math.cos(eAngle), centerY + innerR * Math.sin(eAngle));
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#333';
  ctx.lineCap = 'butt';
  ctx.stroke();

  // Valor central (usa formattedValue do Looker)
  const valSize = Math.max(20, Math.min(52, radius * 0.42));
  ctx.font = `bold ${valSize}px Arial`;
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(realizadoFmt, centerX, centerY - radius * 0.12);

  // Labels de borda maiores
  const lblSize = Math.max(12, Math.min(18, W * 0.055));
  ctx.font = `${lblSize}px Arial`;
  ctx.fillStyle = '#555';

  // Valor mínimo na ponta esquerda do arco
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('0', centerX - outerR, centerY + 5);

  // Valor do orçado na ponta direita do arco
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(orcadoFmt, centerX + outerR, centerY + 5);

  // Valor da expectativa: posicionado fora do arco, um pouco mais à direita
  const eLabelOffset = outerR + lblSize * 1.4;
  const eLabelX = centerX + eLabelOffset * Math.cos(eAngle);
  const eLabelY = centerY + eLabelOffset * Math.sin(eAngle);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(expectativaFmt, eLabelX, eLabelY);
}

function resizeCanvas() {
  const canvas = document.getElementById('chart');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  if (currentData) drawGauge(currentData);
}

window.addEventListener('resize', resizeCanvas);

if (typeof dscc !== 'undefined') {
  dscc.subscribeToData(function(data) {
    currentData = data;
    resizeCanvas();
  }, { transform: dscc.objectTransform });
} else {
  window.addEventListener('load', function() {
    currentData = {
      tables: { DEFAULT: [[6100000, 39200000, 43500000]] },
      fields: {
        metric0: [{ name: 'Realizado' }],
        metric1: [{ name: 'Expectativa' }],
        metric2: [{ name: 'Orçado' }]
      }
    };
    resizeCanvas();
  });
}
