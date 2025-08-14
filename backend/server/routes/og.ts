import { Router, Request, Response } from 'express';
import { prisma } from '../../db';
import { Resvg } from '@resvg/resvg-js';
import { fetchAndEncodeImage, generateDaoSvg, generateProposalOG, generateGeneralOG } from '../../utils/dynamic-image';

const router = Router();

// New route that accepts DAO data as query params
router.get('/dao-image', async (req: Request, res: Response) => {
  try {
    const { name, description, proposalCount, hasLiveProposal, isVerified, logoUrl } = req.query;
    
    const daoImage = logoUrl && typeof logoUrl === 'string' ? await fetchAndEncodeImage(logoUrl) : null;
    
    const svg = generateDaoSvg({
      name: name as string,
      description: description as string || '',
      logo: daoImage || "placeholder",
      proposalCount: Number(proposalCount) || 0,
      hasLiveProposal: hasLiveProposal === 'true',
      isVerified: isVerified === 'true'
    });
    
    const resvg = new Resvg(svg);
    const png = resvg.render().asPng();
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.send(png);
  } catch (error) {
    console.error('Error generating DAO OG image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Original route that fetches data from database
router.get('/dao/:daoId', async (req: Request<{ daoId: string }>, res: Response) => {
  try {
    const { daoId } = req.params;
    const returnJson = req.query.format === 'json' || req.headers.accept?.includes('application/json');

    const dao = await prisma.dao.findUnique({
      where: { dao_id: daoId },
      select: {
        dao_id: true,
        dao_name: true,
        description: true,
        icon_url: true,
        verification: {
          select: { verified: true }
        },
        proposals: {
          select: {
            id: true,
            current_state: true
          }
        }
      }
    });

    if (!dao)
      res.status(404).json({ error: 'DAO not found' })
    else {
      // If JSON is requested, return DAO data
      if (returnJson) {
        res.json({
          dao_id: dao.dao_id,
          dao_name: dao.dao_name,
          description: dao.description,
          icon_url: dao.icon_url,
          verified: dao.verification?.verified ?? false,
          proposal_count: dao.proposals.length,
          has_live_proposal: dao.proposals.some(proposal => (proposal.current_state || 0) === 0)
        });
        return;
      }

      const daoImage = dao.icon_url ? await fetchAndEncodeImage(dao.icon_url) : null;

      const svg = generateDaoSvg({
        name: dao.dao_name,
        description: dao.description,
        logo: daoImage || "placeholder",
        proposalCount: dao.proposals.length,
        hasLiveProposal: dao.proposals.some(proposal => (proposal.current_state || 0) === 0),
        isVerified: dao.verification?.verified ?? false
      });

      // Otherwise, render and return the PNG image
      const resvg = new Resvg(svg);
      const png = resvg.render().asPng();

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=900'); // Cache for 15 minutes
      res.send(png);
    }

  } catch (error) {
    console.error('Error generating DAO OG image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New route that accepts proposal data as query params
router.get('/proposal-image', async (req: Request, res: Response) => {
  try {
    const { 
      title, daoName, daoLogo, currentState, 
      winningOutcome, outcomeMessages, traders, trades,
      tradingStartDate, tradingPeriodMs 
    } = req.query;
    
    const svg = await generateProposalOG({
      title: title as string,
      daoName: daoName as string,
      daoLogo: daoLogo as string || "placeholder",
      currentState: Number(currentState) || 0,
      winningOutcome: Number(winningOutcome) || 0,
      outcomeMessages: outcomeMessages ? JSON.parse(outcomeMessages as string) : undefined,
      traders: Number(traders) || 0,
      trades: Number(trades) || 0,
      tradingStartDate: new Date(tradingStartDate as string),
      tradingPeriodMs: Number(tradingPeriodMs) || 0
    });
    
    const resvg = new Resvg(svg);
    const png = resvg.render().asPng();
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.send(png);
  } catch (error) {
    console.error('Error generating proposal OG image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/proposal/:propId', async (req: Request<{ propId: string }>, res: Response) => {
  try {
    const { propId } = req.params;
    const returnJson = req.query.format === 'json' || req.headers.accept?.includes('application/json');

    const proposal = await prisma.proposal.findUnique({
      where: { proposal_id: propId },
      select: {
        proposal_id: true,
        title: true,
        details: true,
        created_at: true,
        current_state: true,
        outcome_messages: true,
        trading_period_ms: true,
        review_period_ms: true,
        result: {
          select: { winning_outcome: true }
        },
        dao: {
          select: {
            dao_name: true,
            icon_url: true
          }
        }
      }
    });

    if (!proposal)
      res.status(404).json({ error: 'Proposal not found' })
    else {
      const [swapCount, uniqueTraders] = await Promise.all([
        prisma.swapEvent.count({
          where: { market_id: proposal.proposal_id }
        }),
        prisma.swapEvent.groupBy({
          by: ['sender'],
          where: { market_id: proposal.proposal_id },
          _count: { sender: true }
        })
      ]);

      const svg = await generateProposalOG({
        title: proposal.title,
        daoName: proposal.dao?.dao_name || "DAO",
        daoLogo: proposal.dao?.icon_url || "placeholder",
        currentState: proposal.current_state || 0,
        winningOutcome: Number(proposal.result?.winning_outcome) || 0,
        outcomeMessages: proposal.outcome_messages ? JSON.parse(proposal.outcome_messages) : undefined,
        traders: uniqueTraders.length,
        trades: swapCount,
        tradingStartDate: new Date(Number(proposal.created_at) + Number(proposal.review_period_ms)),
        tradingPeriodMs: Number(proposal.trading_period_ms)
      });
      console.log(svg);

      // If JSON is requested, return proposal data
      if (returnJson) {
        res.json({
          id: proposal.proposal_id,
          title: proposal.title,
          details: proposal.details,
          dao_name: proposal.dao?.dao_name || "DAO",
          current_state: proposal.current_state || 0,
          winning_outcome: Number(proposal.result?.winning_outcome) || 0,
          outcome_messages: proposal.outcome_messages ? JSON.parse(proposal.outcome_messages) : [],
          traders: uniqueTraders.length,
          trades: swapCount
        });
        return;
      }

      // Otherwise, render and return the PNG image
      const resvg = new Resvg(svg);
      const png = resvg.render().asPng();

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=900'); // Cache for 15 minutes
      res.send(png);
    }

  } catch (error) {
    console.error('Error generating proposal OG image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/general', async (req: Request, res: Response) => {
  try {
    const svg = await generateGeneralOG();
    const resvg = new Resvg(svg);
    const png = resvg.render().asPng();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 7 days since it's static
    res.send(png);

  } catch (error) {
    console.error('Error generating general OG image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;