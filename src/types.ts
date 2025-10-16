export interface HouseholdData {
  region?: string;
  incomeLevel?: string;
  householdSize?: string | number;
  monthlyBudget?: string | number;
}

export interface PredictionAppliance {
  name: string;
  consumption: string;
  bill: string;
  percentage: string;
  powerWatts: number;
}

export interface Report {
  id: number;
  timestamp: string;
  consumption: number | string;
  bill: number | string;
  total_kwh?: number;
  total_bill?: number;
  tariffBracket?: string;
  tariff_bracket?: string;
  householdData?: HouseholdData;
  household_size?: number;
  region?: string;
  income_level?: string;
  budget?: number;
  appliances?: PredictionAppliance[];
  breakdown?: unknown[];
  ownerId?: string;
}

export interface ModelStatus {
  loaded?: boolean;
  ready?: boolean;
}

export interface ApiStatus {
  status: string;
  message?: string;
  model_loaded?: boolean;
  models?: {
    supervised?: ModelStatus;
    reinforcement_learning?: ModelStatus;
    unsupervised?: ModelStatus;
  };
}

export interface Predictions {
  id: string | number;
  consumption: string;
  bill: string;
  tariffBracket: string;
  budgetStatus: string;
  budgetDifference: number;
  message: string;
  appliances: PredictionAppliance[];
  householdData: HouseholdData;
  timestamp: string;
  total_kwh?: number;
  total_bill?: number;
  report_id?: string;
  ai_recommendations?: AIRecommendation[];
}

export interface AIRecommendation {
  type?: string;
  suggestion?: string;
  title?: string;
  savings_estimate?: number;
  cost_estimate?: number;
  priority?: string;
  confidence_score?: number;
  ai_insights?: {
    efficiency_gain_percent?: number;
    payback_period_months?: number;
    annual_savings?: number;
    environmental_impact?: string;
    smart_tip?: string;
    special_advice?: string;
    behavioral_impact?: string;
    smart_scheduling?: string;
    tariff_advantage?: string;
  };
  total_potential_savings_kwh?: number;
  total_potential_savings_money?: number;
  total_implementation_cost?: number;
  roi_months?: number;
  recommendation_engine?: string;
  number_of_recommendations?: number;
}
