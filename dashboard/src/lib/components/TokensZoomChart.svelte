<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import * as d3 from 'd3';

	type Range = 'day' | 'week' | 'month' | 'year';

	interface Props {
		height?: number;
		width?: number;
		// Today only
		hourly: { hour: number; tokens_input: number; tokens_output: number }[];
		// Daily totals (ideally >= 365 days)
		daily: { date: string; tokens_input: number; tokens_output: number }[];
		initialRange?: Range;
	}

	let { hourly, daily, height = 220, width = 900, initialRange = 'day' }: Props = $props();

	let svgElement: SVGSVGElement | undefined = $state();
	let actualWidth = $state(0);
	let range = $state<Range>(initialRange);

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

	function nextRange(current: Range, direction: 1 | -1): Range {
		const ranges: Range[] = ['day', 'week', 'month', 'year'];
		const idx = ranges.indexOf(current);
		const next = clamp(idx + direction, 0, ranges.length - 1);
		return ranges[next] ?? current;
	}

	function normalizeDaily() {
		// Parse dates and convert to local timezone for display
		return daily
			.map((d) => {
				const [year, month, day] = d.date.split('-').map(Number);
				return {
					date: new Date(year, month - 1, day), // Local timezone
					input: d.tokens_input,
					output: d.tokens_output
				};
			})
			.sort((a, b) => a.date.getTime() - b.date.getTime());
	}

	function renderChart(containerEl: HTMLDivElement) {
		if (!svgElement) return;

		const svg = d3.select(svgElement);
		svg.selectAll('*').remove();

		const margin = { top: 26, right: 20, bottom: 34, left: 70 };
		const innerWidth = actualWidth - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		const g = svg
			.attr('width', actualWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const dailyParsed = normalizeDaily();
		const today = new Date();
		today.setMinutes(0, 0, 0);

		type Point = {
			x: number | Date;
			input: number;
			output: number;
			label: string;
		};

		let points: Point[] = [];
		let xType: 'hour' | 'time' = 'time';

		if (range === 'day') {
			xType = 'hour';
			const hourMap = new Map(hourly.map((d) => [d.hour, d]));
			points = Array.from({ length: 24 }, (_, h) => {
				const entry = hourMap.get(h);
				return {
					x: h,
					input: entry?.tokens_input ?? 0,
					output: entry?.tokens_output ?? 0,
					label: `${String(h).padStart(2, '0')}:00`
				};
			});
		} else if (range === 'week') {
			const start = new Date();
			start.setHours(0, 0, 0, 0);
			start.setDate(start.getDate() - 6);

			const formatKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			const map = new Map(dailyParsed.map((d) => [formatKey(d.date), d]));
			points = Array.from({ length: 7 }, (_, i) => {
				const date = new Date(start);
				date.setDate(start.getDate() + i);
				const key = formatKey(date);
				const entry = map.get(key);
				return {
					x: date,
					input: entry?.input ?? 0,
					output: entry?.output ?? 0,
					label: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
				};
			});
		} else if (range === 'month') {
			const start = new Date();
			start.setHours(0, 0, 0, 0);
			start.setDate(start.getDate() - 29);

			const formatKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			const map = new Map(dailyParsed.map((d) => [formatKey(d.date), d]));
			points = Array.from({ length: 30 }, (_, i) => {
				const date = new Date(start);
				date.setDate(start.getDate() + i);
				const key = formatKey(date);
				const entry = map.get(key);
				return {
					x: date,
					input: entry?.input ?? 0,
					output: entry?.output ?? 0,
					label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
				};
			});
		} else {
			// year
			const monthStart = new Date();
			monthStart.setHours(0, 0, 0, 0);
			monthStart.setDate(1);
			monthStart.setMonth(monthStart.getMonth() - 11);

			const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			const monthAgg = new Map<string, { date: Date; input: number; output: number }>();
			for (const d of dailyParsed) {
				const key = monthKey(d.date);
				const existing = monthAgg.get(key);
				if (!existing) {
					monthAgg.set(key, {
						date: new Date(d.date.getFullYear(), d.date.getMonth(), 1),
						input: d.input,
						output: d.output
					});
				} else {
					existing.input += d.input;
					existing.output += d.output;
				}
			}

			points = Array.from({ length: 12 }, (_, i) => {
				const date = new Date(monthStart);
				date.setMonth(monthStart.getMonth() + i);
				const key = monthKey(date);
				const entry = monthAgg.get(key);
				return {
					x: date,
					input: entry?.input ?? 0,
					output: entry?.output ?? 0,
					label: date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
				};
			});
		}

		const maxVal = d3.max(points, (d) => Math.max(d.input, d.output)) || 0;
		const y = d3.scaleLinear().domain([0, maxVal]).nice().range([innerHeight, 0]);

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

		// X scale
		let x: d3.ScaleLinear<number, number, never> | d3.ScaleTime<number, number, never>;

		if (xType === 'hour') {
			x = d3.scaleLinear().domain([0, 23]).range([0, innerWidth]);
		} else {
			const extent = d3.extent(points, (d) => d.x as Date) as [Date, Date];
			x = d3.scaleTime().domain(extent).range([0, innerWidth]);
		}

		// Areas (subtle)
		const areaInput =
			xType === 'hour'
				? d3
						.area<Point>()
						.x((d) => (x as d3.ScaleLinear<number, number>)(d.x as number))
						.y0(innerHeight)
						.y1((d) => y(d.input))
						.curve(d3.curveMonotoneX)
				: d3
						.area<Point>()
						.x((d) => (x as d3.ScaleTime<number, number>)(d.x as Date))
						.y0(innerHeight)
						.y1((d) => y(d.input))
						.curve(d3.curveMonotoneX);

		const areaOutput =
			xType === 'hour'
				? d3
						.area<Point>()
						.x((d) => (x as d3.ScaleLinear<number, number>)(d.x as number))
						.y0(innerHeight)
						.y1((d) => y(d.output))
						.curve(d3.curveMonotoneX)
				: d3
						.area<Point>()
						.x((d) => (x as d3.ScaleTime<number, number>)(d.x as Date))
						.y0(innerHeight)
						.y1((d) => y(d.output))
						.curve(d3.curveMonotoneX);

		// Background areas
		g.append('path')
			.datum(points)
			.attr('fill', 'rgba(59, 130, 246, 0.18)')
			.attr('d', areaInput)
			.attr('opacity', 0)
			.transition()
			.duration(600)
			.attr('opacity', 1);

		g.append('path')
			.datum(points)
			.attr('fill', 'rgba(255, 255, 255, 0.12)')
			.attr('d', areaOutput)
			.attr('opacity', 0)
			.transition()
			.duration(600)
			.delay(120)
			.attr('opacity', 1);

		const lineInput =
			xType === 'hour'
				? d3
						.line<Point>()
						.x((d) => (x as d3.ScaleLinear<number, number>)(d.x as number))
						.y((d) => y(d.input))
						.curve(d3.curveMonotoneX)
				: d3
						.line<Point>()
						.x((d) => (x as d3.ScaleTime<number, number>)(d.x as Date))
						.y((d) => y(d.input))
						.curve(d3.curveMonotoneX);

		const lineOutput =
			xType === 'hour'
				? d3
						.line<Point>()
						.x((d) => (x as d3.ScaleLinear<number, number>)(d.x as number))
						.y((d) => y(d.output))
						.curve(d3.curveMonotoneX)
				: d3
						.line<Point>()
						.x((d) => (x as d3.ScaleTime<number, number>)(d.x as Date))
						.y((d) => y(d.output))
						.curve(d3.curveMonotoneX);

		const pathInput = g
			.append('path')
			.datum(points)
			.attr('fill', 'none')
			.attr('stroke', 'var(--color-accent)')
			.attr('stroke-width', 2)
			.attr('d', lineInput);

		const pathOutput = g
			.append('path')
			.datum(points)
			.attr('fill', 'none')
			.attr('stroke', 'rgba(255, 255, 255, 0.80)')
			.attr('stroke-width', 2)
			.attr('d', lineOutput);

		const lenIn = pathInput.node()?.getTotalLength() || 0;
		pathInput
			.attr('stroke-dasharray', `${lenIn} ${lenIn}`)
			.attr('stroke-dashoffset', lenIn)
			.transition()
			.duration(900)
			.ease(d3.easeQuadOut)
			.attr('stroke-dashoffset', 0);

		const lenOut = pathOutput.node()?.getTotalLength() || 0;
		pathOutput
			.attr('stroke-dasharray', `${lenOut} ${lenOut}`)
			.attr('stroke-dashoffset', lenOut)
			.transition()
			.duration(900)
			.delay(130)
			.ease(d3.easeQuadOut)
			.attr('stroke-dashoffset', 0);

		// Axes
		const xAxis = g
			.append('g')
			.attr('class', 'axis')
			.attr('transform', `translate(0,${innerHeight})`);
		if (xType === 'hour') {
			xAxis
				.call(
					d3
						.axisBottom(x as d3.ScaleLinear<number, number>)
						.ticks(8)
						.tickFormat((d) => `${String(d).padStart(2, '0')}:00`)
				)
				.selectAll('text')
				.attr('fill', 'rgba(255, 255, 255, 0.50)')
				.attr('font-size', '10px');
		} else {
			const fmt = (d: Date) => {
				if (range === 'week') {
					return d.toLocaleDateString(undefined, { weekday: 'short' });
				} else if (range === 'month') {
					return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
				} else {
					return d.toLocaleDateString(undefined, { month: 'short' });
				}
			};

			xAxis
				.call(
					d3
						.axisBottom(x as d3.ScaleTime<number, number>)
						.ticks(range === 'month' ? 6 : range === 'year' ? 12 : 7)
						.tickFormat((d) => fmt(d as Date))
				)
				.selectAll('text')
				.attr('fill', 'rgba(255, 255, 255, 0.50)')
				.attr('font-size', '10px');
		}

		g.append('g')
			.attr('class', 'axis')
			.call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2s')))
			.selectAll('text')
			.attr('fill', 'rgba(255, 255, 255, 0.50)')
			.attr('font-size', '10px');

		g.selectAll('.domain').attr('stroke', 'rgba(255, 255, 255, 0.10)');

		// Legend
		const legend = g.append('g').attr('transform', `translate(${innerWidth - 140}, -16)`);
		legend
			.append('line')
			.attr('x1', 0)
			.attr('y1', 5)
			.attr('x2', 16)
			.attr('y2', 5)
			.attr('stroke', 'var(--color-accent)')
			.attr('stroke-width', 2);
		legend
			.append('text')
			.attr('x', 20)
			.attr('y', 8)
			.attr('fill', 'rgba(255, 255, 255, 0.50)')
			.attr('font-size', '10px')
			.text('In');
		legend
			.append('line')
			.attr('x1', 58)
			.attr('y1', 5)
			.attr('x2', 74)
			.attr('y2', 5)
			.attr('stroke', 'rgba(255, 255, 255, 0.80)')
			.attr('stroke-width', 2);
		legend
			.append('text')
			.attr('x', 78)
			.attr('y', 8)
			.attr('fill', 'rgba(255, 255, 255, 0.50)')
			.attr('font-size', '10px')
			.text('Out');

		// Hover focus + tooltip
		const focus = g.append('g').style('display', 'none');
		const focusLine = focus
			.append('line')
			.attr('y1', 0)
			.attr('y2', innerHeight)
			.attr('stroke', 'rgba(255, 255, 255, 0.18)')
			.attr('stroke-dasharray', '3,3');

		const inOuter = focus
			.append('circle')
			.attr('r', 7)
			.attr('fill', 'rgba(0, 0, 0, 0.85)')
			.attr('stroke', 'var(--color-accent)')
			.attr('stroke-width', 1.5);
		const inDot = focus.append('circle').attr('r', 3).attr('fill', 'var(--color-accent)');

		const outOuter = focus
			.append('circle')
			.attr('r', 7)
			.attr('fill', 'rgba(0, 0, 0, 0.85)')
			.attr('stroke', 'rgba(255, 255, 255, 0.80)')
			.attr('stroke-width', 1.5);
		const outDot = focus.append('circle').attr('r', 3).attr('fill', 'rgba(255, 255, 255, 0.80)');

		function updateTooltipForPoint(event: PointerEvent, d: Point) {
			const [px, py] = d3.pointer(event, containerEl);
			tooltip = {
				x: clamp(px + 12, 8, actualWidth - 170),
				y: clamp(py - 12, 8, height - 110),
				title: d.label,
				lines: [
					{ label: 'Tokens in', value: formatTokens(d.input) },
					{ label: 'Tokens out', value: formatTokens(d.output) },
					{ label: 'Total', value: formatTokens(d.input + d.output) }
				]
			};
		}

		const bisectTime = d3.bisector((d: Point) => (d.x instanceof Date ? d.x : new Date())).left;
		const bisectHour = d3.bisector((d: Point) => d.x as number).left;

		g.append('rect')
			.attr('width', innerWidth)
			.attr('height', innerHeight)
			.attr('fill', 'transparent')
			.style('cursor', 'crosshair')
			.on('wheel', (event) => {
				event.preventDefault();
				range = nextRange(range, event.deltaY > 0 ? 1 : -1);
			})
			.on('pointerenter', () => {
				focus.style('display', null);
			})
			.on('pointerleave', () => {
				focus.style('display', 'none');
				tooltip = null;
			})
			.on('pointermove', (event) => {
				const [mx] = d3.pointer(event, g.node() as SVGGElement);

				let d: Point;
				if (xType === 'hour') {
					const x0 = (x as d3.ScaleLinear<number, number>).invert(mx);
					const i = bisectHour(points, x0, 1);
					const a = points[i - 1] ?? points[0];
					const b = points[i] ?? a;
					d = x0 - (a.x as number) > (b.x as number) - x0 ? b : a;

					const cx = (x as d3.ScaleLinear<number, number>)(d.x as number);
					focus.attr('transform', `translate(${cx},0)`);
					focusLine.attr('x1', 0).attr('x2', 0);
					inOuter.attr('cx', 0).attr('cy', y(d.input));
					inDot.attr('cx', 0).attr('cy', y(d.input));
					outOuter.attr('cx', 0).attr('cy', y(d.output));
					outDot.attr('cx', 0).attr('cy', y(d.output));
				} else {
					const x0 = (x as d3.ScaleTime<number, number>).invert(mx);
					const i = bisectTime(points, x0 as any, 1);
					const a = points[i - 1] ?? points[0];
					const b = points[i] ?? a;
					const ad = a.x as Date;
					const bd = b.x as Date;
					d = x0.getTime() - ad.getTime() > bd.getTime() - x0.getTime() ? b : a;

					const cx = (x as d3.ScaleTime<number, number>)(d.x as Date);
					focus.attr('transform', `translate(${cx},0)`);
					focusLine.attr('x1', 0).attr('x2', 0);
					inOuter.attr('cx', 0).attr('cy', y(d.input));
					inDot.attr('cx', 0).attr('cy', y(d.input));
					outOuter.attr('cx', 0).attr('cy', y(d.output));
					outDot.attr('cx', 0).attr('cy', y(d.output));
				}

				updateTooltipForPoint(event as PointerEvent, d);
			});
	}

	function labelForRange(r: Range) {
		if (r === 'day') return 'DAY';
		if (r === 'week') return 'WEEK';
		if (r === 'month') return 'MONTH';
		return 'YEAR';
	}

	function setRange(r: Range) {
		range = r;
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
			if (hourly && daily && actualWidth && range) {
				renderChart(el);
			}
		});

		return () => resizeObserver.disconnect();
	};
</script>

<div class="chart-header">
	<h2 class="section-title" style="margin: 0;">TOKENS OVER TIME</h2>
	<div class="range-buttons">
		{#each ['day', 'week', 'month', 'year'] as r}
			<button
				type="button"
				class="range-btn {range === (r as Range) ? 'active' : ''}"
				onclick={() => setRange(r as Range)}
			>
				{labelForRange(r as Range)}
			</button>
		{/each}
	</div>
</div>

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
