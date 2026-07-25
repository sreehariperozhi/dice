// This file is part of Midnight DICE DApp.
// SPDX-License-Identifier: Apache-2.0

/**
 * Dice common types and abstractions.
 *
 * @module
 */

import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { State, Result, DicePrivateState, Contract } from '../../contract/src/index';

export const dicePrivateStateKey = 'dicePrivateState';
export type PrivateStateId = typeof dicePrivateStateKey;

export type PrivateStates = {
  readonly dicePrivateState: DicePrivateState;
};

export type DiceContract = Contract<DicePrivateState>;

export type DiceCircuitKeys = Exclude<keyof DiceContract['impureCircuits'], number | symbol>;

export type DiceProviders = MidnightProviders<DiceCircuitKeys, PrivateStateId, DicePrivateState>;

export type DeployedDiceContract = FoundContract<DiceContract>;

export type DiceDerivedState = {
  readonly state: State;
  readonly targetNumber: number;
  readonly playerCommitment: string;
  readonly lastRoll: number;
  readonly lastResult: Result;
  readonly roundCounter: bigint;
  readonly isOwner: boolean;
};
