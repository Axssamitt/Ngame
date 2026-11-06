import { describe, it, expect } from 'vitest';

// Implementação dos módulos matemáticos do motor econômico
export interface CategoryConfig {
  name: string;
  baseDemand: number;
  refPrice: number;
  elasticity: number;
  qualityWeight: number;
}

export interface PlayerCompany {
  id: string;
  price: number;
  marketing: number;
  quality: number;
  reputation: number;
  stock: number;
  cash: number;
}

export function calculateAttractiveness(company: PlayerCompany, category: CategoryConfig): number {
  const priceFactor = Math.pow(category.refPrice / company.price, -category.elasticity);
  const marketingFactor = 1 + (company.marketing / 1000) * 0.5;
  const qualityFactor = 1 + (company.quality / 100) * category.qualityWeight;
  const reputationFactor = 1 + (company.reputation / 100) * 0.2;
  return priceFactor * marketingFactor * qualityFactor * reputationFactor;
}

export function distributeB2CDemand(
  companies: PlayerCompany[],
  category: CategoryConfig,
  moodDelta: number
) {
  const totalDemand = Math.floor(category.baseDemand * (1 + moodDelta / 100));
  const active = companies.filter(c => c.stock > 0);
  if (active.length === 0) return [];

  const scores = active.map(c => calculateAttractiveness(c, category));
  const totalScore = scores.reduce((sum, s) => sum + s, 0);

  return active.map((company, i) => {
    const share = totalScore > 0 ? scores[i] / totalScore : 1 / active.length;
    const requested = Math.floor(totalDemand * share);
    const sold = Math.min(requested, company.stock);
    const revenue = sold * company.price;
    return {
      companyId: company.id,
      share,
      sold,
      revenue,
      remainingStock: company.stock - sold,
    };
  });
}

export interface B2BOrder {
  id: string;
  companyId: string;
  type: 'buy' | 'sell';
  qty: number;
  limitPrice: number;
}

export function matchB2BOrders(orders: B2BOrder[], companyBalances: Record<string, { cash: number; stock: number }>) {
  const buys = orders.filter(o => o.type === 'buy').sort((a, b) => b.limitPrice - a.limitPrice);
  const sells = orders.filter(o => o.type === 'sell').sort((a, b) => a.limitPrice - b.limitPrice);

  const matchedTransactions = [];

  let bIdx = 0;
  let sIdx = 0;

  while (bIdx < buys.length && sIdx < sells.length) {
    const buy = buys[bIdx];
    const sell = sells[sIdx];

    if (buy.limitPrice >= sell.limitPrice) {
      const execPrice = (buy.limitPrice + sell.limitPrice) / 2;
      const buyerState = companyBalances[buy.companyId];
      const sellerState = companyBalances[sell.companyId];

      const maxUnitsByCash = Math.floor(buyerState.cash / execPrice);
      const matchedUnits = Math.min(buy.qty, sell.qty, sellerState.stock, maxUnitsByCash);

      if (matchedUnits > 0) {
        const totalAmount = matchedUnits * execPrice;
        buyerState.cash -= totalAmount;
        sellerState.cash += totalAmount;
        sellerState.stock -= matchedUnits;
        buyerState.stock += matchedUnits;

        matchedTransactions.push({
          buyerId: buy.companyId,
          sellerId: sell.companyId,
          units: matchedUnits,
          price: execPrice,
          total: totalAmount,
        });

        buy.qty -= matchedUnits;
        sell.qty -= matchedUnits;
      }

      if (buy.qty === 0) bIdx++;
      if (sell.qty === 0) sIdx++;
      if (matchedUnits === 0) break;
    } else {
      break;
    }
  }

  return matchedTransactions;
}

describe('Motor Econômico - Desafio Empreendedor', () => {
  const categoryAlimentos: CategoryConfig = {
    name: 'alimentos',
    baseDemand: 10000,
    refPrice: 50,
    elasticity: -0.8,
    qualityWeight: 0.3,
  };

  it('calcula atratividade priorizando preço competitivo e marketing', () => {
    const compA: PlayerCompany = { id: 'A', price: 45, marketing: 500, quality: 60, reputation: 60, stock: 1000, cash: 5000 };
    const compB: PlayerCompany = { id: 'B', price: 60, marketing: 0, quality: 50, reputation: 50, stock: 1000, cash: 5000 };

    const scoreA = calculateAttractiveness(compA, categoryAlimentos);
    const scoreB = calculateAttractiveness(compB, categoryAlimentos);

    expect(scoreA).toBeGreaterThan(scoreB);
  });

  it('distribui demanda B2C respeitando estoque e gerando market share correto', () => {
    const compA: PlayerCompany = { id: 'A', price: 50, marketing: 0, quality: 50, reputation: 50, stock: 5000, cash: 5000 };
    const compB: PlayerCompany = { id: 'B', price: 50, marketing: 0, quality: 50, reputation: 50, stock: 5000, cash: 5000 };

    const result = distributeB2CDemand([compA, compB], categoryAlimentos, 0);
    expect(result).toHaveLength(2);
    expect(result[0].sold).toBe(5000);
    expect(result[1].sold).toBe(5000);
    expect(result[0].share).toBeCloseTo(0.5);
  });

  it('executa leilão duplo B2B casando ordens com spread positivo no preço médio', () => {
    const balances = {
      emp_buyer: { cash: 5000, stock: 0 },
      emp_seller: { cash: 1000, stock: 200 },
    };

    const orders: B2BOrder[] = [
      { id: 'b1', companyId: 'emp_buyer', type: 'buy', qty: 100, limitPrice: 42 },
      { id: 's1', companyId: 'emp_seller', type: 'sell', qty: 100, limitPrice: 38 },
    ];

    const txs = matchB2BOrders(orders, balances);
    expect(txs).toHaveLength(1);
    expect(txs[0].units).toBe(100);
    expect(txs[0].price).toBe(40); // (42 + 38) / 2
    expect(balances.emp_buyer.cash).toBe(5000 - 4000);
    expect(balances.emp_seller.cash).toBe(1000 + 4000);
    expect(balances.emp_seller.stock).toBe(100);
    expect(balances.emp_buyer.stock).toBe(100);
  });
});
