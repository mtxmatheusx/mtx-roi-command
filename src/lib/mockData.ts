// Mock data for the MTX platform

export interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'scaling';
  effectiveStatus?: string;
  spend: number;
  revenue: number;
  cpm: number;
  ctr: number;
  cpc: number;
  clicks: number;
  pageViews: number;
  costPerPageView: number;
  addToCart: number;
  costPerATC: number;
  initiateCheckout: number;
  costPerIC: number;
  purchases: number;
  costPerPurchase: number;
  conversionRate: number;
  roi: number;
  profit: number;
  cpaMeta: number; // CPA target
  ticketMedio: number;
}

export const mockCampaigns: Campaign[] = [
  {
    id: '1', name: '[ESCALA] VSL - Mentoria Premium', status: 'scaling',
    spend: 4850.00, revenue: 18830.00, cpm: 32.50, ctr: 3.2, cpc: 1.01, clicks: 4802,
    pageViews: 3841, costPerPageView: 1.26, addToCart: 312, costPerATC: 15.54,
    initiateCheckout: 187, costPerIC: 25.93, purchases: 27, costPerPurchase: 179.63,
    conversionRate: 0.70, roi: 3.88, profit: 13980.00, cpaMeta: 200, ticketMedio: 697
  },
  {
    id: '2', name: '[TESTE] Criativo Hook Dor', status: 'active',
    spend: 1230.00, revenue: 3485.00, cpm: 45.20, ctr: 1.8, cpc: 2.51, clicks: 490,
    pageViews: 392, costPerPageView: 3.14, addToCart: 45, costPerATC: 27.33,
    initiateCheckout: 28, costPerIC: 43.93, purchases: 5, costPerPurchase: 246.00,
    conversionRate: 1.28, roi: 2.83, profit: 2255.00, cpaMeta: 200, ticketMedio: 697
  },
  {
    id: '3', name: '[BROAD] Público Aberto 25-45', status: 'active',
    spend: 2100.00, revenue: 2788.00, cpm: 38.90, ctr: 2.1, cpc: 1.85, clicks: 1135,
    pageViews: 908, costPerPageView: 2.31, addToCart: 78, costPerATC: 26.92,
    initiateCheckout: 41, costPerIC: 51.22, purchases: 4, costPerPurchase: 525.00,
    conversionRate: 0.44, roi: 1.33, profit: 688.00, cpaMeta: 200, ticketMedio: 697
  },
  {
    id: '4', name: '[TESTE] Reels UGC - Prova Social', status: 'paused',
    spend: 890.00, revenue: 0, cpm: 52.30, ctr: 0.7, cpc: 7.47, clicks: 119,
    pageViews: 95, costPerPageView: 9.37, addToCart: 8, costPerATC: 111.25,
    initiateCheckout: 2, costPerIC: 445.00, purchases: 0, costPerPurchase: 0,
    conversionRate: 0, roi: 0, profit: -890.00, cpaMeta: 200, ticketMedio: 697
  },
  {
    id: '5', name: '[ESCALA] Lookalike Compradores 1%', status: 'scaling',
    spend: 6200.00, revenue: 22304.00, cpm: 28.10, ctr: 3.8, cpc: 0.74, clicks: 8378,
    pageViews: 6702, costPerPageView: 0.93, addToCart: 520, costPerATC: 11.92,
    initiateCheckout: 298, costPerIC: 20.81, purchases: 32, costPerPurchase: 193.75,
    conversionRate: 0.48, roi: 3.60, profit: 16104.00, cpaMeta: 200, ticketMedio: 697
  },
];

export interface Creative {
  id: string;
  name: string;
  type: 'video' | 'image' | 'carousel';
  hookScore: number;
  ctr: number;
  cpc: number;
  conversions: number;
  status: 'winner' | 'testing' | 'saturated';
  thumbnail: string;
  hookText: string;
}

export const mockCreatives: Creative[] = [
  { id: '1', name: 'VSL Dor Principal', type: 'video', hookScore: 92, ctr: 3.8, cpc: 0.74, conversions: 32, status: 'winner', thumbnail: '', hookText: '"Você já perdeu dinheiro com tráfego pago?"' },
  { id: '2', name: 'Reels Prova Social', type: 'video', hookScore: 67, ctr: 1.2, cpc: 5.30, conversions: 2, status: 'saturated', thumbnail: '', hookText: '"Veja o resultado dos meus alunos..."' },
  { id: '3', name: 'Carrossel Método', type: 'carousel', hookScore: 78, ctr: 2.4, cpc: 1.90, conversions: 8, status: 'testing', thumbnail: '', hookText: '"3 passos para escalar sem queimar caixa"' },
  { id: '4', name: 'Imagem Estática CTA', type: 'image', hookScore: 85, ctr: 3.1, cpc: 1.10, conversions: 15, status: 'winner', thumbnail: '', hookText: '"R$697 pode mudar sua vida"' },
  { id: '5', name: 'UGC Depoimento', type: 'video', hookScore: 45, ctr: 0.8, cpc: 8.20, conversions: 0, status: 'saturated', thumbnail: '', hookText: '"Eu não acreditava até testar..."' },
];

export function getCampaignAlert(campaign: Campaign): 'lucrativa' | 'atencao' | 'escalando' | 'critico' | 'pausada' {
  if (campaign.status === 'paused') return 'pausada';
  if (campaign.spend > 2 * campaign.cpaMeta && campaign.purchases === 0) return 'critico';
  if (campaign.roi > 3.0 && campaign.purchases > 5) return 'escalando';
  if (campaign.costPerPurchase > campaign.cpaMeta * 1.2 && campaign.purchases > 0) return 'atencao';
  if (campaign.roi > 1) return 'lucrativa';
  return 'atencao';
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}
