export interface ContractMeta {
  code: string;
  name: string;
}

export interface NormalizedQuote {
  contract: string;
  price: number;
  quoteCcy: string;
}

export async function fetchContracts(): Promise<ContractMeta[]> {
  // Placeholder: would fetch from metals.com
  return [
    { code: "LCSPOT", name: "Spot" },
    { code: "LC2508", name: "Aug 2025" },
  ];
}

export async function fetchQuotes(c: ContractMeta): Promise<NormalizedQuote[]> {
  // Placeholder quote
  return [
    { contract: c.code, price: 1000, quoteCcy: "USD/mt" },
  ];
}

export function normalizeToUSD(q: NormalizedQuote, fx: number): NormalizedQuote {
  if (q.quoteCcy === "CNY/mt") {
    return { ...q, price: q.price / fx, quoteCcy: "USD/mt" };
  }
  return q;
}
