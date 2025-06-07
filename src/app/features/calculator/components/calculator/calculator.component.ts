import { Component, OnInit, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Observable } from 'rxjs';

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
    specialty: string;
    claimSuccessRatio: number;
    address: string;
    npiNumber: string;
  }>;
}

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.scss'],

})
export class CalculatorComponent implements OnInit {
  @ViewChild('formSection') formSection!: ElementRef;

  calculatorForm: FormGroup;
  calculationResult: CalculationResult | null = null;
  isLoading = false;
  currentStep = 1;
  formErrors: { [key: string]: string } = {};

  // Animated counter properties
  accuracyRate = 0;
  revenueAmount = 0.0;
  partnerCount = 0;

  // Professional validation messages
  private validationMessages: { [key: string]: { [key: string]: string } } = {
    address: {
      required: 'Practice address is required for accurate analysis',
      minlength: 'Please provide a complete address'
    },
    pincode: {
      required: 'ZIP/PIN code is required for regional benchmarking',
      pattern: 'Please enter a valid ZIP/PIN code'
    },
    specialty: {
      required: 'Medical specialty helps us provide targeted insights'
    },
    patientVolume: {
      required: 'Patient volume is essential for accurate calculations',
      min: 'Patient volume must be greater than 0'
    },
    billingAverage: {
      required: 'Average revenue per patient is required',
      min: 'Revenue must be greater than 0'
    },
    collectionRate: {
      required: 'Collection rate is required for analysis',
      min: 'Collection rate must be greater than 0',
      max: 'Collection rate cannot exceed 100%'
    },
    paymentTime: {
      required: 'Average payment time is required',
      min: 'Payment time must be greater than 0'
    },
    processingType: {
      required: 'Please select your processing model'
    }
  };

  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    this.calculatorForm = this.createForm();
  }

  ngOnInit(): void {
    this.setupFormValidation();
    this.addProfessionalAnimations();
    this.startCounterAnimations();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      // Step 1: Practice Information
      address: ['', [Validators.required, Validators.minLength(10)]],
      pincode: ['', [Validators.required, this.zipCodeValidator]],
      specialty: ['', Validators.required],

      // Step 2: Financial & Volume Data
      patientVolume: [100, [Validators.required, Validators.min(1)]],
      volumePeriod: ['monthly'],
      billingAverage: ['', [Validators.required, Validators.min(0.01)]],
      collectionRate: [85, [Validators.required, Validators.min(1), Validators.max(100)]],
      paymentTime: [30, [Validators.required, Validators.min(1)]],
      knowDenialRate: [''],
      denialRate: [8],

      // Step 3: Processing Model
      processingType: ['', Validators.required],

      // In-house processing
      staffWages: [''],
      wageType: ['monthly'],
      staffCount: [''],

      // Outsource processing
      outsourcePricing: [''],
      percentageValue: [''],
      perClaimValue: [''],
      monthlyValue: [''],
      hourlyValue: ['']
    });
  }

  private setupFormValidation(): void {
    // Real-time validation
    this.calculatorForm.valueChanges.subscribe(() => {
      this.updateFormErrors();
    });

    // Dynamic validators based on processing type
    this.calculatorForm.get('processingType')?.valueChanges.subscribe(value => {
      this.updateProcessingValidators(value);
    });

    // Dynamic validators for outsource pricing
    this.calculatorForm.get('outsourcePricing')?.valueChanges.subscribe(value => {
      this.updateOutsourcePricingValidators(value);
    });

    // Denial rate conditional validation
    this.calculatorForm.get('knowDenialRate')?.valueChanges.subscribe(value => {
      const denialRateControl = this.calculatorForm.get('denialRate');
      if (value === 'yes') {
        denialRateControl?.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
      } else {
        denialRateControl?.clearValidators();
      }
      denialRateControl?.updateValueAndValidity();
    });
  }

  private updateFormErrors(): void {
    this.formErrors = {};
    Object.keys(this.calculatorForm.controls).forEach(key => {
      const control = this.calculatorForm.get(key);
      if (control && !control.valid && control.touched) {
        const messages = this.validationMessages[key];
        if (messages) {
          for (const errorKey in control.errors) {
            if (messages[errorKey]) {
              this.formErrors[key] = messages[errorKey];
              break;
            }
          }
        }
      }
    });
  }

  private updateProcessingValidators(processingType: string): void {
    const staffWages = this.calculatorForm.get('staffWages');
    const staffCount = this.calculatorForm.get('staffCount');

    if (processingType === 'inhouse') {
      staffWages?.setValidators([Validators.required, Validators.min(0.01)]);
      staffCount?.setValidators([Validators.required, Validators.min(1)]);
    } else {
      staffWages?.clearValidators();
      staffCount?.clearValidators();
    }

    staffWages?.updateValueAndValidity();
    staffCount?.updateValueAndValidity();
  }

  private updateOutsourcePricingValidators(pricingType: string): void {
    // Clear all outsource pricing validators
    ['percentageValue', 'perClaimValue', 'monthlyValue', 'hourlyValue'].forEach(field => {
      this.calculatorForm.get(field)?.clearValidators();
      this.calculatorForm.get(field)?.updateValueAndValidity();
    });

    // Set validator for selected pricing type
    if (pricingType) {
      const control = this.calculatorForm.get(pricingType + 'Value');
      if (control) {
        const validators = [Validators.required, Validators.min(0.01)];
        if (pricingType === 'percentage') {
          validators.push(Validators.max(100));
        }
        control.setValidators(validators);
        control.updateValueAndValidity();
      }
    }
  }

  private zipCodeValidator(control: AbstractControl): { [key: string]: any } | null {
    if (!control.value) return null;

    // US ZIP code pattern (5 digits or 5+4 format)
    const usZipPattern = /^\d{5}(-\d{4})?$/;
    // Indian PIN code pattern (6 digits)
    const indianPinPattern = /^\d{6}$/;

    if (usZipPattern.test(control.value) || indianPinPattern.test(control.value)) {
      return null;
    }

    return { pattern: true };
  }

  private addProfessionalAnimations(): void {
    // Add staggered animations to form elements
    setTimeout(() => {
      const elements = document.querySelectorAll('.fade-in, .slide-up');
      elements.forEach((el, index) => {
        setTimeout(() => {
          el.classList.add('animate');
        }, index * 100);
      });
    }, 100);
  }

  private startCounterAnimations(): void {
    // Start animations after a short delay for better visual impact
    setTimeout(() => {
      this.animateCounter('accuracyRate', 95, 2000);
      this.animateCounter('revenueAmount', 2.3, 2000, true);
      this.animateCounter('partnerCount', 5000, 2000);
    }, 500);
  }

  private animateCounter(property: string, target: number, duration: number, isDecimal: boolean = false): void {
    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = startValue + (target - startValue) * easeOutQuart;

      if (isDecimal) {
        (this as any)[property] = Number(currentValue.toFixed(1));
      } else {
        (this as any)[property] = Math.floor(currentValue);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure final value is exact
        (this as any)[property] = isDecimal ? Number(target.toFixed(1)) : target;
      }
    };

    requestAnimationFrame(animate);
  }

  // Step navigation with enhanced validation
  nextStep(): void {
    if (this.validateCurrentStep()) {
      this.currentStep++;
      this.scrollToForm();
      this.addStepAnimation();
    } else {
      this.highlightErrors();
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.scrollToForm();
      this.addStepAnimation();
    }
  }

  private validateCurrentStep(): boolean {
    const stepFields = this.getStepFields(this.currentStep);
    let isValid = true;

    stepFields.forEach(fieldName => {
      const control = this.calculatorForm.get(fieldName);
      if (control) {
        control.markAsTouched();
        if (!control.valid) {
          isValid = false;
        }
      }
    });

    return isValid;
  }

  private getStepFields(step: number): string[] {
    switch (step) {
      case 1:
        return ['address', 'pincode', 'specialty'];
      case 2:
        return ['patientVolume', 'billingAverage', 'collectionRate', 'paymentTime'];
      case 3:
        return ['processingType'];
      default:
        return [];
    }
  }

  private highlightErrors(): void {
    // Add visual feedback for validation errors
    const errorElements = document.querySelectorAll('.form-input.error, .form-select.error');
    errorElements.forEach(el => {
      el.classList.add('shake');
      setTimeout(() => el.classList.remove('shake'), 500);
    });
  }

  private addStepAnimation(): void {
    const currentStepElement = document.querySelector(`[data-step="${this.currentStep}"]`);
    if (currentStepElement) {
      currentStepElement.classList.add('scale-in');
    }
  }

  // Enhanced step validation methods
  isStep1Valid(): boolean {
    const addressValid = this.calculatorForm.get('address')?.valid || false;
    const pincodeValid = this.calculatorForm.get('pincode')?.valid || false;
    const specialtyValid = this.calculatorForm.get('specialty')?.valid || false;
    return addressValid && pincodeValid && specialtyValid;
  }

  isStep2Valid(): boolean {
    const requiredFields = ['patientVolume', 'volumePeriod', 'billingAverage', 'collectionRate', 'paymentTime', 'knowDenialRate'];
    const baseValid = requiredFields.every(field => this.calculatorForm.get(field)?.valid);

    const denialRateControl = this.calculatorForm.get('denialRate');
    if (this.calculatorForm.get('knowDenialRate')?.value === 'yes') {
      return baseValid && (denialRateControl?.valid ?? false);
    }
    return baseValid;
  }

  isStep3Valid(): boolean {
    const processingTypeValid = this.calculatorForm.get('processingType')?.valid || false;

    if (this.calculatorForm.get('processingType')?.value === 'inhouse') {
      const inhouseValid = this.calculatorForm.get('staffWages')?.valid &&
                          this.calculatorForm.get('wageType')?.valid &&
                          this.calculatorForm.get('staffCount')?.valid;
      return processingTypeValid && (inhouseValid ?? false);
    } else if (this.calculatorForm.get('processingType')?.value === 'outsource') {
      const outsourcePricingValid = this.calculatorForm.get('outsourcePricing')?.valid || false;
      return processingTypeValid && outsourcePricingValid;
    }

    return processingTypeValid;
  }

  // Processing type methods
  setProcessingType(type: string): void {
    this.calculatorForm.get('processingType')?.setValue(type);
  }

  setOutsourcePricing(type: string): void {
    this.calculatorForm.get('outsourcePricing')?.setValue(type);
  }

  // Professional form interaction methods
  private addSelectionFeedback(type: string): void {
    // Add visual feedback for selection
    const cards = document.querySelectorAll('.processing-card');
    cards.forEach(card => {
      card.classList.remove('selected');
      if (card.getAttribute('data-type') === type) {
        card.classList.add('selected');
      }
    });
  }

  onPincodeChange(): void {
    const pincode = this.calculatorForm.get('pincode')?.value;
    if (pincode && this.zipCodeValidator({ value: pincode } as AbstractControl) === null) {
      // Add success feedback
      const pincodeInput = document.querySelector('input[formControlName="pincode"]');
      if (pincodeInput) {
        pincodeInput.classList.add('success');
        setTimeout(() => pincodeInput.classList.remove('success'), 2000);
      }
    }
  }

  scrollToForm(): void {
    if (this.formSection) {
      this.formSection.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  // Enhanced form submission with professional loading states
  async onSubmit(): Promise<void> {
    if (!this.calculatorForm.valid) {
      this.markAllFieldsAsTouched();
      this.highlightErrors();
      return;
    }

      this.isLoading = true;
    this.addLoadingAnimation();

    try {
      // Simulate API call with realistic delay
      await this.delay(2000);

      const formData = this.calculatorForm.value;
      this.calculationResult = await this.generateMockCalculation(formData);

      // Add success animation
      this.addSuccessAnimation();

      // Scroll to results
      setTimeout(() => {
        const resultsSection = document.querySelector('.results-section');
        if (resultsSection) {
          resultsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);

    } catch (error) {
      console.error('Calculation error:', error);
      this.handleCalculationError();
    } finally {
      this.isLoading = false;
    }
  }

  private async generateMockCalculation(formData: any): Promise<CalculationResult> {
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

    // Generate mock nearby providers
    const nearbyProviders = [
      {
        name: 'Regional Medical Center',
        npiNumber: '1234567890',
        specialty: this.formatSpecialty(formData.specialty),
        claimSuccessRatio: 94.2,
        address: 'Downtown Medical District'
      },
      {
        name: 'Community Health Partners',
        npiNumber: '2345678901',
        specialty: this.formatSpecialty(formData.specialty),
        claimSuccessRatio: 91.8,
        address: 'Suburban Healthcare Plaza'
      },
      {
        name: 'Advanced Care Clinic',
        npiNumber: '3456789012',
        specialty: this.formatSpecialty(formData.specialty),
        claimSuccessRatio: 89.5,
        address: 'Medical Arts Building'
      },
      {
        name: 'Premier Healthcare Group',
        npiNumber: '4567890123',
        specialty: this.formatSpecialty(formData.specialty),
        claimSuccessRatio: 96.1,
        address: 'University Medical Campus'
      }
    ];

    return {
      userMetrics: {
        averageClaimPercentage: Math.round(averageClaimPercentage * 10) / 10,
        claimDenialRate: Math.round(denialRate * 10) / 10,
        costPerClaim: Math.round(costPerClaim * 100) / 100,
        totalMonthlyClaims: Math.round(totalMonthlyClaims),
        monthlyRevenue: Math.round(monthlyRevenue),
        monthlyProcessingCost: Math.round(monthlyProcessingCost)
      },
      benchmarkMetrics: {
        berserkClaimPercentage: 96.5,
        berserkCostPerClaim: 12.50,
        industryAverage: 92.0
      },
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
      'other': 'Other Specialty'
    };

    return specialtyMap[specialty] || 'General Practice';
  }

  private markAllFieldsAsTouched(): void {
    Object.keys(this.calculatorForm.controls).forEach(key => {
      this.calculatorForm.get(key)?.markAsTouched();
    });
  }

  private addLoadingAnimation(): void {
    const submitButton = document.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.classList.add('loading');
    }
  }

  private addSuccessAnimation(): void {
    const formContainer = document.querySelector('.form-container');
    if (formContainer) {
      formContainer.classList.add('success-submitted');
    }
  }

  private handleCalculationError(): void {
    // Show professional error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-notification';
    errorMessage.innerHTML = `
      <div class="error-content">
        <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <div>
          <h4>Calculation Error</h4>
          <p>We encountered an issue processing your request. Please try again or contact support.</p>
        </div>
      </div>
    `;

    document.body.appendChild(errorMessage);

    setTimeout(() => {
      errorMessage.remove();
    }, 5000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  resetCalculator(): void {
    this.calculationResult = null;
    this.currentStep = 1;
    this.calculatorForm.reset();
    this.calculatorForm.patchValue({
      volumePeriod: 'monthly',
      wageType: 'monthly'
    });

    // Scroll to top with animation
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Add reset animation
    setTimeout(() => {
      this.addProfessionalAnimations();
    }, 300);
  }

  // Professional utility methods
  trackByProvider(index: number, provider: any): string {
    return provider.npiNumber;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  getPerformanceClass(percentage: number): string {
    if (percentage >= 90) return 'excellent';
    if (percentage >= 80) return 'good';
    if (percentage >= 70) return 'average';
    return 'needs-improvement';
  }

  getPerformanceLabel(percentage: number): string {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 80) return 'Good';
    if (percentage >= 70) return 'Average';
    return 'Needs Improvement';
  }

  // Professional form field helpers
  getFieldError(fieldName: string): string | null {
    return this.formErrors[fieldName] || null;
  }

  isFieldValid(fieldName: string): boolean {
    const control = this.calculatorForm.get(fieldName);
    return control ? control.valid && control.touched : false;
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.calculatorForm.get(fieldName);
    return control ? !control.valid && control.touched : false;
  }

  getCurrencySymbol(): string {
    return '$';
  }

  // Professional accessibility helpers
  getAriaLabel(fieldName: string): string {
    const control = this.calculatorForm.get(fieldName);
    if (!control) return '';

    if (control.invalid && control.touched) {
      return `${fieldName} field has errors`;
    }
    if (control.valid && control.touched) {
      return `${fieldName} field is valid`;
    }
    return `${fieldName} field`;
  }

  getAriaDescribedBy(fieldName: string): string {
    const hasError = this.isFieldInvalid(fieldName);
    const hasSuccess = this.isFieldValid(fieldName);

    if (hasError) return `${fieldName}-error`;
    if (hasSuccess) return `${fieldName}-success`;
    return '';
  }
}

