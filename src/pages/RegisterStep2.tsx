import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { motion } from 'motion/react';


export default function RegisterStep2() {
    // Restore form data on mount
    useEffect(() => {
      try {
        const saved = JSON.parse(localStorage.getItem('registerData') || '{}');
        setFormData(f => ({ ...f, ...saved }));
      } catch {}
    }, []);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    province: '',
    city: '',
    barangay: '',
    street: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.province) newErrors.province = 'Province is required';
    if (!formData.city) newErrors.city = 'City is required';
    if (!formData.barangay) newErrors.barangay = 'Barangay is required';
    if (!formData.street) newErrors.street = 'Street/House No. is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      localStorage.setItem('registerData', JSON.stringify({
        ...JSON.parse(localStorage.getItem('registerData') || '{}'),
        ...formData
      }));
      navigate('/register/step3');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <TopBar title="Registration" />
      
      <main className="pt-24 px-6 max-w-lg mx-auto w-full">
        <div className="mb-10">
          <div className="flex justify-between items-end mb-2">
            <span className="text-on-surface-variant font-body text-xs uppercase tracking-widest">Step 2 of 4</span>
            <span className="text-primary font-headline font-extrabold text-sm">50%</span>
          </div>
          <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-primary rounded-full"></div>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <header>
            <h2 className="font-headline text-[32px] font-extrabold tracking-tight text-on-surface mb-2">Residence Details</h2>
            <p className="text-on-surface-variant text-sm leading-relaxed opacity-80">
              Please provide your current residential address to help us verify your eligibility.
            </p>
          </header>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input 
              label="Province" 
              placeholder="Enter province" 
              name="province"
              value={formData.province}
              onChange={handleChange}
              error={errors.province}
            />
            <Input 
              label="City" 
              placeholder="Enter city" 
              name="city"
              value={formData.city}
              onChange={handleChange}
              error={errors.city}
            />
            <Input 
              label="Barangay" 
              placeholder="Enter barangay" 
              name="barangay"
              value={formData.barangay}
              onChange={handleChange}
              error={errors.barangay}
            />
            <Input 
              label="Street/House No." 
              placeholder="Enter street and house number" 
              name="street"
              value={formData.street}
              onChange={handleChange}
              error={errors.street}
            />

            <div className="pt-6">
              <Button type="submit">
                Next <ArrowRight size={20} />
              </Button>
            </div>
          </form>
        </motion.div>

        <footer className="mt-12 text-center">
          <p className="text-on-surface-variant text-sm">
            Already have an account? 
            <button onClick={() => navigate('/login')} className="text-primary font-bold ml-1 hover:underline">Login</button>
          </p>
        </footer>
      </main>
    </div>
  );
}
