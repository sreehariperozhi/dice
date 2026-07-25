// This file is part of Midnight DICE DApp.
// SPDX-License-Identifier: Apache-2.0

import { Ledger } from "./managed/dice/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

export type DicePrivateState = {
  readonly secretKey: Uint8Array;
};

export const createDicePrivateState = (secretKey: Uint8Array): DicePrivateState => ({
  secretKey,
});

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, DicePrivateState>): [
    DicePrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],
};
