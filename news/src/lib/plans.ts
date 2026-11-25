export type PlanId = "free" | "premium" | "premium-plus";

export type Plan = {
  id: PlanId;
  name: string;
  price: string;
  // Monthly charge in INR; 0 for free plans. Used as plan_amount with Cashfree.
  amount: number;
  term: string;
  cta: string;
  recommended?: boolean;
  features: { text: string; included: boolean }[];
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    amount: 0,
    term: "Forever",
    cta: "Start free",
    features: [
      { text: "Unlimited free news", included: true },
      { text: "Breaking news", included: true },
      { text: "Daily newsletter", included: true },
      { text: "Premium articles", included: false },
      { text: "Ad-free reading", included: false },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "₹99",
    amount: 99,
    term: "Per month",
    cta: "Choose Premium",
    recommended: true,
    features: [
      { text: "All free news", included: true },
      { text: "Premium articles", included: true },
      { text: "Ad-free reading", included: true },
      { text: "Bookmark articles", included: true },
      { text: "Exclusive newsletter", included: true },
    ],
  },
  {
    id: "premium-plus",
    name: "Premium Plus",
    price: "₹199",
    amount: 199,
    term: "Per month",
    cta: "Choose Premium Plus",
    features: [
      { text: "Everything in Premium", included: true },
      { text: "Deep-dive reports", included: true },
      { text: "News audio", included: true },
      { text: "Premium archives", included: true },
      { text: "Early access", included: true },
    ],
  },
];
