  // File upload handlers (persist to localStorage and show preview)
  const handleFileChange = (e, field, idx) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData(f => {
        let newData = { ...f };
        if (field === 'otherDocs') {
          const updated = [...(f.otherDocs || ['', '', ''])];
          updated[idx] = ev.target.result;
          newData.otherDocs = updated;
        } else {
          newData[field] = ev.target.result;
        }
        localStorage.setItem('loanApplicationData', JSON.stringify(newData));
        return newData;
      });
    };
    reader.readAsDataURL(file);
  };
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Camera, ArrowRight, Paperclip, FileText } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion } from 'motion/react';


export default function ApplyLoanStep1() {
  const navigate = useNavigate();
  // Load saved data if present
  const saved = localStorage.getItem('loanApplicationData');
  const [formData, setFormData] = useState(() => saved ? JSON.parse(saved) : {
    amount: '',
    term: 'Semi-monthly (3.50% int rate)',
    idType: 'Driver\'s License',
    collateralType: '',
    // Add default interest rates for all terms
    interestRates: {
      'Daily': 2.75,
      'Weekly': 3.0,
      'Semi-monthly': 3.5,
      'Monthly': 4.0
    }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.amount || Number(formData.amount) <= 0) newErrors.amount = 'Valid amount is required';
    if (!formData.collateralType) newErrors.collateralType = 'Collateral type is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      // Always persist the latest formData (including files)
      localStorage.setItem('loanApplicationData', JSON.stringify(formData));
      navigate('/apply/step2');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="" showBack={false} rightElement={<button onClick={() => navigate('/dashboard')} className="p-2 text-primary"><X size={24} /></button>} />
      
      <main className="pt-24 px-6 max-w-md mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">STEP 1 OF 2</span>
            <div className="h-[2px] flex-grow bg-surface-container-highest overflow-hidden rounded-full">
              <div className="h-full w-1/2 bg-primary rounded-full"></div>
            </div>
          </div>
          <h2 className="text-3xl font-headline font-extrabold text-on-surface">Loan Details</h2>
        </div>

        <section className="space-y-6 mb-10">
          <Input 
            label="REQUESTED AMOUNT" 
            placeholder="0.00" 
            type="number"
            icon={<span className="font-bold text-lg">P</span>}
            className="text-xl font-bold"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            error={errors.amount}
          />

          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">PAYMENT TERM</label>
            <select 
              value={formData.term}
              onChange={(e) => setFormData({ ...formData, term: e.target.value })}
              className="w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/50 rounded-xl py-4 px-4 text-on-surface font-medium transition-all appearance-none"
            >
              <option>Daily (2.75% int rate)</option>
              <option>Weekly (3.0% int rate)</option>
              <option>Semi-monthly (3.50% int rate)</option>
              <option>Monthly (4.0% int rate)</option>
            </select>
          </div>
        </section>

        <section className="space-y-6 mb-10">
          <h3 className="text-sm font-bold tracking-wider text-primary/80 uppercase">Applicant ID Information</h3>
          <div className="space-y-2">
            <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase ml-1">ID TYPE</label>
            <select 
              value={formData.idType}
              onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
              className="w-full bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/50 rounded-xl py-4 px-4 text-on-surface font-medium transition-all appearance-none"
            >
              <option>Driver's License</option>
              <option>Passport</option>
              <option>National ID</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">VALID ID (FRONT)</label>
              <div className="aspect-[3/2] bg-surface-container-low rounded-xl border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-4 text-center group hover:border-primary/50 transition-colors">
                <Camera className="text-outline group-hover:text-primary transition-colors mb-2" size={24} />
                <input type="file" accept="image/*" style={{ display: 'none' }} id="idFrontUpload" onChange={e => handleFileChange(e, 'idFront')} />
                <label htmlFor="idFrontUpload" className="bg-primary/10 text-primary text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-tighter cursor-pointer">CHOOSE FILE</label>
                {formData.idFront ? (
                  <div className="mt-2 flex flex-col items-center">
                    <img src={formData.idFront} alt="ID Front Preview" className="w-20 h-14 object-contain rounded border border-green-200" />
                    <span className="text-xs text-green-600 mt-1">File attached</span>
                  </div>
                ) : (
                  <span className="text-xs text-outline mt-1">No file selected</span>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">VALID ID (BACK)</label>
              <div className="aspect-[3/2] bg-surface-container-low rounded-xl border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center p-4 text-center group hover:border-primary/50 transition-colors">
                <Camera className="text-outline group-hover:text-primary transition-colors mb-2" size={24} />
                <input type="file" accept="image/*" style={{ display: 'none' }} id="idBackUpload" onChange={e => handleFileChange(e, 'idBack')} />
                <label htmlFor="idBackUpload" className="bg-primary/10 text-primary text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-tighter cursor-pointer">CHOOSE FILE</label>
                {formData.idBack ? (
                  <div className="mt-2 flex flex-col items-center">
                    <img src={formData.idBack} alt="ID Back Preview" className="w-20 h-14 object-contain rounded border border-green-200" />
                    <span className="text-xs text-green-600 mt-1">File attached</span>
                  </div>
                ) : (
                  <span className="text-xs text-outline mt-1">No file selected</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6 mb-10">
          <h3 className="text-sm font-bold tracking-wider text-primary/80 uppercase">Collateral Information</h3>
          <Input 
            label="COLLATERAL TYPE" 
            placeholder="e.g. Real Estate, Vehicle, etc." 
            value={formData.collateralType}
            onChange={(e) => setFormData({ ...formData, collateralType: e.target.value })}
            error={errors.collateralType}
          />
          
          <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-white/5">
            <div className="flex items-center gap-3">
              <Paperclip className="text-primary" size={20} />
              <span className="text-sm font-medium">Collateral Proof</span>
            </div>
            <input type="file" accept="image/*" style={{ display: 'none' }} id="collateralProofUpload" onChange={e => handleFileChange(e, 'collateralProof')} />
            <label htmlFor="collateralProofUpload" className="bg-primary text-on-primary-container text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider shadow-lg shadow-primary/20 cursor-pointer">CHOOSE FILE</label>
            {formData.collateralProof ? (
              <span className="text-xs text-green-600 ml-2 flex items-center gap-2">
                <img src={formData.collateralProof} alt="Collateral Proof Preview" className="w-10 h-8 object-contain rounded border border-green-200" />
                File attached
              </span>
            ) : (
              <span className="text-xs text-outline ml-2">No file selected</span>
            )}
          </div>
        </section>

        <section className="space-y-6 mb-10">
          <h3 className="text-sm font-bold tracking-wider text-primary/80 uppercase">Other Documents</h3>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <FileText className="text-primary" size={20} />
                <span className="text-sm font-medium">Document {i}</span>
              </div>
              <input type="file" accept="image/*" style={{ display: 'none' }} id={`otherDocUpload${i}`} onChange={e => handleFileChange(e, 'otherDocs', i - 1)} />
              <label htmlFor={`otherDocUpload${i}`} className="bg-primary text-on-primary-container text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider shadow-lg shadow-primary/20 cursor-pointer">CHOOSE FILE</label>
              {formData.otherDocs && formData.otherDocs[i - 1] ? (
                <span className="text-xs text-green-600 ml-2 flex items-center gap-2">
                  <img src={formData.otherDocs[i - 1]} alt={`Other Document ${i} Preview`} className="w-10 h-8 object-contain rounded border border-green-200" />
                  File attached
                </span>
              ) : (
                <span className="text-xs text-outline ml-2">No file selected</span>
              )}
            </div>
          ))}
        </section>

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
