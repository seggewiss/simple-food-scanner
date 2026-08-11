import { describe, expect, it } from 'vitest';

import cocaCola from './__fixtures__/coca-cola.json';
import nutella from './__fixtures__/nutella.json';
import unknownBarcode from './__fixtures__/unknown-barcode.json';
import {
  energyKcalPer100g,
  normalizeProduct,
  normalizeSearchHit,
  pickName,
  servingGrams,
  toNumber,
} from './normalize';
import type { OffProduct, OffProductResponse } from './types';

const nutellaResponse = nutella as OffProductResponse;
const cocaColaResponse = cocaCola as OffProductResponse;
const unknownResponse = unknownBarcode as OffProductResponse;

describe('toNumber', () => {
  it('passes finite numbers through', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(0)).toBe(0);
  });

  it('parses numeric strings, including comma decimals contributors use', () => {
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber('12,5')).toBe(12.5);
  });

  it('strips trailing units', () => {
    expect(toNumber('30 g')).toBe(30);
    expect(toNumber('33 cl')).toBe(33);
  });

  it('returns null for junk, null and undefined', () => {
    expect(toNumber('')).toBeNull();
    expect(toNumber('n/a')).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
  });
});

describe('energyKcalPer100g', () => {
  it('prefers the kcal field when present', () => {
    expect(energyKcalPer100g({ 'energy-kcal_100g': 539, energy_100g: 2227.9 })).toBe(539);
  });

  it('converts from kilojoules when only kJ is published', () => {
    // 2227.9 kJ / 4.184 = 532.5 kcal
    expect(energyKcalPer100g({ energy_100g: 2227.9 })).toBeCloseTo(532.5, 1);
    expect(energyKcalPer100g({ 'energy-kj_100g': 418.4 })).toBeCloseTo(100, 5);
  });

  it('returns null when there is no energy at all', () => {
    expect(energyKcalPer100g({ proteins_100g: 5 })).toBeNull();
    expect(energyKcalPer100g(undefined)).toBeNull();
  });
});

describe('servingGrams', () => {
  it('uses serving_quantity when available', () => {
    expect(servingGrams({ serving_quantity: 330, serving_size: '1 portion (330 ml)' })).toBe(330);
  });

  it('parses a leading gram or millilitre amount out of serving_size', () => {
    expect(servingGrams({ serving_quantity: null, serving_size: '30 g' })).toBe(30);
    expect(servingGrams({ serving_quantity: null, serving_size: '250ml' })).toBe(250);
  });

  it('returns null when serving_size has no leading mass or volume', () => {
    expect(servingGrams({ serving_quantity: null, serving_size: '1 cup' })).toBeNull();
    expect(servingGrams({ serving_quantity: null, serving_size: '1 portion (330 ml)' })).toBeNull();
  });

  it('returns null when the product has no serving data at all', () => {
    expect(servingGrams({ serving_quantity: null, serving_size: null })).toBeNull();
    expect(servingGrams({})).toBeNull();
  });
});

describe('pickName', () => {
  it('falls back through generic_name and brands before giving up', () => {
    expect(pickName({ generic_name: 'Hazelnut spread' }, '123')).toBe('Hazelnut spread');
    expect(pickName({ product_name: '   ', brands: 'Ferrero' }, '123')).toBe('Ferrero');
    expect(pickName({}, '123')).toBe('Unknown product 123');
  });
});

describe('normalizeProduct — real Open Food Facts fixtures', () => {
  it('maps a solid food with no serving information', () => {
    const result = normalizeProduct(nutellaResponse.product as OffProduct, '3017624010701', 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.food.id).toBe('off:3017624010701');
    expect(result.food.source).toBe('off');
    expect(result.food.name).toBe('Nutella');
    expect(result.food.brand).toBe('Ferrero');
    expect(result.food.kcalPer100g).toBe(539);
    expect(result.food.baseUnit).toBe('g');
    // The whole reason the portions table exists.
    expect(result.food.servingSizeG).toBeNull();
  });

  it('maps a drink to millilitres and keeps its serving size', () => {
    const result = normalizeProduct(cocaColaResponse.product as OffProduct, '5449000000996', 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.food.baseUnit).toBe('ml');
    expect(result.food.servingSizeG).toBe(330);
    expect(result.food.kcalPer100g).toBe(42);
  });

  it('reports failure for a product with no usable energy value', () => {
    const result = normalizeProduct({ code: '123', nutriments: { proteins_100g: 5 } }, '123', 0);
    expect(result).toEqual({ ok: false, reason: 'no_energy' });
  });

  it('reports failure when there is no barcode to key on', () => {
    const result = normalizeProduct({ nutriments: { 'energy-kcal_100g': 100 } }, undefined, 0);
    expect(result).toEqual({ ok: false, reason: 'no_barcode' });
  });

  it('never produces negative macros from bad upstream data', () => {
    const result = normalizeProduct(
      { code: '1', nutriments: { 'energy-kcal_100g': 100, proteins_100g: -5 } },
      '1',
      0,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.food.proteinPer100g).toBe(0);
  });

  it('converts a kilojoule-only product', () => {
    const result = normalizeProduct(
      { code: '2', nutriments: { energy_100g: 418.4, proteins_100g: '3,5' } },
      '2',
      0,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.food.kcalPer100g).toBeCloseTo(100, 5);
    expect(result.food.proteinPer100g).toBe(3.5);
  });
});

describe('unknown barcode fixture', () => {
  it('carries a non-success status in the body', () => {
    // The live API pairs this body with an HTTP 404, so fetchProductByBarcode has to
    // handle both signals. See off.live-test.ts.
    expect(unknownResponse.status).not.toBe('success');
    expect(unknownResponse.product).toBeUndefined();
  });
});

describe('normalizeSearchHit', () => {
  it('flattens array-valued name and brand fields', () => {
    expect(
      normalizeSearchHit({
        code: '0894700010137',
        product_name: ['Nonfat Greek Yogurt'],
        brands: ['Chobani'],
        nutriments: { 'energy-kcal_100g': 59 },
      }),
    ).toEqual({
      barcode: '0894700010137',
      name: 'Nonfat Greek Yogurt',
      brand: 'Chobani',
      kcalPer100g: 59,
      imageUrl: null,
    });
  });

  it('drops hits with no barcode, since they cannot be looked up or cached', () => {
    expect(normalizeSearchHit({ product_name: 'Mystery' })).toBeNull();
  });

  it('tolerates a hit with no nutrition attached', () => {
    const hit = normalizeSearchHit({ code: '123', product_name: 'Thing' });
    expect(hit?.kcalPer100g).toBeNull();
  });
});
