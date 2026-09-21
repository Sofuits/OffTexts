import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type PropsWithChildren,
} from 'react';

import { createContainer, type Container } from './container';

/**
 * Makes the container available to the tree.
 *
 * Hooks read from here; components never build a repository themselves. A test
 * wraps a screen in this provider with a test container and the screen is
 * talking to fakes without knowing anything changed.
 */
const DependencyContext = createContext<Container | null>(null);

type Props = PropsWithChildren<{
  /** Injected in tests. Production leaves it undefined and gets the real graph. */
  container?: Container;
}>;

export function DependencyProvider({ children, container }: Props): React.JSX.Element {
  // Built once. Rebuilding would create a second Supabase client and a second
  // auth subscription, which is a slow leak rather than an obvious crash.
  const resolved = useMemo(() => container ?? createContainer(), [container]);

  useEffect(() => {
    // Only dispose what this provider created; an injected container belongs to
    // whoever passed it in.
    if (container) return;
    return () => resolved.dispose();
  }, [container, resolved]);

  return <DependencyContext.Provider value={resolved}>{children}</DependencyContext.Provider>;
}

export function useContainer(): Container {
  const container = useContext(DependencyContext);
  if (!container) {
    throw new Error('useContainer must be used inside a <DependencyProvider>.');
  }
  return container;
}

/** Shorthands, so a hook does not repeat `useContainer().repositories` everywhere. */
export const useRepositories = (): Container['repositories'] => useContainer().repositories;
export const useUseCases = (): Container['useCases'] => useContainer().useCases;
export const useServices = (): Container['services'] => useContainer().services;
