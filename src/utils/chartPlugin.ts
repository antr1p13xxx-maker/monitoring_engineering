/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Plugin } from 'chart.js';

export const chartValueLabelsPlugin: Plugin = {
  id: 'chartValueLabels',
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart;
    ctx.save();

    const isHorizontal = chart.config.options?.indexAxis === 'y';

    chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;

      const isLine = dataset.type === 'line' || meta.type === 'line';

      meta.data.forEach((element: any, index: number) => {
        const rawVal = dataset.data[index];
        if (rawVal === null || rawVal === undefined || isNaN(rawVal)) return;

        const numVal = Number(rawVal);
        let text = Number.isInteger(numVal) ? String(numVal) : numVal.toFixed(1);

        // Check if dataset or chart is percentage
        if (dataset.isPercentage || chart.config.options?.plugins?.valueLabels?.isPercentage) {
          text = `${text}%`;
        }

        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';

        if (isHorizontal) {
          // Horizontal Bar Chart
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#0f172a'; // slate-900 for sharp readability
          
          const x = element.x + 6;
          const y = element.y;
          ctx.fillText(text, x, y);
        } else if (isLine) {
          // Line Chart / Trend Point
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = dataset.borderColor || '#2563eb';
          
          const x = element.x;
          const y = Math.max(14, element.y - 6);
          ctx.fillText(text, x, y);
        } else {
          // Vertical Bar Chart
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = '#0f172a'; // slate-900
          
          const x = element.x;
          const y = Math.max(14, element.y - 4);
          ctx.fillText(text, x, y);
        }
      });
    });

    ctx.restore();
  }
};
