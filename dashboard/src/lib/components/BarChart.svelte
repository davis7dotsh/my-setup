<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import * as d3 from 'd3';

	interface Props {
		data: { label: string; value: number }[];
		width?: number;
		height?: number;
		color?: string;
		horizontal?: boolean;
	}

	let {
		data,
		width = 400,
		height = 300,
		color = 'var(--color-accent)',
		horizontal = false
	}: Props = $props();

	let svgElement: SVGSVGElement | undefined = $state();
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

	function renderChart(containerEl: HTMLDivElement) {
		if (!svgElement || !data || data.length === 0) return;

		const svg = d3.select(svgElement);
		svg.selectAll('*').remove();

		const margin = horizontal
			? { top: 10, right: 20, bottom: 20, left: 100 }
			: { top: 20, right: 20, bottom: 60, left: 50 };
		const innerWidth = actualWidth - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		// No glow filter (clean theme)

		const g = svg
			.attr('width', actualWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const resolvedColor = resolveCssColor(color);
		const total = d3.sum(data, (d) => d.value);
		const hoverFill = d3.color(resolvedColor)?.brighter(0.6).formatHex() ?? resolvedColor;

		if (horizontal) {
			const x = d3
				.scaleLinear()
				.domain([0, d3.max(data, (d) => d.value) || 0])
				.nice()
				.range([0, innerWidth]);

			const y = d3
				.scaleBand()
				.domain(data.map((d) => d.label))
				.range([0, innerHeight])
				.padding(0.3);

			// Grid
			g.append('g')
				.attr('class', 'grid')
				.call(
					d3
						.axisBottom(x)
						.tickSize(innerHeight)
						.tickFormat(() => '')
				)
				.attr('transform', `translate(0, 0)`)
				.selectAll('line')
				.attr('stroke', 'rgba(255, 255, 255, 0.06)');

			// Bars
			const bars = g
				.selectAll<SVGRectElement, (typeof data)[number]>('.bar')
				.data(data)
				.enter()
				.append('rect')
				.attr('class', 'bar')
				.attr('y', (d) => y(d.label) || 0)
				.attr('height', y.bandwidth())
				.attr('x', 0)
				.attr('width', 0)
				.attr('fill', resolvedColor)
				.attr('stroke', 'transparent')
				.attr('stroke-width', 1)
				.attr('rx', 0)
				.style('cursor', 'pointer')
				.on('pointerenter', function () {
					d3.select(this).attr('fill', hoverFill).attr('stroke', 'rgba(255, 255, 255, 0.25)');
				})
				.on('pointermove', function (event, d) {
					const [px, py] = d3.pointer(event, containerEl);
					const share = total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : '—';
					tooltip = {
						x: clamp(px + 12, 8, actualWidth - 170),
						y: clamp(py - 12, 8, height - 85),
						title: d.label,
						lines: [
							{ label: 'Cost', value: formatUsd(d.value) },
							{ label: 'Share', value: share }
						]
					};
				})
				.on('pointerleave', function () {
					tooltip = null;
					d3.select(this).attr('fill', resolvedColor).attr('stroke', 'transparent');
				});

			bars
				.transition()
				.duration(800)
				.delay((_, i) => i * 100)
				.attr('width', (d) => x(d.value));

			// Value labels
			g.selectAll('.value-label')
				.data(data)
				.enter()
				.append('text')
				.attr('class', 'value-label')
				.attr('y', (d) => (y(d.label) || 0) + y.bandwidth() / 2)
				.attr('x', (d) => x(d.value) + 8)
				.attr('dy', '0.35em')
				.attr('fill', 'rgba(255, 255, 255, 0.50)')
				.attr('font-size', '11px')
				.style('pointer-events', 'none')
				.text((d) => formatUsd(d.value));

			// Y axis
			g.append('g')
				.attr('class', 'axis')
				.call(d3.axisLeft(y))
				.selectAll('text')
				.attr('fill', 'rgba(255, 255, 255, 0.50)')
				.attr('font-size', '10px');

			g.selectAll('.domain').remove();
			g.selectAll('.tick line').remove();
		} else {
			const x = d3
				.scaleBand()
				.domain(data.map((d) => d.label))
				.range([0, innerWidth])
				.padding(0.3);

			const y = d3
				.scaleLinear()
				.domain([0, d3.max(data, (d) => d.value) || 0])
				.nice()
				.range([innerHeight, 0]);

			// Grid
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

			// Bars
			const bars = g
				.selectAll<SVGRectElement, (typeof data)[number]>('.bar')
				.data(data)
				.enter()
				.append('rect')
				.attr('class', 'bar')
				.attr('x', (d) => x(d.label) || 0)
				.attr('width', x.bandwidth())
				.attr('y', innerHeight)
				.attr('height', 0)
				.attr('fill', resolvedColor)
				.attr('stroke', 'transparent')
				.attr('stroke-width', 1)
				.attr('rx', 0)
				.style('cursor', 'pointer')
				.on('pointerenter', function () {
					d3.select(this).attr('fill', hoverFill).attr('stroke', 'rgba(255, 255, 255, 0.25)');
				})
				.on('pointermove', function (event, d) {
					const [px, py] = d3.pointer(event, containerEl);
					const share = total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : '—';
					tooltip = {
						x: clamp(px + 12, 8, actualWidth - 170),
						y: clamp(py - 12, 8, height - 85),
						title: d.label,
						lines: [
							{ label: 'Cost', value: formatUsd(d.value) },
							{ label: 'Share', value: share }
						]
					};
				})
				.on('pointerleave', function () {
					tooltip = null;
					d3.select(this).attr('fill', resolvedColor).attr('stroke', 'transparent');
				});

			bars
				.transition()
				.duration(800)
				.delay((_, i) => i * 50)
				.attr('y', (d) => y(d.value))
				.attr('height', (d) => innerHeight - y(d.value));

			// X axis
			g.append('g')
				.attr('class', 'axis')
				.attr('transform', `translate(0,${innerHeight})`)
				.call(d3.axisBottom(x))
				.selectAll('text')
				.attr('fill', 'rgba(255, 255, 255, 0.50)')
				.attr('font-size', '10px')
				.attr('transform', 'rotate(-45)')
				.attr('text-anchor', 'end');

			// Y axis
			g.append('g')
				.attr('class', 'axis')
				.call(d3.axisLeft(y).ticks(5))
				.selectAll('text')
				.attr('fill', 'rgba(255, 255, 255, 0.50)')
				.attr('font-size', '10px');

			g.selectAll('.domain').attr('stroke', 'rgba(255, 255, 255, 0.10)');
		}
	}

	const chartAttachment: Attachment = (container) => {
		const el = container as HTMLDivElement;
		actualWidth = el.clientWidth || width;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				actualWidth = entry.contentRect.width;
			}
		});
		resizeObserver.observe(el);

		$effect(() => {
			if (data && actualWidth) {
				renderChart(el);
			}
		});

		return () => resizeObserver.disconnect();
	};
</script>

<div {@attach chartAttachment} class="chart-container" style="width: 100%;">
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
