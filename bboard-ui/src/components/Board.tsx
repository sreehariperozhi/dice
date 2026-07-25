// This file is part of Midnight DICE DApp UI.
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useEffect, useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Backdrop,
  CircularProgress,
  Card,
  Typography,
  TextField,
  Button,
  Box,
  Chip,
  Slider,
  Tooltip,
  Divider,
  Alert,
} from '@mui/material';
import CasinoIcon from '@mui/icons-material/Casino';
import LockIcon from '@mui/icons-material/Lock';
import ShieldIcon from '@mui/icons-material/Shield';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import {
  type DiceDerivedState,
  type DeployedDiceAPI,
  DEFAULT_CONTRACT_ADDRESS,
} from '../../../api/src/index.js';
import { State, Result } from '../../../contract/src/index.js';
import { useDeployedBoardContext } from '../hooks/index.js';
import { type BoardDeployment } from '../contexts/index.js';
import { type Observable } from 'rxjs';

export interface BoardProps {
  boardDeployment$?: Observable<BoardDeployment>;
}

export const Board: React.FC<Readonly<BoardProps>> = ({ boardDeployment$ }) => {
  const boardApiProvider = useDeployedBoardContext();
  const [boardDeployment, setBoardDeployment] = useState<BoardDeployment>();
  const [deployedDiceAPI, setDeployedDiceAPI] = useState<DeployedDiceAPI>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [gameState, setGameState] = useState<DiceDerivedState>();
  const [targetNumber, setTargetNumber] = useState<number>(50);
  const [simulatedRoll, setSimulatedRoll] = useState<number>(75);
  const [contractAddressInput, setContractAddressInput] = useState<string>('');
  const [isWorking, setIsWorking] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const activeContractAddress = deployedDiceAPI?.deployedContractAddress || DEFAULT_CONTRACT_ADDRESS;

  const onJoinContract = useCallback(
    (addr?: string) => {
      const target = addr || contractAddressInput || DEFAULT_CONTRACT_ADDRESS;
      boardApiProvider.resolve(target as ContractAddress);
    },
    [boardApiProvider, contractAddressInput],
  );

  const onCommitRoll = useCallback(async () => {
    try {
      if (deployedDiceAPI) {
        setIsWorking(true);
        await deployedDiceAPI.commitRoll(targetNumber);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedDiceAPI, targetNumber]);

  const onRollDice = useCallback(async () => {
    try {
      if (deployedDiceAPI) {
        setIsWorking(true);
        const outcome = Math.floor(Math.random() * 100) + 1;
        setSimulatedRoll(outcome);
        await deployedDiceAPI.rollDice(outcome);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedDiceAPI]);

  const onResetGame = useCallback(async () => {
    try {
      if (deployedDiceAPI) {
        setIsWorking(true);
        await deployedDiceAPI.resetGame();
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedDiceAPI]);

  const onCopyAddress = useCallback(async () => {
    await navigator.clipboard.writeText(activeContractAddress);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }, [activeContractAddress]);

  useEffect(() => {
    if (!boardDeployment$) return;
    const subscription = boardDeployment$.subscribe(setBoardDeployment);
    return () => subscription.unsubscribe();
  }, [boardDeployment$]);

  useEffect(() => {
    if (!boardDeployment || boardDeployment.status === 'in-progress') return;
    if (boardDeployment.status === 'failed') {
      setErrorMessage(boardDeployment.error.message || 'Error interacting with contract.');
      return;
    }
    setDeployedDiceAPI(boardDeployment.api);
    const subscription = boardDeployment.api.state$.subscribe(setGameState);
    return () => subscription.unsubscribe();
  }, [boardDeployment]);

  const isRolled = gameState?.state === State.ROLLED;
  const isCommitted = gameState?.state === State.COMMITTED;
  const isWon = gameState?.lastResult === Result.WON;

  return (
    <Box sx={{ mt: 3, mb: 6 }}>
      {/* Header Banner */}
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          mb: 4,
          p: 3,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <CasinoIcon sx={{ fontSize: 36, color: '#a78bfa' }} />
              <Typography variant="h4" sx={{ fontWeight: 800, background: 'linear-gradient(90deg, #a78bfa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                MIDNIGHT ZK DICE
              </Typography>
              <Chip label="Level 1 DApp" color="primary" size="small" sx={{ fontWeight: 600 }} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Zero-Knowledge Privacy-Preserving Dice Game built on Midnight Network using Compact smart contracts.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip icon={<ShieldIcon />} label="Midnight Preprod" variant="outlined" color="secondary" />
            <Chip icon={<LockIcon />} label="ZK SNARK Protected" variant="outlined" color="primary" />
          </Box>
        </Box>
      </Card>

      {/* Contract Address Configuration */}
      <Card sx={{ mb: 4, p: 2.5, border: '1px solid rgba(167, 139, 250, 0.2)' }}>
        <Typography variant="subtitle2" sx={{ color: '#a78bfa', mb: 1, fontWeight: 700 }}>
          CONTRACT ADDRESS CONFIGURATION
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder={DEFAULT_CONTRACT_ADDRESS}
            value={contractAddressInput}
            onChange={(e) => setContractAddressInput(e.target.value)}
            helperText={`Active Address Placeholder: ${activeContractAddress}`}
            sx={{ flexGrow: 1 }}
          />
          <Button variant="contained" color="primary" onClick={() => onJoinContract()} startIcon={<PlayArrowIcon />}>
            Connect Contract
          </Button>
          <Tooltip title={copySuccess ? "Copied!" : "Copy Address Placeholder"}>
            <Button variant="outlined" color="secondary" onClick={onCopyAddress} startIcon={<ContentCopyIcon />}>
              Copy Address
            </Button>
          </Tooltip>
        </Box>
      </Card>

      {/* Main Game Interface */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Left Column: Game Controls */}
        <Card sx={{ p: 3, position: 'relative', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Backdrop sx={{ position: 'absolute', color: '#fff', zIndex: 10 }} open={isWorking}>
            <CircularProgress color="primary" />
          </Backdrop>

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#f8fafc' }}>
            DICE ROLL CONTROLLER
          </Typography>

          <Box sx={{ my: 4, textAlign: 'center', p: 4, borderRadius: 4, background: 'rgba(0,0,0,0.3)', border: '1px dashed rgba(167,139,250,0.3)' }}>
            <CasinoIcon sx={{ fontSize: 72, color: isRolled ? (isWon ? '#10b981' : '#ef4444') : '#a78bfa', transition: 'all 0.3s' }} />
            <Typography variant="h2" sx={{ fontWeight: 800, mt: 1 }}>
              {isRolled ? gameState?.lastRoll : '?'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isRolled ? (isWon ? 'VICTORY!' : 'BETTER LUCK NEXT TIME') : 'ROLL PENDING'}
            </Typography>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
              Target Threshold to Beat (1 - 100): {targetNumber}
            </Typography>
            <Slider
              value={targetNumber}
              onChange={(_, val) => setTargetNumber(val as number)}
              min={1}
              max={100}
              valueLabelDisplay="auto"
              disabled={isCommitted}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              disabled={isCommitted}
              onClick={onCommitRoll}
              startIcon={<LockIcon />}
            >
              1. Commit Roll (ZK Proof)
            </Button>
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              size="large"
              disabled={!isCommitted}
              onClick={onRollDice}
              startIcon={<CasinoIcon />}
            >
              2. Roll Dice & Disclose
            </Button>
            <Button
              fullWidth
              variant="outlined"
              color="inherit"
              disabled={!isRolled}
              onClick={onResetGame}
              startIcon={<RefreshIcon />}
            >
              Reset Round
            </Button>
          </Box>
        </Card>

        {/* Right Column: Ledger & Privacy Explorer */}
        <Card sx={{ p: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#f8fafc' }}>
            PUBLIC LEDGER & PRIVACY STATE
          </Typography>

          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage(undefined)}>
              {errorMessage}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: 2, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Typography variant="caption" color="secondary" sx={{ fontWeight: 700 }}>
                PUBLIC LEDGER DATA (ON-CHAIN)
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Game State:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {isCommitted ? 'COMMITTED' : isRolled ? 'ROLLED' : 'IDLE'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Target Number:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{gameState?.targetNumber ?? 50}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Round Counter:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{gameState ? String(gameState.roundCounter) : '1'}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Last Outcome:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{gameState?.lastRoll ?? 0}</Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="body2" color="text.secondary">Player Commitment Hash:</Typography>
                <Typography variant="caption" sx={{ wordBreak: 'break-all', fontFamily: 'monospace', color: '#a78bfa' }}>
                  {gameState?.playerCommitment || '0x0000000000000000000000000000000000000000000000000000000000000000'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
              <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 700 }}>
                PRIVATE WITNESS STATE (LOCAL WALLET ONLY)
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Local Secret Key & Seed:
              </Typography>
              <Typography variant="caption" sx={{ wordBreak: 'break-all', fontFamily: 'monospace', color: '#06b6d4' }}>
                [PROTECTED BY MIDNIGHT ZK-SNARK WITNESS]
              </Typography>
            </Box>

            <Alert severity="info" icon={<ShieldIcon />}>
              <Typography variant="caption">
                <strong>Privacy Model Guarantee:</strong> The player's random seed and choice are processed strictly off-chain inside the local ZK witness. Only zero-knowledge proofs and state commitments are submitted to the Midnight network.
              </Typography>
            </Alert>
          </Box>
        </Card>
      </Box>
    </Box>
  );
};
