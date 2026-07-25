// This file is part of Midnight DICE DApp.
// SPDX-License-Identifier: Apache-2.0

import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * from "./managed/dice/contract/index.js";
export * from "./witnesses";

import * as CompiledDiceContract from "./managed/dice/contract/index.js";
import * as Witnesses from "./witnesses";

export const CompiledDiceContractContract = CompiledContract.make<
  CompiledDiceContract.Contract<Witnesses.DicePrivateState>
>("Dice", CompiledDiceContract.Contract<Witnesses.DicePrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/dice"),
);
