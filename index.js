import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import React from 'react';

import App from './App';
import { ErrorBoundary } from './src/components/ErrorBoundary';

function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

registerRootComponent(Root);
