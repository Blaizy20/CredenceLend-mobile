import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { loansAPI } from '../lib/api';

interface CoMakerForm {
  first_name: string;
  last_name: string;
  contact_no: string;
  email: string;
  province: string;
  city: string;
  barangay: string;
  street: string;
}

export default function ApplyLoanStep2() {
  const navigate = useNavigate();
  const location = useLocation();
  const step1 = location.state?.step1;

  // Redirect back if Step 1 data is missing
  React.useEffect(() => {
    if (!step1) navigate('/apply', { replace: true });
  }, [step1]);

  const [formData, setFormData] = useState<CoMakerForm>({
    first_name: '',
    last_name: '',
    contact_no: '',
    email: '',
    province: '',
    city: '',
    barangay: '',
    street: '',
  });

  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleChange = (field: keyof CoMakerForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    if (submitError) setSubmitError('');
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required.';
    if (!formData.last_name.trim())  newErrors.last_name  = 'Last name is required.';
    if (!formData.contact_no.trim()) newErrors.contact_no = 'Contact number is required.';
    else if (!/^09\d{9}$/.test(formData.contact_no))
      newErrors.contact_no = 'Please enter a valid PH number (09XXXXXXXXX).';
    if (!formData.province.trim()) newErrors.province = 'Province is required.';
    if (!formData.city.trim())     newErrors.city     = 'City is required.';
    if (!formData.barangay.trim()) newErrors.barangay = 'Barangay is required.';
    if (!formData.street.trim())   newErrors.street   = 'Street is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !step1) return;

    let user: any = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}
    if (!user?.customer_id) {
      navigate('/login', { replace: true });
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const result = await loansAPI.applyLoan({
        customer_id:     user.customer_id,
        tenant_id:       user.tenant_id ?? 1,
        principal_amount: step1.principal_amount,
        payment_term:    step1.payment_term,
        interest_rate:   step1.interest_rate,
        term_months:     step1.term_months,
        id_type:         step1.id_type,
        collateral_type: step1.collateral_type,
        co_maker:        formData,
      });

      if (!result.success) {
        setSubmitError(result.message || 'Submission failed. Please try again.');
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch {
      setSubmitError('An unexpected error occurred. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!step1) return null;

  return (
    <div className="min-h-screen bg-background pb-12">
      <TopBar title="Co-maker Details" />

      <main className="pt-24 px-6 max-w-md mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <span className="font-headline font-extrabold text-2xl tracking-tight text-on-surface">
              Step 2 <span className="text-primary/60 text-lg font-medium">of 2</span>
            </span>
            <span className="font-body text-xs uppercase tracking-widest text-primary font-bold">
              Co-maker
            </span>
          </div>
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full w-full bg-primary rounded-full" />
          </div>
        </div>

        {/* Loan Summary */}
        <div className="mb-8 p-4 bg-surface-container-high rounded-xl space-y-1 border border-outline-variant/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            Loan Summary
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Amount</span>
            <span className="font-bold text-on-surface">
              ₱{Number(step1.principal_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Term</span>
            <span className="font-bold text-on-surface">{step1.payment_term}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Interest Rate</span>
            <span className="font-bold text-primary">{step1.interest_rate}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Collateral</span>
            <span className="font-bold text-on-surface">{step1.collateral_type}</span>
          </div>
        </div>

        {/* Personal Info */}
        <section className="space-y-6 mb-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h2 className="font-headline font-bold text-lg text-on-surface">Personal Info</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              placeholder="Juan"
              value={formData.first_name}
              onChange={(e) => handleChange('first_name', e.target.value)}
              error={errors.first_name}
            />
            <Input
              label="Last Name"
              placeholder="Dela Cruz"
              value={formData.last_name}
              onChange={(e) => handleChange('last_name', e.target.value)}
              error={errors.last_name}
            />
          </div>
          <Input
            label="Contact No."
            placeholder="09XXXXXXXXX"
            value={formData.contact_no}
            onChange={(e) => handleChange('contact_no', e.target.value)}
            error={errors.contact_no}
          />
          <Input
            label="Email Address (Optional)"
            placeholder="juan@example.com"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={errors.email}
          />
        </section>

        {/* Address */}
        <section className="space-y-6 mb-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h2 className="font-headline font-bold text-lg text-on-surface">Address</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Province"
              placeholder="Enter Province"
              value={formData.province}
              onChange={(e) => handleChange('province', e.target.value)}
              error={errors.province}
            />
            <Input
              label="City"
              placeholder="Enter City"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              error={errors.city}
            />
          </div>
          <Input
            label="Barangay"
            placeholder="Brgy. San Jose"
            value={formData.barangay}
            onChange={(e) => handleChange('barangay', e.target.value)}
            error={errors.barangay}
          />
          <Input
            label="Street"
            placeholder="House No., Building, Street Name"
            value={formData.street}
            onChange={(e) => handleChange('street', e.target.value)}
            error={errors.street}
          />
        </section>

        {/* Error */}
        {submitError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-500 text-sm font-medium">{submitError}</p>
          </div>
        )}

        {/* Submit */}
        <footer className="mt-4 mb-8 space-y-4">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'SUBMIT APPLICATION'}
          </Button>
          <div className="flex flex-col items-center">
            <button
              onClick={() => navigate('/apply')}
              className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium"
              disabled={submitting}
            >
              Back to Step 1
            </button>
            <div className="w-12 h-1 bg-surface-container-highest rounded-full mt-2" />
          </div>
        </footer>
      </main>
    </div>
  );
}