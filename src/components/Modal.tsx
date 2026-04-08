import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-surface-container-low rounded-[2rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
              <h3 className="font-headline font-bold text-xl text-on-surface">{title}</h3>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-on-surface-variant text-sm leading-relaxed space-y-4">
              {children}
            </div>
            <div className="p-6 border-t border-outline-variant/10">
              <button
                onClick={onClose}
                className="w-full h-12 bg-primary text-on-primary font-bold rounded-full hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
