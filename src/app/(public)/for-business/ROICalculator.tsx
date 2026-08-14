"use client";
// src/app/(public)/for-business/ROICalculator.tsx
// Interactive ROI calculator for the B2B landing page.
// Lets a buyer see exactly how much time + money TraineesAI saves.

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/modules/ui/card";
import { Button } from "@/modules/ui/button";
import { Badge } from "@/modules/ui/badge";
import { Calculator, Clock, DollarSign, TrendingUp, ArrowRight } from "lucide-react";
import Link from "next/link";

export function ROICalculator() {
  const [engineers, setEngineers] = useState(5);
  const [avgSalary, setAvgSalary] = useState(120000);
  const [interns, setInterns] = useState(10);
  const [hoursPerWeek, setHoursPerWeek] = useState(7);

  const calc = useMemo(() => {
    // Senior eng hourly rate (salary / 2000 working hours)
    const hourlyRate = avgSalary / 2000;
    // Current cost: engineers spending hoursPerWeek per intern
    const currentHoursPerWeek = engineers * hoursPerWeek * (interns / engineers);
    const currentWeeklyCost = currentHoursPerWeek * hourlyRate;
    const currentAnnualCost = currentWeeklyCost * 50; // 50 working weeks
    // With TraineesAI: mentors spend ~1h/week per intern (vs hoursPerWeek)
    const newHoursPerWeek = engineers * 1 * (interns / engineers);
    const newWeeklyCost = newHoursPerWeek * hourlyRate;
    const newAnnualCost = newWeeklyCost * 50;
    // TraineesAI cost: $29/seat/month × interns × 12
    const traineesCost = interns * 29 * 12;
    // Savings
    const annualSavings = currentAnnualCost - newAnnualCost - traineesCost;
    const hoursReturned = (currentHoursPerWeek - newHoursPerWeek) * 50;
    const roiMultiple = currentAnnualCost > 0
      ? (annualSavings / (traineesCost + newAnnualCost))
      : 0;
    return {
      currentAnnualCost: Math.round(currentAnnualCost),
      newAnnualCost: Math.round(newAnnualCost),
      traineesCost,
      annualSavings: Math.round(annualSavings),
      hoursReturned: Math.round(hoursReturned),
      roiMultiple: roiMultiple.toFixed(1),
    };
  }, [engineers, avgSalary, interns, hoursPerWeek]);

  return (
    <section className="border-b border-line bg-bg-subtle/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <Badge variant="outline" className="mb-4 border-brand/30 text-brand">
            <Calculator className="h-3 w-3 mr-1" /> ROI Calculator
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
            See exactly how much you save.
          </h2>
          <p className="mt-3 text-fg-muted">
            Drag the sliders to match your team. Numbers update in real-time.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
          {/* LEFT: Inputs */}
          <Card className="border-line">
            <CardHeader>
              <CardTitle className="text-base">Your team</CardTitle>
              <CardDescription>Adjust to match your situation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Engineers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Senior engineers mentoring</label>
                  <span className="text-2xl font-bold text-brand tabular-nums">{engineers}</span>
                </div>
                <input
                  type="range" min={1} max={50} value={engineers}
                  onChange={(e) => setEngineers(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              {/* Avg salary */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Avg engineer salary</label>
                  <span className="text-2xl font-bold text-brand tabular-nums">${(avgSalary / 1000).toFixed(0)}K</span>
                </div>
                <input
                  type="range" min={60000} max={300000} step={10000} value={avgSalary}
                  onChange={(e) => setAvgSalary(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              {/* Interns */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Trainees to onboard</label>
                  <span className="text-2xl font-bold text-brand tabular-nums">{interns}</span>
                </div>
                <input
                  type="range" min={1} max={100} value={interns}
                  onChange={(e) => setInterns(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              {/* Hours per week */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Hours/week per intern (current)</label>
                  <span className="text-2xl font-bold text-brand tabular-nums">{hoursPerWeek}h</span>
                </div>
                <input
                  type="range" min={1} max={20} value={hoursPerWeek}
                  onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* RIGHT: Results */}
          <div className="space-y-4">
            {/* Headline savings */}
            <Card className="border-brand/30 bg-brand-subtle">
              <CardContent className="p-6 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-brand">Annual Savings</p>
                <p className="mt-2 text-4xl font-extrabold text-brand tabular-nums">
                  ${calc.annualSavings.toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-fg-muted">
                  {calc.roiMultiple}× ROI on TraineesAI subscription
                </p>
              </CardContent>
            </Card>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-line">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-growth-sage" />
                    <span className="text-xs text-fg-muted">Hours returned</span>
                  </div>
                  <p className="text-2xl font-bold text-fg tabular-nums">{calc.hoursReturned}h</p>
                  <p className="text-[10px] text-fg-muted">per year, to your engineers</p>
                </CardContent>
              </Card>
              <Card className="border-line">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-growth-sage" />
                    <span className="text-xs text-fg-muted">Current cost</span>
                  </div>
                  <p className="text-2xl font-bold text-fg tabular-nums">${(calc.currentAnnualCost / 1000).toFixed(0)}K</p>
                  <p className="text-[10px] text-fg-muted">mentor time per year</p>
                </CardContent>
              </Card>
            </div>

            {/* CTA */}
            <Button asChild size="lg" className="w-full">
              <Link href="/signup/b2b">
                <TrendingUp className="h-4 w-4 mr-2" />
                Start Saving — Create Your Org
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <p className="text-center text-xs text-fg-muted">
              30-day risk-free pilot · No credit card required
            </p>
          </div>
        </div>
        </div>
      </section>
  );
}
