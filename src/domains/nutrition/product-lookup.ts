import { type Nutrients, areValidNutrients } from './nutrition';

const LOOKUP_TIMEOUT_MS = 8000;

export type ScannedProduct = Nutrients & {
  name: string;
  barcode: string;
};

export type LookupResult =
  | { status: 'found'; product: ScannedProduct }
  | { status: 'incomplete'; name: string | null }
  | { status: 'not_found' }
  | { status: 'offline' };

type OpenFoodFactsResponse = {
  status?: number;
  product?: {
    product_name?: string;
    product_name_ru?: string;
    brands?: string;
    nutriments?: Record<string, number | string | undefined>;
  };
};

function amount(nutriments: Record<string, number | string | undefined>, key: string) {
  const value = Number(nutriments[key]);
  return Number.isFinite(value) ? value : null;
}

export function parseOpenFoodFacts(response: OpenFoodFactsResponse, barcode: string): LookupResult {
  const { status, product } = response;
  if (status !== 1 || !product) {
    return { status: 'not_found' };
  }

  const title = (product.product_name_ru || product.product_name || '').trim();
  const brand = product.brands?.split(',')[0]?.trim();
  const name = brand && title && !title.includes(brand) ? `${title}, ${brand}` : title;
  const nutriments = product.nutriments ?? {};
  const values = {
    kcal: amount(nutriments, 'energy-kcal_100g'),
    protein: amount(nutriments, 'proteins_100g'),
    fat: amount(nutriments, 'fat_100g'),
    carbs: amount(nutriments, 'carbohydrates_100g'),
  };

  if (!name || Object.values(values).some((value) => value === null) || !areValidNutrients(values as Nutrients)) {
    return { status: 'incomplete', name: name || null };
  }
  return { status: 'found', product: { ...(values as Nutrients), name, barcode } };
}

export type ProductFetcher = (url: string, init: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

// Only the barcode number leaves the phone. Open Food Facts needs no account.
export async function lookupProduct(barcode: string, fetcher: ProductFetcher = fetch): Promise<LookupResult> {
  const fields = 'product_name,product_name_ru,brands,nutriments';
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetcher(url, { headers: { 'User-Agent': 'IRONVANT/1.0' }, signal: controller.signal });
    if (!response.ok) {
      return { status: 'offline' };
    }
    return parseOpenFoodFacts((await response.json()) as OpenFoodFactsResponse, barcode);
  } catch (error) {
    console.error(error);
    return { status: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
