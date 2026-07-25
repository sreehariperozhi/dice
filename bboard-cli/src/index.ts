// This file is part of Midnight DICE DApp CLI.
// SPDX-License-Identifier: Apache-2.0

import { createInterface, type Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { WebSocket } from 'ws';
import {
  DiceAPI,
  type DiceDerivedState,
  dicePrivateStateKey,
  type DiceProviders,
  type DeployedDiceContract,
  type PrivateStateId,
  DEFAULT_CONTRACT_ADDRESS,
} from '../../api/src/index.js';
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ledger, type Ledger, State, Result } from '../../contract/src/managed/dice/contract/index.js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { type Logger } from 'pino';
import { type Config, StandaloneConfig } from './config.js';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { assertIsContractAddress, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { TestEnvironment } from '@midnight-ntwrk/testkit-js';
import { MidnightWalletProvider } from './midnight-wallet-provider.js';
import { randomBytes } from '../../api/src/utils/index.js';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { syncWallet, waitForUnshieldedFunds } from './wallet-utils.js';
import { generateDust } from './generate-dust.js';
import { DicePrivateState } from '../../contract/src/witnesses.js';

// @ts-expect-error: It's needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

export const getDiceLedgerState = async (
  providers: DiceProviders,
  contractAddress: ContractAddress,
): Promise<Ledger | null> => {
  assertIsContractAddress(contractAddress);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  return contractState != null ? ledger(contractState.data) : null;
};

const DEPLOY_OR_JOIN_QUESTION = `
Midnight ZK DICE DApp CLI:
  1. Deploy a new Dice contract
  2. Join an existing Dice contract (Default placeholder: <YOUR_DEPLOYED_CONTRACT_ADDRESS>)
  3. Exit
Which would you like to do? `;

const deployOrJoin = async (providers: DiceProviders, rli: Interface, logger: Logger): Promise<DiceAPI | null> => {
  let api: DiceAPI | null = null;

  while (true) {
    const choice = await rli.question(DEPLOY_OR_JOIN_QUESTION);
    switch (choice) {
      case '1':
        api = await DiceAPI.deploy(providers, logger);
        logger.info(`Deployed contract at address: ${api.deployedContractAddress}`);
        return api;
      case '2': {
        const address = await rli.question('Enter contract address (or press enter for default placeholder): ');
        const targetAddress = address.trim() || DEFAULT_CONTRACT_ADDRESS;
        api = await DiceAPI.join(providers, targetAddress, logger);
        logger.info(`Joined contract at address: ${api.deployedContractAddress}`);
        return api;
      }
      case '3':
        logger.info('Exiting...');
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const displayLedgerState = async (
  providers: DiceProviders,
  deployedDiceContract: DeployedDiceContract,
  logger: Logger,
): Promise<void> => {
  const contractAddress = deployedDiceContract.deployTxData.public.contractAddress;
  const ledgerState = await getDiceLedgerState(providers, contractAddress);
  if (ledgerState === null) {
    logger.info(`There is no contract deployed at ${contractAddress}`);
  } else {
    const gameState = ledgerState.state === State.COMMITTED ? 'COMMITTED' : ledgerState.state === State.ROLLED ? 'ROLLED' : 'IDLE';
    const resultStr = ledgerState.lastResult === Result.WON ? 'WON' : ledgerState.lastResult === Result.LOST ? 'LOST' : 'PENDING';
    logger.info(`Current Game State: '${gameState}'`);
    logger.info(`Target Number: '${ledgerState.targetNumber}'`);
    logger.info(`Last Roll Outcome: '${ledgerState.lastRoll}'`);
    logger.info(`Last Game Result: '${resultStr}'`);
    logger.info(`Round Counter: ${ledgerState.roundCounter}`);
    logger.info(`Player Public Key: '${toHex(ledgerState.owner)}'`);
  }
};

const displayPrivateState = async (providers: DiceProviders, logger: Logger): Promise<void> => {
  const privateState = await providers.privateStateProvider.get(dicePrivateStateKey);
  if (privateState === null) {
    logger.info(`There is no existing private state`);
  } else {
    logger.info(`Current local secret key is: ${toHex(privateState.secretKey)}`);
  }
};

const displayDerivedState = (state: DiceDerivedState | undefined, logger: Logger) => {
  if (state === undefined) {
    logger.info(`No game state currently available`);
  } else {
    const stateStr = state.state === State.COMMITTED ? 'COMMITTED' : state.state === State.ROLLED ? 'ROLLED' : 'IDLE';
    const resultStr = state.lastResult === Result.WON ? 'WON' : state.lastResult === Result.LOST ? 'LOST' : 'PENDING';
    logger.info(`Game State: '${stateStr}'`);
    logger.info(`Target Threshold: ${state.targetNumber}`);
    logger.info(`Commitment Hash: ${state.playerCommitment}`);
    logger.info(`Last Roll: ${state.lastRoll}`);
    logger.info(`Result: ${resultStr}`);
    logger.info(`Round: ${state.roundCounter}`);
    logger.info(`Is Current Owner: '${state.isOwner ? 'YES' : 'NO'}'`);
  }
};

const MAIN_LOOP_QUESTION = `
Available Actions:
  1. Commit Roll (Set Target Number)
  2. Roll Dice (Provide Outcome)
  3. Reset Game (New Round)
  4. Display Public Ledger State
  5. Display Private Witness State
  6. Display Derived Game State
  7. Exit
Select option: `;

const mainLoop = async (providers: DiceProviders, rli: Interface, logger: Logger): Promise<void> => {
  const diceApi = await deployOrJoin(providers, rli, logger);
  if (diceApi === null) {
    return;
  }
  let currentState: DiceDerivedState | undefined;
  const stateObserver = {
    next: (state: DiceDerivedState) => (currentState = state),
  };
  const subscription = diceApi.state$.subscribe(stateObserver);
  try {
    while (true) {
      const choice = await rli.question(MAIN_LOOP_QUESTION);
      try {
        switch (choice) {
          case '1': {
            const targetInput = await rli.question('Enter target number to beat (1-100, e.g. 50): ');
            const target = parseInt(targetInput, 10) || 50;
            await diceApi.commitRoll(target);
            logger.info('Roll committed successfully!');
            break;
          }
          case '2': {
            const outcomeInput = await rli.question('Enter dice outcome (1-100, e.g. 75): ');
            const outcome = parseInt(outcomeInput, 10) || 75;
            await diceApi.rollDice(outcome);
            logger.info('Dice rolled successfully!');
            break;
          }
          case '3':
            await diceApi.resetGame();
            logger.info('Game reset successfully!');
            break;
          case '4':
            await displayLedgerState(providers, diceApi.deployedContract, logger);
            break;
          case '5':
            await displayPrivateState(providers, logger);
            break;
          case '6':
            displayDerivedState(currentState, logger);
            break;
          case '7':
            logger.info('Exiting...');
            return;
          default:
            logger.error(`Invalid choice: ${choice}`);
        }
      } catch (e) {
        logError(logger, e);
        logger.info('Returning to main menu...');
      }
    }
  } finally {
    subscription.unsubscribe();
  }
};

const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const WALLET_LOOP_QUESTION = `
Wallet Setup:
  1. Build a fresh wallet
  2. Build wallet from a seed
  3. Exit
Select option: `;

const buildWallet = async (config: Config, rli: Interface, logger: Logger): Promise<string | undefined> => {
  if (config instanceof StandaloneConfig) {
    return GENESIS_MINT_WALLET_SEED;
  }
  while (true) {
    const choice = await rli.question(WALLET_LOOP_QUESTION);
    switch (choice) {
      case '1':
        return toHex(randomBytes(32));
      case '2':
        return await rli.question('Enter your wallet seed: ');
      case '3':
        logger.info('Exiting...');
        return undefined;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

export const run = async (config: Config, testEnv: TestEnvironment, logger: Logger): Promise<void> => {
  const rli = createInterface({ input, output, terminal: true });
  const providersToBeStopped: MidnightWalletProvider[] = [];
  try {
    const envConfiguration = await testEnv.start();
    logger.info(`Environment started with configuration: ${JSON.stringify(envConfiguration)}`);
    const seed = await buildWallet(config, rli, logger);
    if (seed === undefined) {
      return;
    }
    const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
    providersToBeStopped.push(walletProvider);
    const walletFacade: WalletFacade = walletProvider.wallet;

    await walletProvider.start();

    const unshieldedState = await waitForUnshieldedFunds(logger, walletFacade, envConfiguration, unshieldedToken());
    const nightBalance = unshieldedState.balances[unshieldedToken().raw];
    if (nightBalance === undefined) {
      logger.info('No funds received, exiting...');
      return;
    }
    logger.info(`Your NIGHT wallet balance is: ${nightBalance}`);

    if (config.generateDust) {
      const dustGeneration = await generateDust(logger, seed, unshieldedState, walletFacade);
      if (dustGeneration) {
        logger.info(`Submitted dust generation transaction: ${dustGeneration}`);
        await syncWallet(logger, walletFacade);
      }
    }

    const zkConfigProvider = new NodeZkConfigProvider<'commitRoll' | 'rollDice' | 'resetGame'>(config.zkConfigPath);
    const providers: DiceProviders = {
      privateStateProvider: levelPrivateStateProvider<PrivateStateId, DicePrivateState>({
        privateStateStoreName: config.privateStateStoreName,
        signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
        privateStoragePasswordProvider: () => {
          return 'Dice-Test-2026!';
        },
        accountId: seed,
      }),
      publicDataProvider: indexerPublicDataProvider(envConfiguration.indexer, envConfiguration.indexerWS),
      zkConfigProvider: zkConfigProvider,
      proofProvider: httpClientProofProvider(envConfiguration.proofServer, zkConfigProvider),
      walletProvider: walletProvider,
      midnightProvider: walletProvider,
    };
    await mainLoop(providers, rli, logger);
  } catch (e) {
    logError(logger, e);
    logger.info('Exiting...');
  } finally {
    try {
      rli.close();
      rli.removeAllListeners();
    } catch (e) {
      logError(logger, e);
    } finally {
      try {
        for (const wallet of providersToBeStopped) {
          logger.info('Stopping wallet...');
          await wallet.stop();
        }
        if (testEnv) {
          logger.info('Stopping test environment...');
          await testEnv.shutdown();
        }
      } catch (e) {
        logError(logger, e);
      }
    }
  }
};

function logError(logger: Logger, e: unknown) {
  if (e instanceof Error) {
    logger.error(`Found error '${e.message}'`);
    logger.debug(`${e.stack}`);
  } else {
    logger.error(`Found error (unknown type)`);
  }
}
