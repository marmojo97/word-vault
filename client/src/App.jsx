import { useCallback, useState } from 'react';
import TabBar from './components/TabBar.jsx';
import Toast from './components/Toast.jsx';
import TodayScreen from './screens/TodayScreen.jsx';
import PracticeScreen from './screens/PracticeScreen.jsx';
import VaultScreen from './screens/VaultScreen.jsx';
import AddScreen from './screens/AddScreen.jsx';

const STREAK_KEY = 'wv_streak';

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function bumpStreak() {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}'); }
  catch { stored = {}; }
  const today = todayString();
  if (stored.lastVisit === today) return stored.count || 1;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.toISOString().slice(0, 10);

  const count = stored.lastVisit === y ? (stored.count || 0) + 1 : 1;
  localStorage.setItem(STREAK_KEY, JSON.stringify({ lastVisit: today, count }));
  return count;
}

export default function App() {
  const [tab, setTab] = useState('today');
  const [toast, setToast] = useState(null);
  // Updated only when the day rolls over or on first load — works for our purposes.
  const [streak] = useState(() => bumpStreak());

  const showToast = useCallback((message) => {
    setToast({ message, id: Date.now() });
    setTimeout(() => setToast((t) => (t && t.message === message ? null : t)), 2400);
  }, []);

  return (
    <div className="app">
      <main className="screen-container">
        <div key={tab} className="screen-fade">
          {tab === 'today' && <TodayScreen streak={streak} showToast={showToast} />}
          {tab === 'practice' && <PracticeScreen streak={streak} showToast={showToast} />}
          {tab === 'vault' && <VaultScreen streak={streak} showToast={showToast} />}
          {tab === 'add' && <AddScreen showToast={showToast} />}
        </div>
      </main>
      <TabBar tab={tab} setTab={setTab} />
      {toast && <Toast key={toast.id} message={toast.message} />}
    </div>
  );
}
