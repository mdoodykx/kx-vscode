/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

import { Entity, EntityType, QAst } from "../parser";

export function assignReservedWord({ symbols }: QAst): Entity[] {
  const indexes: number[] = [];
  const problems: Entity[] = [];

  for (let i = 0; i < symbols.length; i++) {
    if (symbols[i].type === EntityType.ASSIGNMENT) {
      indexes.push(i);
    }
  }

  for (let i = 0; i < indexes.length; i++) {
    const index = indexes[i];
    if (index > 0) {
      if (symbols[index - 1].type === EntityType.KEYWORD) {
        problems.push(symbols[index - 1]);
      }
    }
  }

  return problems;
}

export function invalidAssign({ symbols }: QAst): Entity[] {
  console.log(symbols);
  return [];
}

export function declaredAfterUse({ symbols }: QAst): Entity[] {
  console.log(symbols);
  return [];
}

export function unusedParam({ symbols }: QAst): Entity[] {
  console.log(symbols);
  return [];
}

export function unusedVar({ symbols }: QAst): Entity[] {
  console.log(symbols);
  return [];
}
