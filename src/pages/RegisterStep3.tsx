import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/Button';
import { Camera, CameraResultType } from '@capacitor/camera';

export default function RegisterStep3() {
  const navigate = useNavigate();
  const [captured, setCaptured] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  // Restore photo from localStorage on mount
  useEffect(() => {
    try {
      const regData = JSON.parse(localStorage.getItem('registerData') || '{}');
      if (regData.facePhoto) {
        setPhoto(regData.facePhoto);
        setCaptured(true);
      }
    } catch {}
  }, []);

  const capturePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
      });
      if (image && image.dataUrl) {
        setPhoto(image.dataUrl);
        let regData = {};
        try {
          regData = JSON.parse(localStorage.getItem('registerData') || '{}');
        } catch {}
        regData.facePhoto = image.dataUrl;
        localStorage.setItem('registerData', JSON.stringify(regData));
        setCaptured(true);
        setError('');
      } else {
        setError('No photo captured. Please try again.');
        setCaptured(false);
      }
    } catch (err) {
      setError('Camera access denied or cancelled.');
      setCaptured(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar title="Face Verification" />
      <main className="flex-1 flex flex-col pt-20 pb-12 px-6 items-center max-w-lg mx-auto w-full">
        <h2 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight mb-3">Face Verification</h2>
        <p className="text-on-surface-variant text-sm leading-relaxed mb-4">
          Tap the button below to open your camera and capture your face.
        </p>
        {error && !photo && <div className="p-4 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold text-center mb-4">{error}</div>}
        {photo && <img src={photo} alt="Face" className="rounded-2xl w-72 h-72 object-cover border-2 border-primary/30 mb-4" />}
        <Button className="mb-2" onClick={capturePhoto} disabled={!!photo}>
          {photo ? 'Photo Captured' : 'Capture Photo'}
        </Button>
        <Button onClick={() => navigate('/register/step4')} disabled={!photo}>
          Next
        </Button>
      </main>
    </div>
  );
}
