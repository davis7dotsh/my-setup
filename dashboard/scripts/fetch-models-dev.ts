const apiUrl = 'https://models.dev/api.json';

const assetsPath = new URL('../src/lib/assets/models.dev.json', import.meta.url);
const cachePath = new URL('../src/lib/server/models.dev.cache.json', import.meta.url);

const fetchModels = async () => {
	const response = await fetch(apiUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${apiUrl}: ${response.status}`);
	}
	return response.text();
};

const loadCache = async () => Bun.file(cachePath).text();

const parseJson = (value: string) => JSON.stringify(JSON.parse(value));

const writeAsset = async (content: string) => {
	await Bun.write(assetsPath, content);
};

const run = async () => {
	try {
		const latest = await fetchModels();
		await writeAsset(parseJson(latest));
	} catch {
		const cached = await loadCache();
		await writeAsset(parseJson(cached));
	}
};

await run();
