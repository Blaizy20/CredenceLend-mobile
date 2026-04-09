import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, Camera, Paperclip, FileText } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

const TERM_OPTIONS = [
  { label: 'Daily',        rate: 2.75, months: 30 },
  { label: 'Weekly',       rate: 3.0,  months: 12 },
  { label: 'Semi-monthly', rate: 3.5,  months: 24 },
  { label: 'Monthly',      rate: 4.0,  months: 12 },
];

const ID_TYPES = ["Driver's License", "Passport", "National ID"];

interface Step1Data {
  amount: string;
  term: string;
  id_type: string;
  collateral_type: string;
  idFront: string;
  idBack: string;
  collateralProof: string;
  otherDocs: string[];
}

export default function ApplyLoanStep1() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<Step1Data>({
    amount: '',
    term: 'Semi-monthly',
    id_type: "Driver's License",
    collateral_type: '',
    idFront: '',
    idBack: '',
    collateralProof: '',
    otherDocs: ['', '', ''],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: string,
    idx?: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size should not exceed 5MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setFormData(f => {
        if (field === 'otherDocs' && idx !== undefined) {
          const updated = [...f.otherDocs];
          updated[idx] = result;
          return { ...f, otherDocs: updated };
        }
        return { ...f, [field]: result };
      });
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const amt = Number(formData.amount);

    if (!formData.amount || isNaN(amt) || amt <= 0)
      newErrors.amount = 'Please enter a valid loan amount.';
    else if (amt < 1000)
      newErrors.amount = 'Minimum loan amount is ₱1,000.';
    else if (amt > 500000)
      newErrors.amount = 'Maximum loan amount is ₱500,000.';

    if (!formData.collateral_type.trim())
      newErrors.collateral_type = 'Please specify a collateral type.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    const selectedTerm = TERM_OPTIONS.find(t => t.label === formData.term) ?? TERM_OPTIONS[2];
    navigate('/apply/step2', {
      state: {
        step1: {
          principal_amount: Number(formData.amount),
          payment_term:     selectedTerm.label,
          interest_rate:    selectedTerm.rate,
          term_months:      selectedTerm.months,
          id_type:          formData.id_type,
          collateral_type:  formData.collateral_type.trim(),
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar
        title=""
        showBack={false}
        rightElement={
          <button onClick={() => navigate('/dashboard')} className="p-2 text-primary">
            <X size={24} />
          </button>
        }
      />

      <main className="pt-24 px-6 max-w-md mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">STEP 1 OF 2</span>
            <div className="h-[2px] flex-grow bg-surface-container-highest overflow-hidden rounded-full">
              <div className="h-full w-1/2 bg-primary rounded-full" />
            </div>
          </div>
          <h2 className="text-3xl font-headline font-extrabold text-on-surface">Loan Details</h2>
        </div>

        {/* Loan Amount & Term */}
        <section className="space-y-6 mb-10">
          <Input
            label="REQUESTED AMOUNT"
            placeholder="0.00"
            type="number"
            icon={<span className="font-bold text-lg">₱</span>}
            className="text-xl font-bold"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            error={errors.amount}
          />
          <p className="text-xs text-on-surface-variant -mt-4 ml-1">
            Minimum: ₱1,000 · Maximum: ₱500,000
          </p>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              PAYMENT TERM
            </label>
            <select
              value={formData.term}
              onChange={(e) => setFormData({ ...formData, term: e.target.value })}
              className="w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/50 rounded-xl py-4 px-4 text-on-surface font-medium transition-all appearance-none"
            >
              {TERM_OPTIONS.map(t => (
                <option key={t.label} value={t.label}>
                  {t.label} ({t.rate}% interest rate)
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Applicant ID Information */}
        <section className="space-y-6 mb-10">
          <h3 className="text-sm font-bold tracking-wider text-primary/80 uppercase">
            Applicant ID Information
          </h3>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">
              ID TYPE
            </label>
            <select
              value={formData.id_type}
              onChange={(e) => setFormData({ ...formData, id_type: e.target.value })}
              className="w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/50 rounded-xl py-4 px-4 text-on-surface font-medium transition-all appearance-none"
            >
              {ID_TYPES.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* ID Front */}
            <div className="space-y-3">
              <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">
                VALID ID (FRONT)
                <span className="ml-1 text-outline normal-case tracking-normal font-normal">— optional</span>
              </label>
              <div className="aspect-[3/2] bg-surface-container-low rounded-xl border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-4 text-center group hover:border-primary/50 transition-colors">
                <Camera className="text-outline group-hover:text-primary transition-colors mb-2" size={24} />
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  id="idFrontUpload"
                  onChange={e => handleFileChange(e, 'idFront')}
                />
                <label htmlFor="idFrontUpload" className="bg-primary/10 text-primary text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-tighter cursor-pointer">
                  CHOOSE FILE
                </label>
                {formData.idFront
                  ? <span className="text-xs text-green-600 mt-1">Attached ✓</span>
                  : <span className="text-xs text-outline mt-1">No file selected</span>
                }
              </div>
            </div>

            {/* ID Back */}
            <div className="space-y-3">
              <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">
                VALID ID (BACK)
                <span className="ml-1 text-outline normal-case tracking-normal font-normal">— optional</span>
              </label>
              <div className="aspect-[3/2] bg-surface-container-low rounded-xl border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-4 text-center group hover:border-primary/50 transition-colors">
                <Camera className="text-outline group-hover:text-primary transition-colors mb-2" size={24} />
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  id="idBackUpload"
                  onChange={e => handleFileChange(e, 'idBack')}
                />
                <label htmlFor="idBackUpload" className="bg-primary/10 text-primary text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-tighter cursor-pointer">
                  CHOOSE FILE
                </label>
                {formData.idBack
                  ? <span className="text-xs text-green-600 mt-1">Attached ✓</span>
                  : <span className="text-xs text-outline mt-1">No file selected</span>
                }
              </div>
            </div>
          </div>
        </section>

        {/* Collateral Information */}
        <section className="space-y-6 mb-10">
          <h3 className="text-sm font-bold tracking-wider text-primary/80 uppercase">
            Collateral Information
          </h3>
          <Input
            label="COLLATERAL TYPE"
            placeholder="e.g. Real Estate, Vehicle, Jewelry"
            value={formData.collateral_type}
            onChange={(e) => setFormData({ ...formData, collateral_type: e.target.value })}
            error={errors.collateral_type}
          />

          <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-white/5">
            <div className="flex items-center gap-3">
              <Paperclip className="text-primary" size={20} />
              <div>
                <p className="text-sm font-medium">Collateral Proof</p>
                <p className="text-xs text-on-surface-variant">Optional</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <input
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                id="collateralProofUpload"
                onChange={e => handleFileChange(e, 'collateralProof')}
              />
              <label htmlFor="collateralProofUpload" className="bg-primary text-on-primary-container text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider shadow-lg shadow-primary/20 cursor-pointer">
                CHOOSE FILE
              </label>
              {formData.collateralProof
                ? <span className="text-xs text-green-600">Attached ✓</span>
                : <span className="text-xs text-outline">No file selected</span>
              }
            </div>
          </div>
        </section>

        {/* Other Documents */}
        <section className="space-y-6 mb-10">
          <h3 className="text-sm font-bold tracking-wider text-primary/80 uppercase">
            Other Documents
            <span className="ml-1 text-outline normal-case font-normal text-xs tracking-normal">— optional</span>
          </h3>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <FileText className="text-primary" size={20} />
                <div>
                  <p className="text-sm font-medium">Document {i}</p>
                  <p className="text-xs text-on-surface-variant">Optional</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  id={`otherDocUpload${i}`}
                  onChange={e => handleFileChange(e, 'otherDocs', i - 1)}
                />
                <label htmlFor={`otherDocUpload${i}`} className="bg-primary text-on-primary-container text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider shadow-lg shadow-primary/20 cursor-pointer">
                  CHOOSE FILE
                </label>
                {formData.otherDocs[i - 1]
                  ? <span className="text-xs text-green-600">Attached ✓</span>
                  : <span className="text-xs text-outline">No file selected</span>
                }
              </div>
            </div>
          ))}
        </section>

        {/* Next Button */}
        <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-background via-background/95 to-transparent flex justify-center">
          <div className="w-full max-w-md">
            <Button onClick={handleNext}>
              Next <ArrowRight size={20} />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}