import React from "react";
import ReactDOM from "react-dom/client";
import "@mysten/dapp-kit/dist/index.css";
import "@radix-ui/themes/styles.css";
import "./styles/base.css";
import { getFullnodeUrl } from "@mysten/sui/client";
import {
  SuiClientProvider,
  WalletProvider,
  createNetworkConfig,
} from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@radix-ui/themes";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { CONSTANTS } from "@/constants";
import { App } from "./App";

const queryClient = new QueryClient();

const { networkConfig } = createNetworkConfig({
  localnet: { url: getFullnodeUrl("localnet") },
  devnet: { url: getFullnodeUrl("devnet") },
  testnet: { url: getFullnodeUrl("testnet") },
  mainnet: { url: getFullnodeUrl("mainnet") },
});

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");


ReactDOM.hydrateRoot(
  root,
  <React.StrictMode>
    <HelmetProvider>
      <Theme appearance="dark">
        <QueryClientProvider client={queryClient}>
          <SuiClientProvider
            networks={networkConfig}
            defaultNetwork={CONSTANTS.network}
          >
            <BrowserRouter>
              <WalletProvider autoConnect>
                <App />
              </WalletProvider>
            </BrowserRouter>
          </SuiClientProvider>
        </QueryClientProvider>
      </Theme>
    </HelmetProvider>
  </React.StrictMode>,
);