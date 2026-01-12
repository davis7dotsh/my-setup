<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import * as d3 from 'd3';

	interface Props {
		data: { label: string; value: number }[];
		width?: number;
		height?: number;
		showLegend?: boolean;
	}

	let { data, width = 300, height = 300, showLegend = false }: Props = $props();

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

	function formatUsd(n: number) {
		if (n >= 100) return `$${n.toFixed(0)}`;
		if (n >= 1) return `$${n.toFixed(2)}`;
		return `$${n.toFixed(4)}`;
	}

	const colors = [
		'var(--color-accent)',
		'var(--color-accent-2)',
		'rgba(255, 255, 255, 0.85)',
		'rgba(255, 255, 255, 0.65)',
		'rgba(255, 255, 255, 0.45)',
		'rgba(255, 255, 255, 0.30)',
		'rgba(255, 255, 255, 0.18)'
	];

	function renderChart(containerEl: HTMLDivElement) {
		if (!svgElement || !data || data.length === 0) return;

		const svg = d3.select(svgElement);
		svg.selectAll('*').remove();

		const size = Math.min(actualWidth, height);
		const radius = size / 2 - 20;
		const innerRadius = radius * 0.6;

		svg.attr('width', actualWidth).attr('height', height);

		// No glow filter (clean theme)

		// Center the donut - if legend is shown, shift left to make room
		const centerX = showLegend ? actualWidth / 2 - 60 : actualWidth / 2;
		const g = svg.append('g').attr('transform', `translate(${centerX},${height / 2})`);

		const pie = d3
			.pie<{ label: string; value: number }>()
			.value((d) => d.value)
			.sort(null)
			.padAngle(0.02);

		const arc = d3
			.arc<d3.PieArcDatum<{ label: string; value: number }>>()
			.innerRadius(innerRadius)
			.outerRadius(radius);

		const arcHover = d3
			.arc<d3.PieArcDatum<{ label: string; value: number }>>()
			.innerRadius(innerRadius)
			.outerRadius(radius + 10);

		const total = d3.sum(data, (d) => d.value);
		const pieData = pie(data);

		let centerValueText: d3.Selection<SVGTextElement, unknown, null, undefined> | null = null;
		let centerLabelText: d3.Selection<SVGTextElement, unknown, null, undefined> | null = null;

		function setCenterValue(value: string, label: string, valueColor?: string) {
			centerValueText?.text(value);
			if (valueColor) centerValueText?.attr('fill', valueColor);
			centerLabelText?.text(label);
		}

		function resetCenter() {
			setCenterValue(formatUsd(total), 'TOTAL COST', 'var(--color-accent)');
		}

		function updateTooltip(event: PointerEvent, title: string, lines: TooltipState['lines']) {
			const [px, py] = d3.pointer(event, containerEl);
			tooltip = {
				x: clamp(px + 12, 8, actualWidth - 170),
				y: clamp(py - 12, 8, height - 85),
				title,
				lines
			};
		}

		const arcs = g.selectAll('.arc').data(pieData).enter().append('g').attr('class', 'arc');

		const paths = arcs
			.append('path')
			.attr('d', arc)
			.attr('fill', (_, i) => colors[i % colors.length])
			.attr('opacity', 0.9)
			.attr('stroke', 'rgba(255, 255, 255, 0.08)')
			.attr('stroke-width', 1)
			.style('cursor', 'pointer')
			.on('pointerenter', function (event, d) {
				const sliceColor = colors[d.index % colors.length];
				d3.select(this)
					.interrupt()
					.transition()
					.duration(180)
					.attr('d', arcHover(d))
					.attr('opacity', 1);

				const share = total > 0 ? `${((d.data.value / total) * 100).toFixed(1)}%` : '—';
				setCenterValue(formatUsd(d.data.value), d.data.label, sliceColor);
				updateTooltip(event as PointerEvent, d.data.label, [
					{ label: 'Cost', value: formatUsd(d.data.value) },
					{ label: 'Share', value: share }
				]);
			})
			.on('pointermove', function (event, d) {
				const share = total > 0 ? `${((d.data.value / total) * 100).toFixed(1)}%` : '—';
				updateTooltip(event as PointerEvent, d.data.label, [
					{ label: 'Cost', value: formatUsd(d.data.value) },
					{ label: 'Share', value: share }
				]);
			})
			.on('pointerleave', function (event, d) {
				d3.select(this)
					.interrupt()
					.transition()
					.duration(180)
					.attr('d', arc(d))
					.attr('opacity', 0.9);
				tooltip = null;
				resetCenter();
			});

		paths
			.transition()
			.duration(800)
			.attrTween('d', function (d) {
				const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
				return (t) => arc(interpolate(t)) || '';
			});

		// Center text
		centerValueText = g
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dy', '-0.2em')
			.attr('fill', 'var(--color-accent)')
			.attr('font-size', '24px')
			.attr('font-weight', '600')
			.attr('font-family', 'JetBrains Mono, monospace');

		centerLabelText = g
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dy', '1.2em')
			.attr('fill', 'rgba(255, 255, 255, 0.50)')
			.attr('font-size', '10px')
			.attr('letter-spacing', '0.1em');

		resetCenter();

		// Legend (optional)
		if (showLegend) {
			const legend = svg.append('g').attr('transform', `translate(${actualWidth - 120}, 20)`);

			const legendItems = legend
				.selectAll<SVGGElement, (typeof data)[number]>('.legend-item')
				.data(data)
				.enter()
				.append('g')
				.attr('class', 'legend-item')
				.attr('data-index', (_, i) => String(i))
				.attr('transform', (_, i) => `translate(0, ${i * 20})`)
				.style('cursor', 'pointer')
				.on('pointerenter', function (event, d) {
					const index = Number((this as SVGGElement).getAttribute('data-index'));
					const arcDatum = pieData[index];
					const sliceColor = colors[index % colors.length];

					paths
						.filter((_, i) => i === index)
						.interrupt()
						.transition()
						.duration(180)
						.attr('d', arcHover(arcDatum))
						.attr('opacity', 1);

					const share = total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : '—';
					setCenterValue(formatUsd(d.value), d.label, sliceColor);
					updateTooltip(event as PointerEvent, d.label, [
						{ label: 'Cost', value: formatUsd(d.value) },
						{ label: 'Share', value: share }
					]);
				})
				.on('pointermove', function (event, d) {
					const share = total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : '—';
					updateTooltip(event as PointerEvent, d.label, [
						{ label: 'Cost', value: formatUsd(d.value) },
						{ label: 'Share', value: share }
					]);
				})
				.on('pointerleave', function () {
					const index = Number((this as SVGGElement).getAttribute('data-index'));
					const arcDatum = pieData[index];
					paths
						.filter((_, i) => i === index)
						.interrupt()
						.transition()
						.duration(180)
						.attr('d', arc(arcDatum))
						.attr('opacity', 0.9);

					tooltip = null;
					resetCenter();
				});

			legendItems
				.append('rect')
				.attr('width', 12)
				.attr('height', 12)
				.attr('rx', 0)
				.attr('fill', (_, i) => colors[i % colors.length]);

			legendItems
				.append('text')
				.attr('x', 18)
				.attr('y', 10)
				.attr('fill', 'rgba(255, 255, 255, 0.50)')
				.attr('font-size', '9px')
				.text((d) => (d.label.length > 12 ? d.label.slice(0, 12) + '...' : d.label));
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
