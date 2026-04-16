google.charts.load('current', {'packages':['gauge']});

dscc.subscribeToData(draw, {transform: dscc.objectTransform});

function draw(data) {

  const valor = parseFloat(data.tables.DEFAULT[0][0]);
  const meta = parseFloat(data.tables.DEFAULT[0][1]);
  const max = parseFloat(data.tables.DEFAULT[0][2]);

  var chartData = google.visualization.arrayToDataTable([
    ['Label', 'Value'],
    ['RL', valor]
  ]);

  var options = {
    min: 0,
    max: max,
    greenFrom: 0,
    greenTo: meta,
    yellowFrom: meta,
    yellowTo: max * 0.8,
    redFrom: max * 0.8,
    redTo: max
  };

  var chart = new google.visualization.Gauge(document.getElementById('chart'));
  chart.draw(chartData, options);
}