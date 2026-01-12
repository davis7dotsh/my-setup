<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import * as d3 from 'd3';

	interface FileTypeData {
		file_extension: string | null;
		total_operations: number;
		edit_count: number;
		write_count: number;
		read_count: number;
		total_lines_added: number;
		total_lines_removed: number;
		net_lines: number;
	}

	interface Props {
		data: FileTypeData[];
		height?: number;
	}

	let { data, height = 300 }: Props = $props();

	let svgElement: SVGSVGElement | undefined = $state();
	let actualWidth = $state(0);

	type TooltipState = {
		x: number;
		y: number;
		title: string;
		lines: { label: string; value: string; color?: string }[];
	};

	let tooltip = $state<TooltipState | null>(null);

	// Language colors (similar to GitHub's language colors)
	const LANGUAGE_COLORS: Record<string, string> = {
		ts: '#3178c6',
		tsx: '#3178c6',
		js: '#f7df1e',
		jsx: '#f7df1e',
		svelte: '#ff3e00',
		vue: '#42b883',
		py: '#3776ab',
		rs: '#dea584',
		go: '#00add8',
		rb: '#cc342d',
		java: '#b07219',
		kt: '#a97bff',
		swift: '#f05138',
		c: '#555555',
		cpp: '#f34b7d',
		cs: '#178600',
		php: '#4f5d95',
		html: '#e34c26',
		css: '#563d7c',
		scss: '#c6538c',
		json: '#292929',
		yaml: '#cb171e',
		yml: '#cb171e',
		md: '#083fa1',
		sql: '#e38c00',
		sh: '#89e051',
		bash: '#89e051',
		zsh: '#89e051',
		dockerfile: '#384d54',
		toml: '#9c4221',
		xml: '#0060ac',
		graphql: '#e10098'
	};

	function getLanguageColor(ext: string): string {
		return LANGUAGE_COLORS[ext.toLowerCase()] || '#6b7280';
	}

	function getLanguageName(ext: string): string {
		const names: Record<string, string> = {
			ts: 'TypeScript',
			tsx: 'TSX',
			js: 'JavaScript',
			jsx: 'JSX',
			svelte: 'Svelte',
			vue: 'Vue',
			py: 'Python',
			rs: 'Rust',
			go: 'Go',
			rb: 'Ruby',
			java: 'Java',
			kt: 'Kotlin',
			swift: 'Swift',
			c: 'C',
			cpp: 'C++',
			cs: 'C#',
			php: 'PHP',
			html: 'HTML',
			css: 'CSS',
			scss: 'SCSS',
			json: 'JSON',
			yaml: 'YAML',
			yml: 'YAML',
			md: 'Markdown',
			sql: 'SQL',
			sh: 'Shell',
			bash: 'Bash',
			zsh: 'Zsh',
			dockerfile: 'Dockerfile',
			toml: 'TOML',
			xml: 'XML',
			graphql: 'GraphQL'
		};
		return names[ext.toLowerCase()] || ext.toUpperCase();
	}

	function clamp(n: number, min: number, max: number) {
		return Math.max(min, Math.min(max, n));
	}

	function formatNumber(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
		return n.toLocaleString();
	}

	function renderChart(containerEl: HTMLDivElement) {
		if (!svgElement || !data || data.length === 0) return;

		const svg = d3.select(svgElement);
		svg.selectAll('*').remove();

		// Sort by net lines and take top entries
		const sortedData = [...data]
			.filter((d) => d.total_lines_added > 0 || d.total_lines_removed > 0)
			.sort((a, b) => b.total_lines_added - a.total_lines_added)
			.slice(0, 12);

		if (sortedData.length === 0) return;

		const margin = { top: 10, right: 60, bottom: 20, left: 80 };
		const innerWidth = actualWidth - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		const g = svg
			.attr('width', actualWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const maxValue = d3.max(sortedData, (d) => d.total_lines_added) || 0;

		const x = d3.scaleLinear().domain([0, maxValue]).nice().range([0, innerWidth]);

		const y = d3
			.scaleBand()
			.domain(sortedData.map((d) => d.file_extension || 'unknown'))
			.range([0, innerHeight])
			.padding(0.25);

		// Grid lines
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

		g.selectAll('.domain').remove();

		// Bars
		const bars = g
			.selectAll<SVGRectElement, FileTypeData>('.bar')
			.data(sortedData)
			.enter()
			.append('rect')
			.attr('class', 'bar')
			.attr('y', (d) => y(d.file_extension || 'unknown') || 0)
			.attr('height', y.bandwidth())
			.attr('x', 0)
			.attr('width', 0)
			.attr('fill', (d) => getLanguageColor(d.file_extension || ''))
			.attr('stroke', 'transparent')
			.attr('stroke-width', 1)
			.attr('rx', 2)
			.style('cursor', 'pointer')
			.on('pointerenter', function (_, d) {
				const baseColor = getLanguageColor(d.file_extension || '');
				const hoverColor = d3.color(baseColor)?.brighter(0.5).formatHex() ?? baseColor;
				d3.select(this).attr('fill', hoverColor).attr('stroke', 'rgba(255, 255, 255, 0.25)');
			})
			.on('pointermove', function (event, d) {
				const [px, py] = d3.pointer(event, containerEl);
				tooltip = {
					x: clamp(px + 12, 8, actualWidth - 180),
					y: clamp(py - 12, 8, height - 120),
					title: getLanguageName(d.file_extension || 'unknown'),
					lines: [
						{
							label: 'Lines Added',
							value: '+' + formatNumber(d.total_lines_added),
							color: '#22c55e'
						},
						{
							label: 'Lines Removed',
							value: '-' + formatNumber(d.total_lines_removed),
							color: '#ef4444'
						},
						{ label: 'Net Lines', value: formatNumber(d.net_lines) },
						{ label: 'Edits', value: d.edit_count.toLocaleString() },
						{ label: 'Writes', value: d.write_count.toLocaleString() }
					]
				};
			})
			.on('pointerleave', function (_, d) {
				tooltip = null;
				d3.select(this)
					.attr('fill', getLanguageColor(d.file_extension || ''))
					.attr('stroke', 'transparent');
			});

		bars
			.transition()
			.duration(800)
			.delay((_, i) => i * 60)
			.attr('width', (d) => x(d.total_lines_added));

		// Value labels
		g.selectAll('.value-label')
			.data(sortedData)
			.enter()
			.append('text')
			.attr('class', 'value-label')
			.attr('y', (d) => (y(d.file_extension || 'unknown') || 0) + y.bandwidth() / 2)
			.attr('x', (d) => x(d.total_lines_added) + 8)
			.attr('dy', '0.35em')
			.attr('fill', 'rgba(255, 255, 255, 0.60)')
			.attr('font-size', '11px')
			.attr('font-family', 'var(--font-mono)')
			.style('pointer-events', 'none')
			.text((d) => '+' + formatNumber(d.total_lines_added));

		// Y axis (language labels)
		const yAxis = g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0));

		yAxis.selectAll('.domain').remove();

		yAxis
			.selectAll('text')
			.attr('fill', 'rgba(255, 255, 255, 0.70)')
			.attr('font-size', '11px')
			.attr('font-family', 'var(--font-mono)')
			.text((d) => '.' + d);

		// Add color indicators
		yAxis
			.selectAll('.tick')
			.insert('rect', 'text')
			.attr('x', -12)
			.attr('y', -4)
			.attr('width', 8)
			.attr('height', 8)
			.attr('rx', 2)
			.attr('fill', (d) => getLanguageColor(String(d)));
	}

	const chartAttachment: Attachment = (container) => {
		const el = container as HTMLDivElement;
		actualWidth = el.clientWidth || 400;

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
					<span class="value" style={line.color ? `color: ${line.color}` : ''}>{line.value}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
