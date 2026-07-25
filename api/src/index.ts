// This file is part of Midnight DICE DApp.
// SPDX-License-Identifier: Apache-2.0

import * as Dice from '../../contract/src/managed/dice/contract/index.js';

import { type ContractAddress, convertFieldToBytes } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
export type { ContractAddress };
import { type Logger } from 'pino';
import {
  type DiceDerivedState,
  type DiceContract,
  type DiceProviders,
  type DeployedDiceContract,
  dicePrivateStateKey,
} from './common-types.js';
import { CompiledDiceContractContract } from '../../contract/src/index.js';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { DicePrivateState, createDicePrivateState } from '../../contract/src/witnesses.js';

export const DEFAULT_CONTRACT_ADDRESS: ContractAddress = "<YOUR_DEPLOYED_CONTRACT_ADDRESS>";

export interface DeployedDiceAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<DiceDerivedState>;

  commitRoll: (target: number) => Promise<void>;
  rollDice: (outcome: number) => Promise<void>;
  resetGame: () => Promise<void>;
}

export class DiceAPI implements DeployedDiceAPI {
  private constructor(
    public readonly deployedContract: DeployedDiceContract,
    providers: DiceProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);
    this.state$ = combineLatest(
      [
        providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
          map((contractState) => Dice.ledger(contractState.data)),
          tap((ledgerState) =>
            logger?.trace({
              ledgerStateChanged: {
                ledgerState: {
                  ...ledgerState,
                  owner: toHex(ledgerState.owner),
                },
              },
            }),
          ),
        ),
        from(providers.privateStateProvider.get(dicePrivateStateKey) as Promise<DicePrivateState>),
      ],
      (ledgerState, privateState) => {
        const hashedSecretKey = Dice.pureCircuits.publicKey(
          privateState ? privateState.secretKey : new Uint8Array(32),
          convertFieldToBytes(32, ledgerState.roundCounter, 'api/src/index.ts'),
        );

        return {
          state: ledgerState.state,
          targetNumber: Number(ledgerState.targetNumber),
          playerCommitment: toHex(ledgerState.playerCommitment),
          lastRoll: Number(ledgerState.lastRoll),
          lastResult: ledgerState.lastResult,
          roundCounter: ledgerState.roundCounter,
          isOwner: toHex(ledgerState.owner) === toHex(hashedSecretKey),
        };
      },
    );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<DiceDerivedState>;

  async commitRoll(target: number): Promise<void> {
    this.logger?.info(`commitRoll with target: ${target}`);
    const txData = await this.deployedContract.callTx.commitRoll(BigInt(target));
    this.logger?.trace({
      transactionAdded: {
        circuit: 'commitRoll',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  async rollDice(outcome: number): Promise<void> {
    this.logger?.info(`rollDice with outcome: ${outcome}`);
    const txData = await this.deployedContract.callTx.rollDice(BigInt(outcome));
    this.logger?.trace({
      transactionAdded: {
        circuit: 'rollDice',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  async resetGame(): Promise<void> {
    this.logger?.info('resetGame');
    const txData = await this.deployedContract.callTx.resetGame();
    this.logger?.trace({
      transactionAdded: {
        circuit: 'resetGame',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  static async deploy(providers: DiceProviders, logger?: Logger): Promise<DiceAPI> {
    logger?.info('deployContract');

    const deployedDiceContract = await deployContract(providers, {
      compiledContract: CompiledDiceContractContract,
      privateStateId: dicePrivateStateKey,
      initialPrivateState: createDicePrivateState(utils.randomBytes(32)),
    });

    logger?.trace({
      contractDeployed: {
        finalizedDeployTxData: deployedDiceContract.deployTxData.public,
      },
    });

    return new DiceAPI(deployedDiceContract, providers, logger);
  }

  static async join(providers: DiceProviders, contractAddress: ContractAddress = DEFAULT_CONTRACT_ADDRESS, logger?: Logger): Promise<DiceAPI> {
    logger?.info({
      joinContract: {
        contractAddress,
      },
    });

    const deployedDiceContract = await findDeployedContract<DiceContract>(providers, {
      contractAddress,
      compiledContract: CompiledDiceContractContract,
      privateStateId: dicePrivateStateKey,
      initialPrivateState: await DiceAPI.getPrivateState(providers, contractAddress),
    });

    logger?.trace({
      contractJoined: {
        finalizedDeployTxData: deployedDiceContract.deployTxData.public,
      },
    });

    return new DiceAPI(deployedDiceContract, providers, logger);
  }

  private static async getPrivateState(
    providers: DiceProviders,
    contractAddress: ContractAddress,
  ): Promise<DicePrivateState> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existingPrivateState = await providers.privateStateProvider.get(dicePrivateStateKey);
    return existingPrivateState ?? createDicePrivateState(utils.randomBytes(32));
  }
}

export * as utils from './utils/index.js';
export * from './common-types.js';
