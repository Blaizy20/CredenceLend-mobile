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

  const compressImage = (dataUrl: string, maxWidth = 320, maxHeight = 320, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = function () {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  };

  const capturePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
      });
      if (image && image.dataUrl) {
        // Compress before saving to localStorage
        const compressed = await compressImage(image.dataUrl);
        setPhoto(compressed);
        let regData = {};
        try {
          regData = JSON.parse(localStorage.getItem('registerData') || '{}');
        } catch {}
        regData.facePhoto = compressed;
        localStorage.setItem('registerData', JSON.stringify(regData));
        setCaptured(true);
        setError('');

        // Auto-navigate to step 4 after a short delay once captured
        setTimeout(() => {
          navigate('/register/step4');
        }, 800);
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
        {/* Progress */}
        <div className="w-full mb-10">
          <div className="flex justify-between items-end mb-2">
            <span className="text-on-surface-variant font-body text-xs uppercase tracking-widest">Step 3 of 4</span>
            <span className="text-primary font-headline font-extrabold text-sm">75%</span>
          </div>
          <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full w-3/4 bg-primary rounded-full"></div>
          </div>
        </div>

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
