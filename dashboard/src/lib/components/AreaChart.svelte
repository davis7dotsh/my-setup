<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface Props {
		data: { date: string; value: number }[];
		width?: number;
		height?: number;
		color?: string;
		gradientId?: string;
	}

	let {
		data,
		width = 500,
		height = 200,
		color = 'var(--color-accent)',
		gradientId = 'areaGrad'
	}: Props = $props();

	let svgElement: SVGSVGElement;
	let containerEl: HTMLDivElement;
	let actualWidth = $state(0);

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

	function resolveCssColor(value: string) {
		if (typeof window === 'undefined') return value;
		const match = value.match(/^var\((--[^)]+)\)$/);
		if (!match) return value;
		return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || value;
	}

	function formatUsd(n: number) {
		if (n >= 100) return `$${n.toFixed(0)}`;
		if (n >= 1) return `$${n.toFixed(2)}`;
		return `$${n.toFixed(4)}`;
	}

	function renderChart() {
		if (!svgElement || !data || data.length === 0) return;

		const svg = d3.select(svgElement);
		svg.selectAll('*').remove();

		const resolvedColor = resolveCssColor(color);

		const margin = { top: 35, right: 20, bottom: 30, left: 50 };
		const innerWidth = actualWidth - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		const g = svg
			.attr('width', actualWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Gradient
		const defs = svg.append('defs');
		const gradient = defs
			.append('linearGradient')
			.attr('id', gradientId)
			.attr('x1', '0%')
			.attr('y1', '0%')
			.attr('x2', '0%')
			.attr('y2', '100%');
		gradient
			.append('stop')
			.attr('offset', '0%')
			.attr('stop-color', resolvedColor)
			.attr('stop-opacity', 0.4);
		gradient
			.append('stop')
			.attr('offset', '100%')
			.attr('stop-color', resolvedColor)
			.attr('stop-opacity', 0);

		// No glow filter (clean theme)

		// Parse dates and convert to local timezone for display
		const parsedData = data
			.map((d) => {
				// Parse as UTC then create a local date with the same calendar values
				const [year, month, day] = d.date.split('-').map(Number);
				return {
					date: new Date(year, month - 1, day), // Local timezone
					value: d.value
				};
			})
			.sort((a, b) => a.date.getTime() - b.date.getTime());

		// Format in local timezone
		const formatDate = (d: Date) =>
			d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

		const y = d3
			.scaleLinear()
			.domain([0, d3.max(parsedData, (d) => d.value) || 0])
			.nice()
			.range([innerHeight, 0]);

		// Grid lines (y-axis)
		g.append('g')
			.attr('class', 'grid')
			.call(
				d3
					.axisLeft(y)
					.tickSize(-innerWidth)
					.tickFormat(() => '')
			)
			.selectAll('line')
			.attr('stroke', 'rgba(255, 255, 255, 0.06)');

		// Handle single data point - show as a bar
		if (parsedData.length === 1) {
			const d = parsedData[0];
			const barWidth = Math.min(100, innerWidth / 3);
			const centerX = innerWidth / 2;

			// Bar
			const bar = g
				.append('rect')
				.attr('x', centerX - barWidth / 2)
				.attr('y', innerHeight)
				.attr('width', barWidth)
				.attr('height', 0)
				.attr('fill', `url(#${gradientId})`)
				.attr('stroke', resolvedColor)
				.attr('stroke-width', 2)
				.attr('rx', 0)
				.style('cursor', 'pointer')
				.on('pointermove', (event) => {
					if (!containerEl) return;
					const [px, py] = d3.pointer(event, containerEl);
					tooltip = {
						x: clamp(px + 12, 8, actualWidth - 170),
						y: clamp(py - 12, 8, height - 70),
						title: formatDate(d.date),
						lines: [{ label: 'Cost', value: formatUsd(d.value) }]
					};
				})
				.on('pointerleave', () => {
					tooltip = null;
				});

			bar
				.transition()
				.duration(800)
				.attr('y', y(d.value))
				.attr('height', innerHeight - y(d.value));

			// Value label
			g.append('text')
				.attr('x', centerX)
				.attr('y', y(d.value) - 15)
				.attr('text-anchor', 'middle')
				.attr('fill', resolvedColor)
				.attr('font-size', '16px')
				.attr('font-weight', '600')
				.attr('font-family', 'JetBrains Mono, monospace')
				.attr('opacity', 0)
				.text(`$${d.value.toFixed(2)}`)
				.transition()
				.duration(800)
				.attr('opacity', 1);

			// Date label
			g.append('text')
				.attr('x', centerX)
				.attr('y', innerHeight + 20)
				.attr('text-anchor', 'middle')
				.attr('fill', 'rgba(255, 255, 255, 0.50)')
				.attr('font-size', '10px')
				.text(d3.timeFormat('%b %d, %Y')(d.date));

			// Y axis
			g.append('g')
				.attr('class', 'axis')
				.call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('$.2s')))
				.selectAll('text')
				.attr('fill', 'rgba(255, 255, 255, 0.50)')
				.attr('font-size', '10px');

			g.selectAll('.domain').attr('stroke', 'rgba(255, 255, 255, 0.10)');
			return;
		}

		// Multiple data points - show as area chart
		const x = d3
			.scaleTime()
			.domain(d3.extent(parsedData, (d) => d.date) as [Date, Date])
			.range([0, innerWidth]);

		// Grid lines (x-axis)
		g.append('g')
			.attr('class', 'grid')
			.attr('transform', `translate(0,${innerHeight})`)
			.call(
				d3
					.axisBottom(x)
					.tickSize(-innerHeight)
					.tickFormat(() => '')
			)
			.selectAll('line')
			.attr('stroke', 'rgba(255, 255, 255, 0.06)');

		// Area
		const area = d3
			.area<{ date: Date; value: number }>()
			.x((d) => x(d.date))
			.y0(innerHeight)
			.y1((d) => y(d.value))
			.curve(d3.curveMonotoneX);

		g.append('path')
			.datum(parsedData)
			.attr('fill', `url(#${gradientId})`)
			.attr('d', area)
			.attr('opacity', 0)
			.transition()
			.duration(800)
			.attr('opacity', 1);

		// Line
		const line = d3
			.line<{ date: Date; value: number }>()
			.x((d) => x(d.date))
			.y((d) => y(d.value))
			.curve(d3.curveMonotoneX);

		const path = g
			.append('path')
			.datum(parsedData)
			.attr('fill', 'none')
			.attr('stroke', resolvedColor)
			.attr('stroke-width', 2)

			.attr('d', line);

		// Animate line
		const totalLength = path.node()?.getTotalLength() || 0;
		path
			.attr('stroke-dasharray', `${totalLength} ${totalLength}`)
			.attr('stroke-dashoffset', totalLength)
			.transition()
			.duration(1000)
			.ease(d3.easeQuadOut)
			.attr('stroke-dashoffset', 0);

		// Axes
		g.append('g')
			.attr('class', 'axis')
			.attr('transform', `translate(0,${innerHeight})`)
			.call(
				d3
					.axisBottom(x)
					.ticks(5)
					.tickFormat((d) => (d as Date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
			)
			.selectAll('text')
			.attr('fill', 'rgba(255, 255, 255, 0.50)')
			.attr('font-size', '10px');

		g.append('g')
			.attr('class', 'axis')
			.call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('$.2s')))
			.selectAll('text')
			.attr('fill', 'rgba(255, 255, 255, 0.50)')
			.attr('font-size', '10px');

		// Remove axis domain lines
		g.selectAll('.domain').attr('stroke', 'rgba(255, 255, 255, 0.10)');

		// Dots
		g.selectAll('.dot')
			.data(parsedData)
			.enter()
			.append('circle')
			.attr('class', 'dot')
			.attr('cx', (d) => x(d.date))
			.attr('cy', (d) => y(d.value))
			.attr('r', 0)
			.attr('fill', resolvedColor)
			.style('pointer-events', 'none')
			.transition()
			.delay((_, i) => i * 50)
			.duration(300)
			.attr('r', 3);

		// Hover focus + tooltip
		const focus = g.append('g').style('display', 'none');

		const focusLine = focus
			.append('line')
			.attr('y1', 0)
			.attr('y2', innerHeight)
			.attr('stroke', 'rgba(255, 255, 255, 0.18)')
			.attr('stroke-dasharray', '3,3');

		const focusOuter = focus
			.append('circle')
			.attr('r', 7)
			.attr('fill', 'rgba(0, 0, 0, 0.85)')
			.attr('stroke', resolvedColor)
			.attr('stroke-width', 1.5);

		const focusDot = focus.append('circle').attr('r', 3).attr('fill', resolvedColor);

		const bisectDate = d3.bisector((d: { date: Date }) => d.date).left;

		g.append('rect')
			.attr('width', innerWidth)
			.attr('height', innerHeight)
			.attr('fill', 'transparent')
			.style('cursor', 'crosshair')
			.on('pointerenter', () => {
				focus.style('display', null);
			})
			.on('pointerleave', () => {
				focus.style('display', 'none');
				tooltip = null;
			})
			.on('pointermove', (event) => {
				const [mx] = d3.pointer(event, g.node() as SVGGElement);
				const x0 = x.invert(mx);

				const i = bisectDate(parsedData, x0, 1);
				const a = parsedData[i - 1];
				const b = parsedData[i] ?? a;
				const d = x0.getTime() - a.date.getTime() > b.date.getTime() - x0.getTime() ? b : a;

				const cx = x(d.date);
				const cy = y(d.value);

				focus.attr('transform', `translate(${cx},0)`);
				focusLine.attr('x1', 0).attr('x2', 0);
				focusOuter.attr('cx', 0).attr('cy', cy);
				focusDot.attr('cx', 0).attr('cy', cy);

				if (!containerEl) return;
				const [px, py] = d3.pointer(event, containerEl);
				tooltip = {
					x: clamp(px + 12, 8, actualWidth - 170),
					y: clamp(py - 12, 8, height - 70),
					title: formatDate(d.date),
					lines: [{ label: 'Cost', value: formatUsd(d.value) }]
				};
			});
	}

	onMount(() => {
		if (containerEl) {
			actualWidth = containerEl.clientWidth || width;
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
		if (data && actualWidth) {
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
