<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface Props {
		data: {
			date: string;
			tokens_input: number;
			tokens_output: number;
		}[];
		width?: number;
		height?: number;
	}

	let { data, width = 500, height = 250 }: Props = $props();

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

	function formatTokens(n: number) {
		return n.toLocaleString();
	}

	function renderChart() {
		if (!svgElement || !data || data.length === 0) return;

		const svg = d3.select(svgElement);
		svg.selectAll('*').remove();

		const margin = { top: 30, right: 20, bottom: 30, left: 60 };
		const innerWidth = actualWidth - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		const g = svg
			.attr('width', actualWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Gradients
		const defs = svg.append('defs');

		// Input gradient
		const inputGrad = defs
			.append('linearGradient')
			.attr('id', 'inputGrad')
			.attr('x1', '0%')
			.attr('y1', '0%')
			.attr('x2', '0%')
			.attr('y2', '100%');
		inputGrad
			.append('stop')
			.attr('offset', '0%')
			.attr('stop-color', 'var(--color-accent)')
			.attr('stop-opacity', 0.40);
		inputGrad
			.append('stop')
			.attr('offset', '100%')
			.attr('stop-color', 'var(--color-accent)')
			.attr('stop-opacity', 0.05);

		// Output gradient (neutral white)
		const outputGrad = defs
			.append('linearGradient')
			.attr('id', 'outputGrad')
			.attr('x1', '0%')
			.attr('y1', '0%')
			.attr('x2', '0%')
			.attr('y2', '100%');
		outputGrad
			.append('stop')
			.attr('offset', '0%')
			.attr('stop-color', 'rgba(255, 255, 255, 0.80)')
			.attr('stop-opacity', 0.28);
		outputGrad
			.append('stop')
			.attr('offset', '100%')
			.attr('stop-color', 'rgba(255, 255, 255, 0.80)')
			.attr('stop-opacity', 0.03);

		// No glow filters (clean theme)

		const parseDate = d3.timeParse('%Y-%m-%d');
		const parsedData = data
			.map((d) => ({
				date: parseDate(d.date) || new Date(d.date),
				input: d.tokens_input,
				output: d.tokens_output
			}))
			.sort((a, b) => a.date.getTime() - b.date.getTime());

		const formatDate = d3.timeFormat('%b %d, %Y');

		const maxVal = d3.max(parsedData, (d) => Math.max(d.input, d.output)) || 0;
		const y = d3.scaleLinear().domain([0, maxVal]).nice().range([innerHeight, 0]);

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

		// Legend (always show)
		const legend = g.append('g').attr('transform', `translate(${innerWidth - 100}, -15)`);
		legend
			.append('line')
			.attr('x1', 0)
			.attr('y1', 5)
			.attr('x2', 20)
			.attr('y2', 5)
			.attr('stroke', 'var(--color-accent)')
			.attr('stroke-width', 2);
		legend
			.append('text')
			.attr('x', 25)
			.attr('y', 8)
			.attr('fill', 'rgba(255, 255, 255, 0.50)')
			.attr('font-size', '10px')
			.text('Input');
		legend
			.append('line')
			.attr('x1', 60)
			.attr('y1', 5)
			.attr('x2', 80)
			.attr('y2', 5)
			.attr('stroke', 'rgba(255, 255, 255, 0.80)')
			.attr('stroke-width', 2);
		legend
			.append('text')
			.attr('x', 85)
			.attr('y', 8)
			.attr('fill', 'rgba(255, 255, 255, 0.50)')
			.attr('font-size', '10px')
			.text('Output');

		// Handle single data point - show as bars
		if (parsedData.length === 1) {
			const d = parsedData[0];
			const barWidth = Math.min(80, innerWidth / 4);
			const gap = 20;
			const centerX = innerWidth / 2;

			const tooltipLines = [
				{ label: 'Input', value: formatTokens(d.input) },
				{ label: 'Output', value: formatTokens(d.output) },
				{ label: 'Total', value: formatTokens(d.input + d.output) }
			];

			// Input bar
			const inputBar = g
				.append('rect')
				.attr('x', centerX - barWidth - gap / 2)
				.attr('y', innerHeight)
				.attr('width', barWidth)
				.attr('height', 0)
				.attr('fill', 'url(#inputGrad)')
				.attr('stroke', 'var(--color-accent)')
				.attr('stroke-width', 2)
				.attr('rx', 0)
				.style('cursor', 'pointer')
				.on('pointermove', (event) => {
					if (!containerEl) return;
					const [px, py] = d3.pointer(event, containerEl);
					tooltip = {
						x: clamp(px + 12, 8, actualWidth - 170),
						y: clamp(py - 12, 8, height - 110),
						title: formatDate(d.date),
						lines: tooltipLines
					};
				})
				.on('pointerleave', () => {
					tooltip = null;
				});

			inputBar
				.transition()
				.duration(800)
				.attr('y', y(d.input))
				.attr('height', innerHeight - y(d.input));

			// Output bar
			const outputBar = g
				.append('rect')
				.attr('x', centerX + gap / 2)
				.attr('y', innerHeight)
				.attr('width', barWidth)
				.attr('height', 0)
				.attr('fill', 'url(#outputGrad)')
				.attr('stroke', 'rgba(255, 255, 255, 0.80)')
				.attr('stroke-width', 2)
				.attr('rx', 0)
				.style('cursor', 'pointer')
				.on('pointermove', (event) => {
					if (!containerEl) return;
					const [px, py] = d3.pointer(event, containerEl);
					tooltip = {
						x: clamp(px + 12, 8, actualWidth - 170),
						y: clamp(py - 12, 8, height - 110),
						title: formatDate(d.date),
						lines: tooltipLines
					};
				})
				.on('pointerleave', () => {
					tooltip = null;
				});

			outputBar
				.transition()
				.duration(800)
				.delay(200)
				.attr('y', y(d.output))
				.attr('height', innerHeight - y(d.output));

			// Value labels
			g.append('text')
				.attr('x', centerX - barWidth / 2 - gap / 2)
				.attr('y', y(d.input) - 10)
				.attr('text-anchor', 'middle')
				.attr('fill', 'var(--color-accent)')
				.attr('font-size', '12px')
				.attr('font-weight', '600')
				.attr('opacity', 0)
				.text(d3.format('.3s')(d.input))
				.transition()
				.duration(800)
				.attr('opacity', 1);

			g.append('text')
				.attr('x', centerX + barWidth / 2 + gap / 2)
				.attr('y', y(d.output) - 10)
				.attr('text-anchor', 'middle')
				.attr('fill', 'rgba(255, 255, 255, 0.80)')
				.attr('font-size', '12px')
				.attr('font-weight', '600')
				.attr('opacity', 0)
				.text(d3.format('.3s')(d.output))
				.transition()
				.duration(800)
				.delay(200)
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
				.call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2s')))
				.selectAll('text')
				.attr('fill', 'rgba(255, 255, 255, 0.50)')
				.attr('font-size', '10px');

			g.selectAll('.domain').attr('stroke', 'rgba(255, 255, 255, 0.10)');
			return;
		}

		// Multiple data points - show as area/line chart
		const x = d3
			.scaleTime()
			.domain(d3.extent(parsedData, (d) => d.date) as [Date, Date])
			.range([0, innerWidth]);

		// Input area
		const inputArea = d3
			.area<{ date: Date; input: number; output: number }>()
			.x((d) => x(d.date))
			.y0(innerHeight)
			.y1((d) => y(d.input))
			.curve(d3.curveMonotoneX);

		g.append('path')
			.datum(parsedData)
			.attr('fill', 'url(#inputGrad)')
			.attr('d', inputArea)
			.attr('opacity', 0)
			.transition()
			.duration(800)
			.attr('opacity', 1);

		// Output area
		const outputArea = d3
			.area<{ date: Date; input: number; output: number }>()
			.x((d) => x(d.date))
			.y0(innerHeight)
			.y1((d) => y(d.output))
			.curve(d3.curveMonotoneX);

		g.append('path')
			.datum(parsedData)
			.attr('fill', 'url(#outputGrad)')
			.attr('d', outputArea)
			.attr('opacity', 0)
			.transition()
			.duration(800)
			.delay(200)
			.attr('opacity', 1);

		// Input line
		const inputLine = d3
			.line<{ date: Date; input: number; output: number }>()
			.x((d) => x(d.date))
			.y((d) => y(d.input))
			.curve(d3.curveMonotoneX);

		const inputPath = g
			.append('path')
			.datum(parsedData)
			.attr('fill', 'none')
			.attr('stroke', 'var(--color-accent)')
			.attr('stroke-width', 2)
			.attr('d', inputLine);

		const inputLength = inputPath.node()?.getTotalLength() || 0;
		inputPath
			.attr('stroke-dasharray', `${inputLength} ${inputLength}`)
			.attr('stroke-dashoffset', inputLength)
			.transition()
			.duration(1000)
			.ease(d3.easeQuadOut)
			.attr('stroke-dashoffset', 0);

		// Output line
		const outputLine = d3
			.line<{ date: Date; input: number; output: number }>()
			.x((d) => x(d.date))
			.y((d) => y(d.output))
			.curve(d3.curveMonotoneX);

		const outputPath = g
			.append('path')
			.datum(parsedData)
			.attr('fill', 'none')
			.attr('stroke', 'rgba(255, 255, 255, 0.80)')
			.attr('stroke-width', 2)
			.attr('d', outputLine);

		const outputLength = outputPath.node()?.getTotalLength() || 0;
		outputPath
			.attr('stroke-dasharray', `${outputLength} ${outputLength}`)
			.attr('stroke-dashoffset', outputLength)
			.transition()
			.duration(1000)
			.delay(150)
			.ease(d3.easeQuadOut)
			.attr('stroke-dashoffset', 0);

		// Data points
		g.selectAll('.input-dot')
			.data(parsedData)
			.enter()
			.append('circle')
			.attr('class', 'input-dot')
			.attr('cx', (d) => x(d.date))
			.attr('cy', (d) => y(d.input))
			.attr('r', 0)
			.attr('fill', 'var(--color-accent)')
			.style('pointer-events', 'none')
			.transition()
			.delay((_, i) => i * 30)
			.duration(250)
			.attr('r', 3);

		g.selectAll('.output-dot')
			.data(parsedData)
			.enter()
			.append('circle')
			.attr('class', 'output-dot')
			.attr('cx', (d) => x(d.date))
			.attr('cy', (d) => y(d.output))
			.attr('r', 0)
			.attr('fill', 'rgba(255, 255, 255, 0.80)')
			.style('pointer-events', 'none')
			.transition()
			.delay((_, i) => i * 30 + 150)
			.duration(250)
			.attr('r', 3);

		// Axes
		g.append('g')
			.attr('class', 'axis')
			.attr('transform', `translate(0,${innerHeight})`)
			.call(
				d3
					.axisBottom(x)
					.ticks(5)
					.tickFormat((d) => d3.timeFormat('%b %d')(d as Date))
			)
			.selectAll('text')
			.attr('fill', 'rgba(255, 255, 255, 0.50)')
			.attr('font-size', '10px');

		g.append('g')
			.attr('class', 'axis')
			.call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2s')))
			.selectAll('text')
			.attr('fill', 'rgba(255, 255, 255, 0.50)')
			.attr('font-size', '10px');

		g.selectAll('.domain').attr('stroke', 'rgba(255, 255, 255, 0.10)');

		// Hover focus + tooltip
		const focus = g.append('g').style('display', 'none');

		const focusLine = focus
			.append('line')
			.attr('y1', 0)
			.attr('y2', innerHeight)
			.attr('stroke', 'rgba(255, 255, 255, 0.18)')
			.attr('stroke-dasharray', '3,3');

		const inputOuter = focus
			.append('circle')
			.attr('r', 7)
			.attr('fill', 'rgba(0, 0, 0, 0.85)')
			.attr('stroke', 'var(--color-accent)')
			.attr('stroke-width', 1.5);
		const inputDot = focus.append('circle').attr('r', 3).attr('fill', 'var(--color-accent)');

		const outputOuter = focus
			.append('circle')
			.attr('r', 7)
			.attr('fill', 'rgba(0, 0, 0, 0.85)')
			.attr('stroke', 'rgba(255, 255, 255, 0.80)')
			.attr('stroke-width', 1.5);
		const outputDot = focus.append('circle').attr('r', 3).attr('fill', 'rgba(255, 252, 244, 0.78)');

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
				const cyInput = y(d.input);
				const cyOutput = y(d.output);

				focus.attr('transform', `translate(${cx},0)`);
				focusLine.attr('x1', 0).attr('x2', 0);

				inputOuter.attr('cx', 0).attr('cy', cyInput);
				inputDot.attr('cx', 0).attr('cy', cyInput);
				outputOuter.attr('cx', 0).attr('cy', cyOutput);
				outputDot.attr('cx', 0).attr('cy', cyOutput);

				if (!containerEl) return;
				const [px, py] = d3.pointer(event, containerEl);
				tooltip = {
					x: clamp(px + 12, 8, actualWidth - 170),
					y: clamp(py - 12, 8, height - 110),
					title: formatDate(d.date),
					lines: [
						{ label: 'Input', value: formatTokens(d.input) },
						{ label: 'Output', value: formatTokens(d.output) },
						{ label: 'Total', value: formatTokens(d.input + d.output) }
					]
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
