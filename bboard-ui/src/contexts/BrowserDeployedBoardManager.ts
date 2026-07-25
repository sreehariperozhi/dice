// This file is part of Midnight DICE DApp UI.
// SPDX-License-Identifier: Apache-2.0

import {
  DiceAPI,
  type DiceCircuitKeys,
  type DiceProviders,
  type DeployedDiceAPI,
  DEFAULT_CONTRACT_ADDRESS,
} from '../../../api/src/index.js';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  BehaviorSubject,
  type Observable,
} from 'rxjs';
import { type Logger } from 'pino';
import { ConnectedAPI, type InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import semver from 'semver';
import {
  Binding,
  FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
  TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { DicePrivateState } from '../../../contract/src/witnesses.js';
import { inMemoryPrivateStateProvider } from '../in-memory-private-state-provider.js';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';

export interface InProgressBoardDeployment {
  readonly status: 'in-progress';
}

export interface DeployedBoardDeployment {
  readonly status: 'deployed';
  readonly api: DeployedDiceAPI;
}

export interface FailedBoardDeployment {
  readonly status: 'failed';
  readonly error: Error;
}

export type BoardDeployment = InProgressBoardDeployment | DeployedBoardDeployment | FailedBoardDeployment;

export interface DeployedBoardAPIProvider {
  readonly boardDeployments$: Observable<Array<Observable<BoardDeployment>>>;
  readonly resolve: (contractAddress?: ContractAddress) => Observable<BoardDeployment>;
}

export class BrowserDeployedBoardManager implements DeployedBoardAPIProvider {
  readonly #boardDeploymentsSubject: BehaviorSubject<Array<BehaviorSubject<BoardDeployment>>>;
  #initializedProviders: Promise<DiceProviders> | undefined;

  constructor(private readonly logger: Logger) {
    this.#boardDeploymentsSubject = new BehaviorSubject<Array<BehaviorSubject<BoardDeployment>>>([]);
    this.boardDeployments$ = this.#boardDeploymentsSubject;
  }

  readonly boardDeployments$: Observable<Array<Observable<BoardDeployment>>>;

  resolve(contractAddress?: ContractAddress): Observable<BoardDeployment> {
    const targetAddr = contractAddress || DEFAULT_CONTRACT_ADDRESS;
    const deployments = this.#boardDeploymentsSubject.value;
    let deployment = deployments.find(
      (deployment) =>
        deployment.value.status === 'deployed' && deployment.value.api.deployedContractAddress === targetAddr,
    );

    if (deployment) {
      return deployment;
    }

    deployment = new BehaviorSubject<BoardDeployment>({
      status: 'in-progress',
    });

    void this.joinDeployment(deployment, targetAddr);

    this.#boardDeploymentsSubject.next([...deployments, deployment]);

    return deployment;
  }

  private getProviders(): Promise<DiceProviders> {
    return this.#initializedProviders ?? (this.#initializedProviders = initializeProviders(this.logger));
  }

  private async deployDeployment(deployment: BehaviorSubject<BoardDeployment>): Promise<void> {
    try {
      const providers = await this.getProviders();
      const api = await DiceAPI.deploy(providers, this.logger);

      deployment.next({
        status: 'deployed',
        api,
      });
    } catch (error: unknown) {
      deployment.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  private async joinDeployment(
    deployment: BehaviorSubject<BoardDeployment>,
    contractAddress: ContractAddress,
  ): Promise<void> {
    try {
      const providers = await this.getProviders();
      const api = await DiceAPI.join(providers, contractAddress, this.logger);

      deployment.next({
        status: 'deployed',
        api,
      });
    } catch (error: unknown) {
      deployment.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}

const initializeProviders = async (logger: Logger): Promise<DiceProviders> => {
  const networkId = (import.meta.env.VITE_NETWORK_ID as NetworkId) || 'preprod';
  const connectedAPI = await connectToWallet(logger, networkId);
  const zkConfigPath = window.location.origin;
  const keyMaterialProvider = new FetchZkConfigProvider<DiceCircuitKeys>(zkConfigPath, fetch.bind(window));
  const config = await connectedAPI.getConfiguration();
  const inMemoryDicePrivateStateProvider = inMemoryPrivateStateProvider<string, DicePrivateState>();
  const shieldedAddresses = await connectedAPI.getShieldedAddresses();
  return {
    privateStateProvider: inMemoryDicePrivateStateProvider,
    zkConfigProvider: keyMaterialProvider,
    proofProvider: httpClientProofProvider(config.proverServerUri || 'http://127.0.0.1:6300', keyMaterialProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey(): string {
        return shieldedAddresses.shieldedCoinPublicKey;
      },
      getEncryptionPublicKey(): string {
        return shieldedAddresses.shieldedEncryptionPublicKey;
      },
      balanceTx: async (tx: UnboundTransaction, ttl?: Date): Promise<FinalizedTransaction> => {
        try {
          logger.info({ tx, ttl }, 'Balancing transaction via wallet');
          const serializedTx = Array.from(tx.serialize());
          const received = await connectedAPI.balanceUnsealedTransaction(serializedTx.map(b => b.toString(16).padStart(2, '0')).join(''));
          return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
            'signature',
            'proof',
            'binding',
            new Uint8Array(Buffer.from(received.tx, 'hex')),
          );
        } catch (e) {
          logger.error({ error: e }, 'Error balancing transaction via wallet');
          throw e;
        }
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        const serialized = Array.from(tx.serialize()).map(b => b.toString(16).padStart(2, '0')).join('');
        await connectedAPI.submitTransaction(serialized);
        const txIdentifiers = tx.identifiers();
        const txId = txIdentifiers[0];
        logger.info({ txIdentifiers }, 'Submitted transaction via wallet');
        return txId;
      },
    },
  };
};

const getFirstCompatibleWallet = (): InitialAPI | undefined => {
  if (!window.midnight) return undefined;
  return Object.values(window.midnight).find(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === 'object' &&
      'apiVersion' in wallet &&
      semver.satisfies(wallet.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION),
  );
};

const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

const connectToWallet = (logger: Logger, networkId: string): Promise<ConnectedAPI> => {
  if (!window.midnight) {
    return Promise.resolve({
      getConfiguration: async () => ({
        indexerUri: 'https://indexer.preprod.midnight.network/api/v4/graphql',
        indexerWsUri: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
        proverServerUri: 'http://127.0.0.1:6300',
      }),
      getShieldedAddresses: async () => ({
        shieldedCoinPublicKey: '00'.repeat(32),
        shieldedEncryptionPublicKey: '00'.repeat(32),
      }),
      balanceUnsealedTransaction: async () => ({ tx: '' }),
      submitTransaction: async () => '',
    } as any);
  }
  return Promise.resolve(getFirstCompatibleWallet() as any);
};
