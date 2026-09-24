import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import TrackSheet from './pages/TrackSheet';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import CompanySheet from './pages/CompanySheet';
import Planner from './pages/Planner';
import AuthPage from './pages/AuthPage';
import AdminPanel from './pages/AdminPanel';
import { useThemeEffect } from './hooks/useTheme';
import { initSync } from './state/sync';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  useThemeEffect();
  useEffect(() => initSync(), []);

  return (
    <ErrorBoundary fallbackTitle="Pace encountered an unexpected error">
      <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/track/:trackId" element={<TrackSheet />} />
          <Route path="/companies" element={<CompanySheet />} />
          <Route path="/company/:companyId" element={<CompanySheet />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/login" element={<AuthPage initialMode="login" />} />
          <Route path="/signup" element={<AuthPage initialMode="signup" />} />
        </Route>
      </Routes>
    </HashRouter>
    </ErrorBoundary>
  );
}
