import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CreditCard, PenTool, Upload } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion } from 'motion/react';


export default function ApplyLoanStep2() {
  const navigate = useNavigate();
  // Load saved data if present
  const saved = localStorage.getItem('loanApplicationStep2');
  const [formData, setFormData] = useState(() => saved ? JSON.parse(saved) : {
    firstName: '',
    lastName: '',
    contactNo: '',
    email: '',
    province: '',
    city: '',
    barangay: '',
    street: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // File uploads for co-maker
  const [files, setFiles] = useState<{ idFront?: string; idBack?: string; signatures?: string }>({});

  // File upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'idFront' | 'idBack' | 'signatures') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFiles(prev => {
        const updated = { ...prev, [field]: ev.target?.result as string };
        // Save to localStorage for persistence
        localStorage.setItem('coMakerFiles', JSON.stringify(updated));
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };

  // Load files from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('coMakerFiles');
      if (stored) setFiles(JSON.parse(stored));
    } catch {}
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      localStorage.setItem('loanApplicationStep2', JSON.stringify(updated));
      return updated;
    });
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.contactNo) newErrors.contactNo = 'Contact number is required';
    // Email is optional, remove if not needed
    // if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.province) newErrors.province = 'Province is required';
    if (!formData.city) newErrors.city = 'City is required';
    if (!formData.barangay) newErrors.barangay = 'Barangay is required';
    if (!formData.street) newErrors.street = 'Street is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const loanData = JSON.parse(localStorage.getItem('loanApplicationData') || '{}');
    const userData = JSON.parse(localStorage.getItem('user') || '{}');

    // Parse term to get interest and installments
    let interest = 3.5;
    let installments = 12;
    const termStr = loanData.term || '';

    if (termStr.includes('Daily')) {
      interest = 2.75;
      installments = 30;
    } else if (termStr.includes('Weekly')) {
      interest = 3.0;
      installments = 12;
    } else if (termStr.includes('Semi-monthly')) {
      interest = 3.5;
      installments = 24;
    } else if (termStr.includes('Monthly')) {
      interest = 4.0;
      installments = 12;
    }

    // Save application to localStorage (or db.json if you want to use it as a mock DB)
    const application = {
      id: 'APP-' + Date.now(),
      username: userData.username,
      amount: loanData.amount,
      term: loanData.term,
      interest: interest,
      installments: installments,
      coMaker: formData,
      coMakerFiles: files,
      status: 'Pending',
      submittedAt: new Date().toISOString(),
    };
    let applications = [];
    try {
      applications = JSON.parse(localStorage.getItem('applications') || '[]');
    } catch {}
    applications.push(application);
    localStorage.setItem('applications', JSON.stringify(applications));
    localStorage.removeItem('loanApplicationData');
    localStorage.removeItem('loanApplicationStep2');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <TopBar title="Co-maker Details" />
      
      <main className="pt-24 px-6 max-w-md mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <span className="font-headline font-extrabold text-2xl tracking-tight text-on-surface">Step 2 <span className="text-primary/60 text-lg font-medium">of 2</span></span>
            <span className="font-body text-xs uppercase tracking-widest text-primary font-bold">Verification</span>
          </div>
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full w-full bg-gradient-to-r from-primary-dim to-primary step-progress-glow"></div>
          </div>
        </div>

        <section className="space-y-6 mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-primary rounded-full"></div>
            <h2 className="font-headline font-bold text-lg text-on-surface">Personal Info</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="First Name" 
              placeholder="John" 
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              error={errors.firstName}
            />
            <Input 
              label="Last Name" 
              placeholder="Doe" 
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              error={errors.lastName}
            />
          </div>
          <Input 
            label="Contact No." 
            placeholder="912 345 6789" 
            icon={<span className="text-primary font-medium">+63</span>} 
            value={formData.contactNo}
            onChange={(e) => handleInputChange('contactNo', e.target.value)}
            error={errors.contactNo}
          />
          <Input 
            label="Email Address" 
            placeholder="john.doe@example.com" 
            type="email" 
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            error={errors.email}
          />
        </section>

        <section className="space-y-6 mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-primary rounded-full"></div>
            <h2 className="font-headline font-bold text-lg text-on-surface">Address</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Province" 
              placeholder="Enter Province" 
              value={formData.province}
              onChange={(e) => handleInputChange('province', e.target.value)}
              error={errors.province}
            />
            <Input 
              label="City" 
              placeholder="Enter City" 
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              error={errors.city}
            />
          </div>
          <Input 
            label="Barangay" 
            placeholder="Brgy. San Jose" 
            value={formData.barangay}
            onChange={(e) => handleInputChange('barangay', e.target.value)}
            error={errors.barangay}
          />
          <Input 
            label="Street" 
            placeholder="House No, Building, Street Name" 
            value={formData.street}
            onChange={(e) => handleInputChange('street', e.target.value)}
            error={errors.street}
          />
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-primary rounded-full"></div>
            <h2 className="font-headline font-bold text-lg text-on-surface">Identification</h2>
          </div>
          
          <div className="space-y-4">
            {/* Valid ID (Front) */}
            <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <BadgeCheck className="text-primary" size={20} />
                <span className="text-sm font-medium">Valid ID (Front)</span>
              </div>
              <div className="flex flex-col items-end">
                <input type="file" accept="image/*" style={{ display: 'none' }} id="idFrontUploadCoMaker" onChange={e => handleFileChange(e, 'idFront')} />
                <label htmlFor="idFrontUploadCoMaker" className="bg-primary text-on-primary-container text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider shadow-lg shadow-primary/20 cursor-pointer mb-1">CHOOSE FILE</label>
                {files.idFront ? (
                  <img src={files.idFront} alt="ID Front Preview" className="w-14 h-10 object-contain rounded border border-green-200" />
                ) : (
                  <span className="text-xs text-outline">No file selected</span>
                )}
              </div>
            </div>
            {/* Valid ID (Back) */}
            <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <CreditCard className="text-primary" size={20} />
                <span className="text-sm font-medium">Valid ID (Back)</span>
              </div>
              <div className="flex flex-col items-end">
                <input type="file" accept="image/*" style={{ display: 'none' }} id="idBackUploadCoMaker" onChange={e => handleFileChange(e, 'idBack')} />
                <label htmlFor="idBackUploadCoMaker" className="bg-primary text-on-primary-container text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider shadow-lg shadow-primary/20 cursor-pointer mb-1">CHOOSE FILE</label>
                {files.idBack ? (
                  <img src={files.idBack} alt="ID Back Preview" className="w-14 h-10 object-contain rounded border border-green-200" />
                ) : (
                  <span className="text-xs text-outline">No file selected</span>
                )}
              </div>
            </div>
            {/* 3 Specimen Signatures */}
            <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <PenTool className="text-primary" size={20} />
                <span className="text-sm font-medium">3 Specimen Signatures</span>
              </div>
              <div className="flex flex-col items-end">
                <input type="file" accept="image/*" style={{ display: 'none' }} id="signaturesUploadCoMaker" onChange={e => handleFileChange(e, 'signatures')} />
                <label htmlFor="signaturesUploadCoMaker" className="bg-primary text-on-primary-container text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider shadow-lg shadow-primary/20 cursor-pointer mb-1">CHOOSE FILE</label>
                {files.signatures ? (
                  <img src={files.signatures} alt="Signatures Preview" className="w-14 h-10 object-contain rounded border border-green-200" />
                ) : (
                  <span className="text-xs text-outline">No file selected</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-12 mb-8 space-y-6">
          <Button onClick={handleSubmit}>
            SUBMIT APPLICATION
          </Button>
          {/* Removed Back to Step 1 button as requested */}
          <div className="flex flex-col items-center gap-1">
            <button onClick={() => navigate('/dashboard')} className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium">
              Back to Dashboard
            </button>
            <div className="w-12 h-1 bg-surface-container-highest rounded-full mt-2"></div>
          </div>
        </footer>
      </main>
    </div>
  );
}
