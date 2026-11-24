import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { formatINR } from '../utils/formatters';

ChartJS.register(
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

const PALETTE = [
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fb7185',
  '#c084fc',
  '#60a5fa',
];

const BASE_GRID = 'rgba(139, 92, 246, 0.08)';
const TICK_COLOR = '#94a3b8';

export function CategoryDoughnutChart({
  dataMap,
  height = 260,
}: {
  dataMap: Record<string, number>;
  height?: number;
}) {
  const entries = Object.entries(dataMap)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-slate-400 border border-dashed border-violet-500/20 rounded-xl"
      >
        No expenses recorded in this period yet.
      </div>
    );
  }

  const data = {
    labels: entries.map(([k]) => k),
    datasets: [
      {
        data: entries.map(([, v]) => v),
        backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length]),
        borderColor: '#131020',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '66%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#cbd5e1',
          boxWidth: 10,
          boxHeight: 10,
          padding: 12,
          font: { family: "'DM Sans', sans-serif", size: 12 },
        },
      },
      tooltip: {
        backgroundColor: '#161224',
        borderColor: 'rgba(139, 92, 246, 0.35)',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${formatINR(Number(ctx.raw))}`,
        },
      },
    },
  };

  return (
    <div style={{ height }} className="w-full">
      <Doughnut data={data} options={options} />
    </div>
  );
}

export function IncomeExpenseBarChart({
  series,
  height = 260,
}: {
  series: Array<{ label: string; income: number; expenses: number }>;
  height?: number;
}) {
  const data = {
    labels: series.map((s) => s.label),
    datasets: [
      {
        label: 'Income',
        data: series.map((s) => s.income),
        backgroundColor: '#10b981',
        borderRadius: 6,
        barPercentage: 0.65,
      },
      {
        label: 'Expenses',
        data: series.map((s) => s.expenses),
        backgroundColor: '#8b5cf6',
        borderRadius: 6,
        barPercentage: 0.65,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: '#cbd5e1',
          boxWidth: 10,
          boxHeight: 10,
          font: { family: "'DM Sans', sans-serif", size: 12 },
        },
      },
      tooltip: {
        backgroundColor: '#161224',
        borderColor: 'rgba(139, 92, 246, 0.35)',
        borderWidth: 1,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${formatINR(Number(ctx.raw))}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: TICK_COLOR, font: { size: 11 } },
      },
      y: {
        grid: { color: BASE_GRID },
        ticks: {
          color: TICK_COLOR,
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          callback: (val) => `₹${Number(val).toLocaleString('en-IN')}`,
        },
      },
    },
  };

  return (
    <div style={{ height }} className="w-full">
      <Bar data={data} options={options} />
    </div>
  );
}

export function SavingsLineChart({
  series,
  height = 250,
}: {
  series: Array<{ label: string; value: number }>;
  height?: number;
}) {
  const data = {
    labels: series.map((s) => s.label),
    datasets: [
      {
        label: 'Net Savings (₹)',
        data: series.map((s) => s.value),
        borderColor: '#a78bfa',
        backgroundColor: 'rgba(139, 92, 246, 0.16)',
        pointBackgroundColor: '#c4b5fd',
        pointBorderColor: '#131020',
        pointBorderWidth: 2,
        pointRadius: 4,
        fill: true,
        tension: 0.32,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#161224',
        borderColor: 'rgba(139, 92, 246, 0.35)',
        borderWidth: 1,
        callbacks: {
          label: (ctx) => ` ${formatINR(Number(ctx.raw))}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: TICK_COLOR, font: { size: 11 } },
      },
      y: {
        grid: { color: BASE_GRID },
        ticks: {
          color: TICK_COLOR,
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          callback: (val) => `₹${Number(val).toLocaleString('en-IN')}`,
        },
      },
    },
  };

  return (
    <div style={{ height }} className="w-full">
      <Line data={data} options={options} />
    </div>
  );
}

export function CategoryBarChart({
  dataMap,
  height = 260,
}: {
  dataMap: Record<string, number>;
  height?: number;
}) {
  const entries = Object.entries(dataMap)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (entries.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-slate-400 border border-dashed border-violet-500/20 rounded-xl"
      >
        No category data available for this range.
      </div>
    );
  }

  const data = {
    labels: entries.map(([k]) => k),
    datasets: [
      {
        label: 'Spent (₹)',
        data: entries.map(([, v]) => v),
        backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length]),
        borderRadius: 6,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#161224',
        borderColor: 'rgba(139, 92, 246, 0.35)',
        borderWidth: 1,
        callbacks: {
          label: (ctx) => ` ${formatINR(Number(ctx.raw))}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: TICK_COLOR, font: { size: 11 } },
      },
      y: {
        grid: { color: BASE_GRID },
        ticks: {
          color: TICK_COLOR,
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          callback: (val) => `₹${Number(val).toLocaleString('en-IN')}`,
        },
      },
    },
  };

  return (
    <div style={{ height }} className="w-full">
      <Bar data={data} options={options} />
    </div>
  );
}
