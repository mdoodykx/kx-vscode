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

import { readFileSync } from "fs";
import { join } from "path";
import { ext } from "../extensionVariables";
import { deserialize, isCompressed, uncompress } from "../ipc/c";
import { Parse } from "../ipc/parse.qlist";
import { ServerType } from "../models/server";

export function sanitizeQuery(query: string): string {
  if (query[0] === "`") {
    query = query + " ";
  } else if (query.slice(-1) === ";") {
    query = query.slice(0, -1);
  }
  return query;
}

export function queryWrapper(): string {
  return readFileSync(
    ext.context.asAbsolutePath(join("resources", "evaluate.q")),
  ).toString();
}

export function handleWSError(ab: ArrayBuffer): any {
  let errorString;

  try {
    // error for: qe/sql & gateway/data
    const errorHeader = Parse.reshape(deserialize(ab).values[0], ab)
      .toLegacy()
      .rows?.reduce((o: any, k: any) => {
        o[k.Property] = k.Value;
        return o;
      }, {});

    errorString = errorHeader.ai;
  } catch {
    // error for: qe/qsql
    // deserializer didn't recognize the format
    const raw = new Uint8Array(ab);
    if (
      raw.byteLength >= 10 &&
      // header?
      raw.subarray(0, 4).toString() === "1,2,0,0" &&
      // last char is string terminator
      raw[raw.byteLength - 1] === 0 &&
      // error message size, message can be clipped (always less than 256 chars)
      raw[5] * 256 + raw[4] === raw.byteLength &&
      // 128 - start of string/error ?
      raw.subarray(6, 9).toString() === "0,0,128"
    ) {
      errorString = {
        // eslint-disable-next-line prefer-spread
        ipc: String.fromCharCode.apply(
          String,
          raw.subarray(9, raw.byteLength - 1) as unknown as number[],
        ),
      };
    } else {
      errorString = "Query error";
    }
  }

  return { error: errorString };
}

export function handleWSResults(ab: ArrayBuffer): any {
  let res: any;
  try {
    if (isCompressed(ab)) {
      ab = uncompress(ab);
    }
    let des = deserialize(ab);
    if (des.qtype === 0 && des.values.length === 2) {
      des = des.values[1];
    }
    res = Parse.reshape(des, ab).toLegacy();
    if (res.rows.length === 0) {
      return "No results found.";
    }
    if (ext.resultsViewProvider.isVisible() || ext.isDatasourceExecution) {
      return getValueFromArray(res.rows);
    }
    return convertRows(res.rows);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export function handleScratchpadTableRes(scratchpadResponse: any): any {
  if (!Array.isArray(scratchpadResponse)) {
    return scratchpadResponse;
  }
  const result = [];
  for (const row of scratchpadResponse) {
    const newObj = {};
    for (const key in row) {
      if (
        typeof row[key] === "object" &&
        row[key] !== null &&
        "i" in row[key]
      ) {
        Object.assign(newObj, { [key]: row[key].toString() });
      } else if (typeof row[key] === "bigint" && row[key] !== null) {
        Object.assign(newObj, { [key]: Number(row[key]) });
      } else {
        Object.assign(newObj, { [key]: row[key] });
      }
    }

    result.push(newObj);
  }

  return result;
}

export function getValueFromArray(arr: any[]): string | any[] {
  if (arr.length === 1 && typeof arr[0] === "object" && arr[0] !== null) {
    const obj = arr[0];
    const keys = Object.keys(obj);
    if (keys.length === 1 && keys[0] === "Value") {
      return String(obj.Value);
    }
  }
  return arr;
}

export function convertRows(rows: any[]): any[] {
  if (rows.length === 0) {
    return [];
  }
  const keys = Object.keys(rows[0]);
  const result = [keys.join("#$#;#$#")];
  for (const row of rows) {
    const values = keys.map((key) => {
      if (Array.isArray(row[key])) {
        return row[key].join(" ");
      }
      return row[key];
    });
    result.push(values.join("#$#;#$#"));
  }
  return result;
}

export function convertRowsToConsole(rows: string[]): string[] {
  if (rows.length === 0) {
    return [];
  }

  const vector = rows.map((row) => row.split("#$#;#$#"));

  const columnCounters = vector[0].reduce((counters: number[], _, j) => {
    const maxLength = vector.reduce(
      (max, row) => Math.max(max, row[j].length),
      0,
    );
    counters.push(maxLength + 2);
    return counters;
  }, []);

  vector.forEach((row) => {
    row.forEach((value, j) => {
      const counter = columnCounters[j];
      const diff = counter - value.length;
      if (diff > 0) {
        row[j] = value + " ".repeat(diff);
      }
    });
  });

  const result = vector.map((row) => row.join(""));

  const totalCount = columnCounters.reduce((sum, count) => sum + count, 0);
  const totalCounter = "-".repeat(totalCount);
  result.splice(1, 0, totalCounter);

  return result;
}

export function arrayToTable(data: any[]): any {
  // Obter as chaves do primeiro objeto para usar como cabeçalho da tabela
  if (!Array.isArray(data) || data.length === 0) {
    return data;
  }

  const header = Object.keys(data[0]);

  // Calcular o tamanho máximo de cada coluna
  const columnLengths = header.map((key) => {
    return Math.max(key.length, ...data.map((obj) => String(obj[key]).length));
  });

  // Converter o cabeçalho em uma string, alinhando os valores
  const headerString = header
    .map((key, i) => key.padEnd(columnLengths[i]))
    .join("   ");

  const separator = header
    .map((_, i) => "-".repeat(columnLengths[i]))
    .join("---");
  // Converter cada objeto em uma string, alinhando os valores
  const rows = data.map((obj) => {
    return header
      .map((key, i) => String(obj[key]).padEnd(columnLengths[i]))
      .join("   ");
  });

  // Juntar o cabeçalho e as linhas para formar a tabela
  return [headerString, separator, ...rows].join("\n");
}

export function getConnectionType(type: ServerType): string {
  switch (type) {
    case ServerType.KDB:
      return "kdb";
    case ServerType.INSIGHTS:
      return "insights";
    default:
      return "undefined";
  }
}
