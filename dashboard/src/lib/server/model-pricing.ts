import modelsDev from '$lib/assets/models.dev.json';

type ModelCost = {
	input?: number;
	output?: number;
	cache_read?: number;
	cache_write?: number;
	reasoning?: number;
};

type ModelsDevProvider = {
	models?: Record<string, { cost?: ModelCost }>;
};

const modelsDevData = modelsDev as Record<string, ModelsDevProvider>;

const pricingByProviderModel = Object.entries(modelsDevData).reduce(
	(map, [providerId, provider]) => {
		const models = provider.models ?? {};
		for (const [modelId, model] of Object.entries(models)) {
			if (model.cost) {
				map.set(`${providerId}:${modelId}`, model.cost);
			}
		}
		return map;
	},
	new Map<string, ModelCost>()
);

const perMillion = 1_000_000;

const getModelCost = (providerId?: string | null, modelId?: string | null) =>
	providerId && modelId ? (pricingByProviderModel.get(`${providerId}:${modelId}`) ?? null) : null;

const computeCostUsd = ({
	providerId,
	modelId,
	tokensInput = 0,
	tokensOutput = 0,
	tokensReasoning = 0,
	tokensCacheRead = 0,
	tokensCacheWrite = 0
}: {
	providerId?: string | null;
	modelId?: string | null;
	tokensInput?: number;
	tokensOutput?: number;
	tokensReasoning?: number;
	tokensCacheRead?: number;
	tokensCacheWrite?: number;
}) => {
	const cost = getModelCost(providerId, modelId);
	if (!cost) return null;
	const reasoningRate = cost.reasoning ?? cost.output ?? 0;
	return (
		(tokensInput * (cost.input ?? 0) +
			tokensOutput * (cost.output ?? 0) +
			tokensReasoning * reasoningRate +
			tokensCacheRead * (cost.cache_read ?? 0) +
			tokensCacheWrite * (cost.cache_write ?? 0)) /
		perMillion
	);
};

export const resolveCostUsd = ({
	costUsd,
	providerId,
	modelId,
	tokensInput = 0,
	tokensOutput = 0,
	tokensReasoning = 0,
	tokensCacheRead = 0,
	tokensCacheWrite = 0
}: {
	costUsd: number;
	providerId?: string | null;
	modelId?: string | null;
	tokensInput?: number;
	tokensOutput?: number;
	tokensReasoning?: number;
	tokensCacheRead?: number;
	tokensCacheWrite?: number;
}) => {
	if (costUsd > 0) return costUsd;
	const computed = computeCostUsd({
		providerId,
		modelId,
		tokensInput,
		tokensOutput,
		tokensReasoning,
		tokensCacheRead,
		tokensCacheWrite
	});
	return computed ?? costUsd;
};
