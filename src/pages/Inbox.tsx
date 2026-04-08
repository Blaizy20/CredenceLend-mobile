import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { Inbox as InboxIcon } from 'lucide-react';

export default function Inbox() {
  return (
    <div className="min-h-screen bg-background pb-32">
      <TopBar title="Inbox" showBack={false} />
      <main className="pt-24 px-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
          <InboxIcon className="text-outline/40" size={40} />
        </div>
        <h2 className="text-xl font-headline font-bold text-on-surface">No messages</h2>
        <p className="text-on-surface-variant text-sm mt-2">Your notifications and messages will appear here.</p>
      </main>
      <BottomNav />
    </div>
  );
}
