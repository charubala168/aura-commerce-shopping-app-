import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Product } from '../src/types/ecommerce.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function resolveDataDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data'),
    path.resolve(__dirname, '../data'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'smartcart-products.json'))) {
      return dir;
    }
  }
  return candidates[0];
}

const CATALOG_JSON_PATH = path.join(resolveDataDir(), 'smartcart-products.json');

export function loadSmartCartSeedProducts(): Product[] {
  const raw = fs.readFileSync(CATALOG_JSON_PATH, 'utf-8');
  return JSON.parse(raw) as Product[];
}

export const SEED_PRODUCTS_65: Product[] = loadSmartCartSeedProducts();
