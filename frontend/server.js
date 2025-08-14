import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

// Load Vite environment variables
const env = loadEnv(isProduction ? 'production' : 'development', process.cwd(), '');

// Also load .env file directly for server-side access
Object.keys(env).forEach(key => {
  process.env[key] = env[key];
});


async function createServer() {
  const app = express();

  let vite;
  if (!isProduction) {
    // Create Vite server in middleware mode for development
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist/client')));
  }

  // Proxy API requests to backend (optional - remove if not needed)
  app.use('/api', (req, res) => {
    const apiUrl = process.env.VITE_API_URL || 'https://www.govex.ai/api/';
    const targetUrl = apiUrl + req.url.slice(1);
    res.redirect(targetUrl);
  });

  app.get('*', async (req, res) => {
    const url = req.originalUrl;

    try {
      let template;
      let render;

      if (!isProduction) {
        // Load and transform HTML template
        template = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        
        // Load the server entry point
        render = (await vite.ssrLoadModule('/src/entry-server.tsx')).render;
      } else {
        // In production, use pre-built files
        template = fs.readFileSync(path.join(__dirname, 'dist/client/index.html'), 'utf-8');
        render = (await import('./dist/server/entry-server.js')).render;
      }

      // Fetch data for OG tags before rendering
      // Default OG data matching SEOMetadata component defaults
      let ogData = {
        title: 'Govex - Futarchy on Sui',
        description: 'Discover and trade on futarchy proposals. Explore DAOs, prediction markets, and governance on Govex, the leading futarchy platform on Sui.',
        keywords: 'futarchy, prediction markets, trade, DAOs, governance, Sui, Govex',
        image: `${req.protocol}://${req.get('host')}/images/og.png`,
        author: 'Govex',
        type: 'website'
      };
      
      // Route-specific OG data
      if (url === '/create') {
        ogData = {
          title: 'Create - Govex',
          description: 'Create new proposals or DAOs on Govex. Launch your own futarchy markets and participate in decentralized governance on Sui.',
          keywords: 'create DAO, create proposal, futarchy, governance, Sui, Govex',
          image: `${req.protocol}://${req.get('host')}/images/og.png`,
          author: 'Govex',
          type: 'website'
        };
      } else if (url === '/learn') {
        ogData = {
          title: 'Learn - Govex',
          description: 'Learn about futarchy, prediction markets, and how Govex empowers decentralized governance on Sui. Educational resources and guides.',
          keywords: 'futarchy education, prediction markets guide, DAO governance, blockchain education, Sui tutorial',
          image: `${req.protocol}://${req.get('host')}/images/og.png`,
          author: 'Govex',
          type: 'website'
        };
      }
      
      // Check if it's a DAO page
      const daoMatch = url.match(/^\/dao\/(.+)$/);
      const proposalMatch = url.match(/^\/trade\/(.+)$/);
      
      if (daoMatch || proposalMatch) {
        try {
          // Use environment variable or fallback to local API
          const apiUrl = process.env.VITE_API_URL || "http://localhost:3000/"
          
          if (daoMatch) {
            const daoId = daoMatch[1];
            const daoUrl = `${apiUrl}og/dao/${daoId}`;
            const response = await fetch(daoUrl, {
              headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
              const dao = await response.json();
              // Build OG image URL with query params
              const ogImageParams = new URLSearchParams({
                name: dao.dao_name,
                description: dao.description || '',
                proposalCount: dao.proposal_count.toString(),
                hasLiveProposal: dao.has_live_proposal.toString(),
                isVerified: dao.verified.toString(),
                logoUrl: dao.icon_url || ''
              });
              
              ogData = {
                title: dao.dao_name !== 'Govex' ? `${dao.dao_name} - Powered by Govex` : dao.dao_name,
                description: dao.dao_name === 'Govex' 
                  ? `Explore ${dao.dao_name}, the original DAO from this futarchy platform on Sui. See active proposals and trade outcomes.`
                  : (dao.description || `Explore ${dao.dao_name}, a futarchy-governed DAO on Sui where prediction markets govern. See active proposals and trade outcomes.`),
                keywords: `${dao.dao_name}, ${dao.asset_symbol || ''}, ${dao.stable_symbol || ''}, futarchy, DAO, Sui, governance, decentralized organization`,
                image: `${apiUrl}og/dao-image?${ogImageParams.toString()}`,
                author: dao.dao_name,
                type: 'website'
              };
            }
          } else if (proposalMatch) {
            const proposalId = proposalMatch[1];
            const response = await fetch(`${apiUrl}og/proposal/${proposalId}`, {
              headers: { 'Accept': 'application/json' }
            });
            if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
              const proposal = await response.json();
              // Build OG image URL with query params for proposal
              const proposalImageParams = new URLSearchParams({
                title: proposal.title,
                daoName: proposal.dao_name,
                daoLogo: proposal.dao?.icon_url || '',
                currentState: proposal.current_state.toString(),
                winningOutcome: proposal.winning_outcome.toString(),
                outcomeMessages: JSON.stringify(proposal.outcome_messages || []),
                traders: proposal.traders.toString(),
                trades: proposal.trades.toString(),
                tradingStartDate: new Date(proposal.created_at).toISOString(),
                tradingPeriodMs: proposal.trading_period_ms?.toString() || '0'
              });
              
              ogData = {
                title: `${proposal.title} - ${proposal.dao_name}`,
                description: proposal.details || `Proposal by ${proposal.dao_name}`,
                keywords: `${proposal.dao_name}, ${proposal.outcome_messages?.slice(0, 2).join(', ')}, ${proposal.title}, futarchy, prediction market, trade, vote, AMM`,
                image: `${apiUrl}og/proposal-image?${proposalImageParams.toString()}`,
                author: proposal.dao_name,
                type: 'article'
              };
            }
          }
        } catch (error) {
          console.error('Error fetching OG data:', error);
        }
      }

      // Skip SSR completely in production to avoid JSX errors
      let html = '';
      let helmet = { title: { toString: () => '' }, meta: { toString: () => '' }, link: { toString: () => '' } };
      
      if (!isProduction) {
        try {
          const helmetContext = {};
          const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
          const rendered = render(url, helmetContext, fullUrl);
          html = rendered.html;
          helmet = helmetContext.helmet || helmet;
        } catch (ssrError) {
          console.error('SSR failed:', ssrError.message);
        }
      }
      
      // Build OG meta tags if we have data
      let ogMetaTags = '';
      if (ogData.title) {
        ogMetaTags = `
          <meta property="og:title" content="${ogData.title}" />
          <meta property="og:description" content="${ogData.description}" />
          <meta property="og:image" content="${ogData.image}" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="${ogData.title}" />
          <meta name="twitter:description" content="${ogData.description}" />
          <meta name="twitter:image" content="${ogData.image}" />
        `;
      }

      // Replace placeholders in template
      const finalHtml = template
        .replace(`<!--app-html-->`, html)
        .replace(`<!--app-head-->`, 
          ogMetaTags + 
          helmet.title.toString() + 
          helmet.meta.toString() + 
          helmet.link.toString()
        );

      res.status(200).set({ 'Content-Type': 'text/html' }).end(finalHtml);
    } catch (e) {
      !isProduction && vite.ssrFixStacktrace(e);
      console.error(e);
      res.status(500).end(e.message);
    }
  });

  const port = process.env.PORT || 5173;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

createServer();