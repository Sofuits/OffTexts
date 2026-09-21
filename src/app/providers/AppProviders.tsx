import type { QueryClient } from '@tanstack/react-query';
import React, { type PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DependencyProvider, type Container } from '@/app/di';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { ConnectivityProvider } from '@/app/providers/ConnectivityProvider';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ErrorBoundary } from '@/presentation/components';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

/**
 * Every provider the app needs, in the one order that works.
 *
 * The nesting is not arbitrary:
 *
 *   ErrorBoundary       outermost, so it still renders when anything below throws
 *   SafeAreaProvider    ScreenContainer reads insets from it
 *   DependencyProvider  everything below resolves services through it
 *   ConnectivityProvider one NetInfo subscription for the whole app
 *   QueryProvider       needs the connectivity service from the container
 *   AuthProvider        needs the auth repository from the container
 *   ThemeProvider       innermost; only the UI cares
 *
 * Collecting them here rather than stacking them in App.tsx is what lets a test
 * render the same tree with a test container in one line.
 */
type Props = PropsWithChildren<{
  /** Injected by tests. Production leaves both undefined. */
  container?: Container;
  queryClient?: QueryClient;
}>;

export function AppProviders({ children, container, queryClient }: Props): React.JSX.Element {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <DependencyProvider container={container}>
          <ConnectivityProvider>
            <QueryProvider client={queryClient}>
              <AuthProvider>
                <ThemeProvider>{children}</ThemeProvider>
              </AuthProvider>
            </QueryProvider>
          </ConnectivityProvider>
        </DependencyProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
