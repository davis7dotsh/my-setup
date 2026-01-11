<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface Props {
		hourData: { hour: number; request_count: number; cost_usd: number }[];
		dayData: { day_of_week: number; request_count: number; cost_usd: number }[];
		width?: number;
		height?: number;
	}

	let { hourData, dayData, width = 600, height = 200 }: Props = $props();

	let svgElement: SVGSVGElement;
	let containerEl: HTMLDivElement;
	let actualWidth = $state(width);

	type TooltipState = {
		x: number;
		y: number;
		title: string;
		lines: { label: string; value: string }[];
	};

	let tooltip = $state<TooltipState | null>(null);

	function clamp(n: number, min: number, max: number) {
		return Math.max(min, Math.min(max, n));
	}

	function formatUsd(n: number) {
		if (n >= 100) return `$${n.toFixed(0)}`;
		if (n >= 1) return `$${n.toFixed(2)}`;
		return `$${n.toFixed(4)}`;
	}

	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const hours = Array.from({ length: 24 }, (_, i) => i);

	function renderChart() {
		if (!svgElement || !hourData || !dayData) return;

		const svg = d3.select(svgElement);
		svg.selectAll('*').remove();

		const margin = { top: 30, right: 20, bottom: 50, left: 60 };
		const innerWidth = actualWidth - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		const g = svg
			.attr('width', actualWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Build heatmap data (7 days x 24 hours)
		// For now, we'll use hour data for column brightness and day data for row brightness
		const maxRequests = Math.max(
			d3.max(hourData, (d) => d.request_count) || 1,
			d3.max(dayData, (d) => d.request_count) || 1
		);

		const hourRequestMap = new Map(hourData.map((d) => [d.hour, d.request_count]));
		const dayRequestMap = new Map(dayData.map((d) => [d.day_of_week, d.request_count]));
		const hourCostMap = new Map(hourData.map((d) => [d.hour, d.cost_usd]));
		const dayCostMap = new Map(dayData.map((d) => [d.day_of_week, d.cost_usd]));

		// Generate combined intensity
		type HeatmapCell = {
			day: number;
			hour: number;
			value: number;
			dayRequests: number;
			hourRequests: number;
			dayCost: number;
			hourCost: number;
		};

		const heatmapData: HeatmapCell[] = [];
		for (let day = 0; day < 7; day++) {
			for (let hour = 0; hour < 24; hour++) {
				const dayRequests = dayRequestMap.get(day) || 0;
				const hourRequests = hourRequestMap.get(hour) || 0;
				const dayCost = dayCostMap.get(day) || 0;
				const hourCost = hourCostMap.get(hour) || 0;

				// Combine day and hour intensity (requests only)
				const value = (dayRequests + hourRequests) / 2;
				heatmapData.push({ day, hour, value, dayRequests, hourRequests, dayCost, hourCost });
			}
		}

		const cellWidth = innerWidth / 24;
		const cellHeight = innerHeight / 7;

		// Color scale
		const colorScale = d3
			.scaleSequential()
			.domain([0, maxRequests])
			.interpolator(d3.interpolateRgb('#000000', '#3b82f6'));

		// No glow filter (clean theme)

		// Cells
		const cells = g
			.selectAll<SVGRectElement, HeatmapCell>('.cell')
			.data(heatmapData)
			.enter()
			.append('rect')
			.attr('class', 'cell')
			.attr('x', (d) => d.hour * cellWidth)
			.attr('y', (d) => d.day * cellHeight)
			.attr('width', cellWidth - 2)
			.attr('height', cellHeight - 2)
			.attr('rx', 0)
			.attr('fill', '#000000')
			.attr('stroke', 'rgba(255, 255, 255, 0.10)')
			.attr('stroke-width', 0.5)
			.style('cursor', 'pointer')
			.on('pointerenter', function () {
				d3.select(this)
					.interrupt()
					.attr('stroke', 'rgba(255, 255, 255, 0.35)')
					.attr('stroke-width', 1.5);
			})
			.on('pointermove', function (event, d) {
				if (!containerEl) return;
				const [px, py] = d3.pointer(event, containerEl);
				tooltip = {
					x: clamp(px + 12, 8, actualWidth - 170),
					y: clamp(py - 12, 8, height - 120),
					title: `${days[d.day]} • ${String(d.hour).padStart(2, '0')}:00`,
					lines: [
						{ label: 'Hour req', value: d.hourRequests.toLocaleString() },
						{ label: 'Day req', value: d.dayRequests.toLocaleString() },
						{ label: 'Hour cost', value: formatUsd(d.hourCost) },
						{ label: 'Day cost', value: formatUsd(d.dayCost) }
					]
				};
			})
			.on('pointerleave', function () {
				tooltip = null;
				d3.select(this)
					.interrupt()
					.attr('stroke', 'rgba(255, 255, 255, 0.10)')
					.attr('stroke-width', 0.5);
			});

		cells
			.transition()
			.duration(800)
			.delay((d) => d.hour * 20 + d.day * 50)
			.attr('fill', (d) => colorScale(d.value));

		// Hour labels (x-axis)
		g.append('g')
			.selectAll('.hour-label')
			.data(hours.filter((h) => h % 3 === 0))
			.enter()
			.append('text')
			.attr('class', 'hour-label')
			.attr('x', (d) => d * cellWidth + cellWidth / 2)
			.attr('y', innerHeight + 20)
			.attr('text-anchor', 'middle')
			.attr('fill', 'rgba(136, 136, 160, 0.8)')
			.attr('font-size', '10px')
			.text((d) => `${d}:00`);

		// Day labels (y-axis)
		g.append('g')
			.selectAll('.day-label')
			.data(days)
			.enter()
			.append('text')
			.attr('class', 'day-label')
			.attr('x', -10)
			.attr('y', (_, i) => i * cellHeight + cellHeight / 2)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'middle')
			.attr('fill', 'rgba(136, 136, 160, 0.8)')
			.attr('font-size', '10px')
			.text((d) => d);

		// Title
		svg
			.append('text')
			.attr('x', actualWidth / 2)
			.attr('y', 15)
			.attr('text-anchor', 'middle')
			.attr('fill', 'rgba(136, 136, 160, 0.6)')
			.attr('font-size', '11px')
			.attr('letter-spacing', '0.1em')
			.text('ACTIVITY HEATMAP');
	}

	onMount(() => {
		if (containerEl) {
			const resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					actualWidth = entry.contentRect.width;
				}
			});
			resizeObserver.observe(containerEl);
			return () => resizeObserver.disconnect();
		}
	});

	$effect(() => {
		if (hourData && dayData && actualWidth) {
			renderChart();
		}
	});
</script>

<div bind:this={containerEl} class="chart-container" style="width: 100%;">
	<svg bind:this={svgElement}></svg>
	{#if tooltip}
		<div class="tooltip" style={`left: ${tooltip.x}px; top: ${tooltip.y}px;`}>
			<div class="tooltip-title">{tooltip.title}</div>
			{#each tooltip.lines as line}
				<div class="tooltip-row">
					<span class="muted">{line.label}</span>
					<span class="value">{line.value}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
