import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

interface CalculationResult {
  userMetrics: {
    averageClaimPercentage: number;
    claimDenialRate: number;
    costPerClaim: number;
    totalMonthlyClaims: number;
    monthlyRevenue: number;
    monthlyProcessingCost: number;
  };
  benchmarkMetrics: {
    berserkClaimPercentage: number;
    berserkCostPerClaim: number;
    industryAverage: number;
  };
  nearbyProviders: Array<{
    name: string;
    npiNumber: string;
    specialty: string;
    claimSuccessRatio: number;
    address: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class CalculatorService {
  private readonly API_BASE_URL = '/api';

  constructor(private http: HttpClient) {}

  async calculateMetrics(formData: any): Promise<CalculationResult> {
    try {
      // For now, return mock data with realistic calculations
      // In production, this would make an actual API call
      return this.generateMockCalculation(formData);
    } catch (error) {
      console.error('Error calculating metrics:', error);
      throw new Error('Failed to calculate metrics');
    }
  }

  private generateMockCalculation(formData: any): CalculationResult {
    // Extract form data
    const patientVolume = parseInt(formData.patientVolume) || 100;
    const billingAverage = parseFloat(formData.billingAverage) || 150;
    const collectionRate = parseFloat(formData.collectionRate) || 85;
    const paymentTime = parseInt(formData.paymentTime) || 30;
    const denialRate = formData.knowDenialRate === 'yes' ?
      parseFloat(formData.denialRate) || 8 : this.estimateDenialRate(formData.specialty);

    // Calculate monthly metrics based on volume period
    let monthlyPatients = patientVolume;
    if (formData.volumePeriod === 'daily') {
      monthlyPatients = patientVolume * 30;
    } else if (formData.volumePeriod === 'weekly') {
      monthlyPatients = patientVolume * 4;
    }

    const monthlyRevenue = monthlyPatients * billingAverage * (collectionRate / 100);
    const totalMonthlyClaims = monthlyPatients;

    // Calculate processing costs based on model
    let monthlyProcessingCost = 0;
    if (formData.processingType === 'inhouse') {
      const staffWages = parseFloat(formData.staffWages) || 4000;
      const staffCount = parseInt(formData.staffCount) || 2;
      monthlyProcessingCost = formData.wageType === 'hourly' ?
        staffWages * 160 * staffCount : // 160 hours per month
        staffWages * staffCount;
    } else if (formData.processingType === 'outsource') {
      const pricingType = formData.outsourcePricing;
      const pricingValue = parseFloat(formData[pricingType + 'Value']) || 0;

      switch (pricingType) {
        case 'percentage':
          monthlyProcessingCost = monthlyRevenue * (pricingValue / 100);
          break;
        case 'perClaim':
          monthlyProcessingCost = totalMonthlyClaims * pricingValue;
          break;
        case 'monthly':
          monthlyProcessingCost = pricingValue;
          break;
        case 'hourly':
          monthlyProcessingCost = pricingValue * 160; // 160 hours per month
          break;
      }
    }

    const costPerClaim = monthlyProcessingCost / totalMonthlyClaims;
    const averageClaimPercentage = Math.max(60, Math.min(98, 100 - denialRate));

    // Generate benchmark metrics
    const benchmarkMetrics = {
      berserkClaimPercentage: 96.5,
      berserkCostPerClaim: 12.50,
      industryAverage: 92.0
    };

    // Generate nearby providers
    const nearbyProviders = this.generateNearbyProviders(formData.specialty, formData.pincode);

    return {
      userMetrics: {
        averageClaimPercentage: Math.round(averageClaimPercentage * 10) / 10,
        claimDenialRate: Math.round(denialRate * 10) / 10,
        costPerClaim: Math.round(costPerClaim * 100) / 100,
        totalMonthlyClaims: Math.round(totalMonthlyClaims),
        monthlyRevenue: Math.round(monthlyRevenue),
        monthlyProcessingCost: Math.round(monthlyProcessingCost)
      },
      benchmarkMetrics,
      nearbyProviders
    };
  }

  private estimateDenialRate(specialty: string): number {
    // Estimated denial rates by specialty
    const denialRates: { [key: string]: number } = {
      'family_medicine': 7.2,
      'internal_medicine': 8.1,
      'pediatrics': 6.8,
      'cardiology': 9.3,
      'dermatology': 5.9,
      'orthopedics': 10.2,
      'dentistry': 4.5,
      'ophthalmology': 6.7,
      'psychiatry': 8.9,
      'other': 8.0
    };

    return denialRates[specialty] || 8.0;
  }

  private generateNearbyProviders(specialty: string, pincode: string): Array<any> {
    // Mock nearby providers data
    const providers = [
      {
        name: 'Regional Medical Center',
        npiNumber: '1234567890',
        specialty: this.formatSpecialty(specialty),
        claimSuccessRatio: 94.2,
        address: 'Downtown Medical District'
      },
      {
        name: 'Community Health Partners',
        npiNumber: '2345678901',
        specialty: this.formatSpecialty(specialty),
        claimSuccessRatio: 91.8,
        address: 'Suburban Healthcare Plaza'
      },
      {
        name: 'Advanced Care Clinic',
        npiNumber: '3456789012',
        specialty: this.formatSpecialty(specialty),
        claimSuccessRatio: 89.5,
        address: 'Medical Arts Building'
      },
      {
        name: 'Premier Healthcare Group',
        npiNumber: '4567890123',
        specialty: this.formatSpecialty(specialty),
        claimSuccessRatio: 96.1,
        address: 'University Medical Campus'
      },
      {
        name: 'Integrated Health Solutions',
        npiNumber: '5678901234',
        specialty: this.formatSpecialty(specialty),
        claimSuccessRatio: 88.7,
        address: 'Central Business District'
      }
    ];

    // Randomize the order and add some variation
    return providers
      .sort(() => Math.random() - 0.5)
      .slice(0, 4)
      .map(provider => ({
        ...provider,
        claimSuccessRatio: Math.round((provider.claimSuccessRatio + (Math.random() - 0.5) * 4) * 10) / 10
      }));
  }

  private formatSpecialty(specialty: string): string {
    const specialtyMap: { [key: string]: string } = {
      'family_medicine': 'Family Medicine',
      'internal_medicine': 'Internal Medicine',
      'pediatrics': 'Pediatrics',
      'cardiology': 'Cardiology',
      'dermatology': 'Dermatology',
      'orthopedics': 'Orthopedics',
      'dentistry': 'Dentistry',
      'ophthalmology': 'Ophthalmology',
      'psychiatry': 'Psychiatry',
      'other': 'General Practice'
    };

    return specialtyMap[specialty] || 'General Practice';
  }

  // Method for future API integration
  private callAPI(endpoint: string, data: any): Observable<CalculationResult> {
    return this.http.post<CalculationResult>(`${this.API_BASE_URL}${endpoint}`, data);
  }

  // Method to get provider data from NPI registry (future implementation)
  async getProvidersByLocation(pincode: string, specialty?: string): Promise<any[]> {
    // This would integrate with the NPI registry API
    // For now, return mock data
    return this.generateNearbyProviders(specialty || 'other', pincode);
  }

  // Method to validate ZIP/PIN codes (future implementation)
  async validateLocation(pincode: string): Promise<boolean> {
    // This would validate against a location service
    // For now, return true for basic patterns
    const usZipPattern = /^\d{5}(-\d{4})?$/;
    const indianPinPattern = /^\d{6}$/;

    return usZipPattern.test(pincode) || indianPinPattern.test(pincode);
  }
}
