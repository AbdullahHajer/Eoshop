import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {UiAdaptersProvider} from './adapters/UiAdaptersContext.tsx';
import {productionUiAdapters} from './adapters/uiAdapters.ts';
import {PlatformSettingsProvider} from './adapters/PlatformSettingsContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiAdaptersProvider adapters={productionUiAdapters}>
      <PlatformSettingsProvider>
        <App />
      </PlatformSettingsProvider>
    </UiAdaptersProvider>
  </StrictMode>,
);
