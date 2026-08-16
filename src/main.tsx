import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {UiAdaptersProvider} from './adapters/UiAdaptersContext.tsx';
import {productionUiAdapters} from './adapters/uiAdapters.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiAdaptersProvider adapters={productionUiAdapters}>
      <App />
    </UiAdaptersProvider>
  </StrictMode>,
);
