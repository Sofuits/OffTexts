import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@admin/App';
import { installTheme } from '@admin/lib/theme';
import '@admin/styles.css';

// Before the first render, so nothing paints with unresolved custom properties.
installTheme();

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing #root.');

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
