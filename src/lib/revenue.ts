export interface RevenueParams {
  views: number;
  ctr: number;
  cvr: number;
  aov: number;
  commission: number;
}

export interface RevenueEstimate {
  estimated_clicks: number;
  estimated_conversions: number;
  estimated_gmv: number;
  estimated_revenue: number;
}

export function estimateRevenue(p: RevenueParams): RevenueEstimate {
  const clicks = Math.floor(p.views * p.ctr);
  const conversions = clicks * p.cvr;
  const gmv = conversions * p.aov;
  const revenue = gmv * p.commission;
  return {
    estimated_clicks: clicks,
    estimated_conversions: Math.round(conversions * 100) / 100,
    estimated_gmv: Math.round(gmv * 100) / 100,
    estimated_revenue: Math.round(revenue * 100) / 100,
  };
}
