import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@radix-ui/themes";
import { getFullnodeUrl } from "@mysten/sui/client";
import {
  SuiClientProvider,
  createNetworkConfig,
} from "@mysten/dapp-kit";
import { CONSTANTS } from "@/constants";
import { App } from './App';

export function render(url: string, helmetContext: any = {}, fullUrl?: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: false,
      },
    },
  });

  const { networkConfig } = createNetworkConfig({
    localnet: { url: getFullnodeUrl("localnet") },
    devnet: { url: getFullnodeUrl("devnet") },
    testnet: { url: getFullnodeUrl("testnet") },
    mainnet: { url: getFullnodeUrl("mainnet") },
  });

  const html = renderToString(
    <React.StrictMode>
      <HelmetProvider context={helmetContext}>
        <Theme appearance="dark">
          <QueryClientProvider client={queryClient}>
            <SuiClientProvider
              networks={networkConfig}
              defaultNetwork={CONSTANTS.network}
            >
              <StaticRouter location={url}>
                <App />
              </StaticRouter>
            </SuiClientProvider>
          </QueryClientProvider>
        </Theme>
      </HelmetProvider>
    </React.StrictMode>
  );

  return { html, helmet: helmetContext.helmet };
}