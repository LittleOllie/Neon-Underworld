import {
  getDrugStreetPrice,
  STREET_DRUG_FIELD,
  type StreetDrugType,
} from '@/config/game/drug-street-prices';

export function streetDrugField(drug: StreetDrugType): 'hash' | 'shrooms' | 'coke' | 'heroin' {
  return STREET_DRUG_FIELD[drug];
}

export function validateStreetDrugSale(input: {
  districtSlug: string;
  drug: StreetDrugType;
  quantity: number;
  owned: number;
}): { valid: true; unitPrice: number; totalPayout: number } | { valid: false; error: string } {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { valid: false, error: 'Enter a valid quantity.' };
  }
  if (input.owned < input.quantity) {
    return { valid: false, error: 'Insufficient drug stock.' };
  }
  const unitPrice = getDrugStreetPrice(input.districtSlug, input.drug);
  const totalPayout = unitPrice * input.quantity;
  return { valid: true, unitPrice, totalPayout };
}
