let chartInstance = null;

const baseColors = {
  "Instep": { top: "#90CAF9", bottom: "#1565C0" },
  "Ball":   { top: "#F48FB1", bottom: "#AD1457" },
  "Heel":   { top: "#FFF176", bottom: "#F9A825" },
  "FSR Pad":{ top: "#A5D6A7", bottom: "#2E7D32" },
  "Default":{ top: "#CFD8DC", bottom: "#546E7A" }
};

export function initChart() {
  const canvas = document.getElementById('strikeChart');
  const ctx = canvas.getContext('2d');

  if (typeof Chart === 'undefined') {
    console.error("Chart.js is not loaded.");
    return;
  }

  Chart.defaults.color = '#78909C';
  Chart.defaults.font.family = "'Poppins', sans-serif";
  Chart.defaults.font.weight = '600';

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Force (N)',
        data: [],
        backgroundColor: [],
        borderRadius: { topLeft: 14, topRight: 14, bottomLeft: 4, bottomRight: 4 },
        borderSkipped: false,
        barPercentage: 0.55,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#FFFFFF',
          titleColor: '#455A64',
          bodyColor: '#64B5F6',
          bodyFont: { weight: 'bold' },
          borderColor: '#E0E0E0',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 16
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Force (N)',
            color: '#78909C',
            font: { size: 11, weight: 'bold' }
          },
          grid: { display: false },
          ticks: { color: '#78909C', font: { size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: '#78909C',
            font: { size: 9 },
            maxRotation: 50,
            minRotation: 35
          }
        }
      },
      animation: { duration: 500, easing: 'easeOutQuart' }
    }
  });
}

function createVerticalGradient(ctx, canvas, eventName) {
  const colors = baseColors[eventName] || baseColors["Default"];
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, colors.top);
  gradient.addColorStop(1, colors.bottom);
  return gradient;
}

export function updateChart(strikeData) {
  if (!chartInstance) return;

  const canvas = document.getElementById('strikeChart');
  const ctx = canvas.getContext('2d');
  const ts = new Date(strikeData.timestamp_ms || Date.now())
    .toLocaleTimeString([], { hour12: false, minute:'2-digit', second:'2-digit' });
  const label = `${strikeData.event} [${ts}]`;
  const gradient = createVerticalGradient(ctx, canvas, strikeData.event);

  chartInstance.data.labels.push(label);
  chartInstance.data.datasets[0].data.push(strikeData.force);
  chartInstance.data.datasets[0].backgroundColor.push(gradient);

  if (chartInstance.data.labels.length > 20) {
    chartInstance.data.labels.shift();
    chartInstance.data.datasets[0].data.shift();
    chartInstance.data.datasets[0].backgroundColor.shift();
  }
  chartInstance.update();
}

export function resetChart() {
  initChart();
}

export function renderHistoricalData(strikeArray) {
  resetChart();
  if (!chartInstance) return;

  const canvas = document.getElementById('strikeChart');
  const ctx = canvas.getContext('2d');
  const recent = strikeArray.slice(-20);

  recent.forEach(s => {
    const ts = new Date(s.timestamp_ms || Date.now())
      .toLocaleTimeString([], { hour12: false, minute:'2-digit', second:'2-digit' });
    const label = `${s.event} [${ts}]`;
    const gradient = createVerticalGradient(ctx, canvas, s.event);
    chartInstance.data.labels.push(label);
    chartInstance.data.datasets[0].data.push(s.force);
    chartInstance.data.datasets[0].backgroundColor.push(gradient);
  });
  chartInstance.update();
}
