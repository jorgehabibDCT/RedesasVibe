import { Route, Routes } from 'react-router-dom';
import { BitacoraPage } from './features/bitacora/BitacoraPage.js';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BitacoraPage />} />
    </Routes>
  );
}
