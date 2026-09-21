import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import TrackSheet from './pages/TrackSheet';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import { useThemeEffect } from './hooks/useTheme';
import { initSync } from './state/sync';

export default function App() {
  useThemeEffect();
  useEffect(() => initSync(), []);

  return (
    /*
      THESIS: progress is shown as a filling lane/track (the Pace metaphor),
      not another dashboard of rings and stat cards.
      OWN-WORLD: near-black charcoal / warm paper, one orange accent, hairline
      dividers instead of card grids, Space Grotesk display + Inter body +
      mono only for real numeric data.
      STORY: a learner sees exactly where they stand across all 4 tracks,
      picks one up, and works topic by topic with real links/videos/notes.
      FORM: Operate-mode restrained-color dashboard; sidebar "lanes" replace
      the reference sites' card-grid track pickers.
      FINISH: unreviewed and undocumented is unfinished; this build ends with
      the finish review, the verdict, and DESIGN.md.
    */
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/track/:trackId" element={<TrackSheet />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
