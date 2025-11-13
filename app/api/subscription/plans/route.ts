import { NextResponse } from 'next/server'

export async function GET() {
  const SUBSCRIPTION_PLANS = {
    free: {
      name: 'Free',
      price: 0,
      currency: 'USD',
      interval: 'month',
      features: [
        '10 app generations per month',
        'Basic code templates',
        'Community support',
        'Standard AI models',
      ],
      limits: {
        monthlyGenerations: 10,
        maxFilesPerProject: 10,
        prioritySupport: false,
        advancedFeatures: false,
      },
    },
    pro: {
      name: 'Devmate Pro',
      price: 19,
      currency: 'USD',
      interval: 'month',
      features: [
        '100 app generations per month',
        'Advanced code templates',
        'Priority support',
        'Premium AI models (GPT-5)',
        'Code testing & validation',
        'Live preview',
      ],
      limits: {
        monthlyGenerations: 100,
        maxFilesPerProject: 50,
        prioritySupport: true,
        advancedFeatures: true,
      },
    },
    pro_plus: {
      name: 'Devmate Pro Plus',
      price: 49,
      currency: 'USD',
      interval: 'month',
      features: [
        'Unlimited app generations',
        'Industrial-grade code generation',
        '24/7 Premium support',
        'All AI models (GPT-5, Gemini Pro, Grok)',
        'Advanced testing & deployment',
        'Live preview with hot reload',
        'Team collaboration',
        'Custom templates',
        'API access',
      ],
      limits: {
        monthlyGenerations: -1,
        maxFilesPerProject: -1,
        prioritySupport: true,
        advancedFeatures: true,
      },
    },
  }

  return NextResponse.json({ plans: SUBSCRIPTION_PLANS })
}
