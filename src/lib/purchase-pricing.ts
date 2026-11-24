export const GOLD_QUALITIES = [
  [24,999],[23,958],[22,916],[21,875],[20,833],[19.2,800],[19,792],[18,750],[17,708],[16,667],[15,625],[14,585],[12,500],[10,417],[9,375],[8,333],
] as const;

export interface QuoteLineInput {
  qualityId: string;
  weightMilligrams: number;
}
export interface PublishedPrice {
  qualityId: string;
  centsPerGram: number;
}
export function calculateQuote(lines: readonly QuoteLineInput[], prices: readonly PublishedPrice[]) {
  if (!lines.length || lines.length > 100) throw new Error('Número de peças inválido.');
  const byQuality = new Map<string, number>();
  for (const price of prices) {
    if (!price.qualityId || byQuality.has(price.qualityId) || !Number.isSafeInteger(price.centsPerGram) || price.centsPerGram <= 0 || price.centsPerGram > 10000000) throw new Error('Tabela de preços inválida.');
    byQuality.set(price.qualityId, price.centsPerGram);
  }
  const items = lines.map(line => {
    const centsPerGram = byQuality.get(line.qualityId);
    if (centsPerGram === undefined) throw new Error('Qualidade sem preço publicado.');
    if (!Number.isSafeInteger(line.weightMilligrams) || line.weightMilligrams <= 0 || line.weightMilligrams > 10000000) throw new Error('Peso inválido.');
    const amountCents = Math.floor((line.weightMilligrams * centsPerGram + 500) / 1000);
    if (amountCents <= 0) throw new Error('Valor da peça inválido.');
    return {...line, centsPerGram, amountCents};
  });
  return {items, totalCents: items.reduce((sum,item)=>sum+item.amountCents,0), totalWeightMilligrams: items.reduce((sum,item)=>sum+item.weightMilligrams,0)};
}
