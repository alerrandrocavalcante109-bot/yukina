"use strict";

const { SlashCommandBuilder } = require("discord.js");

const LIMITS = Object.freeze({
  expressionLength: 200,
  tokens: 100,
  operations: 50,
  recursionDepth: 20,
  resultMagnitude: 1e100,
  exponentMagnitude: 1000
});

function tokenize(input) {
  const source = String(input || "").replace(/×/g, "*").replace(/,(?=\d)/g, ".");
  const tokens = [];
  let i = 0;

  while (i < source.length) {
    if (/\s/.test(source[i])) {
      i++;
      continue;
    }

    const rest = source.slice(i);
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);

    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value)) throw new Error("Um dos números é grande demais.");
      tokens.push({ type: "number", value });
      i += number[0].length;
    } else {
      const identifier = rest.match(/^[a-zA-Z]+/);
      if (identifier) {
        tokens.push({ type: "identifier", value: identifier[0].toLowerCase() });
        i += identifier[0].length;
      } else if ("+-*/%^()".includes(source[i])) {
        tokens.push({ type: source[i], value: source[i] });
        i++;
      } else {
        throw new Error("Caractere não reconhecido: " + source[i]);
      }
    }

    if (tokens.length > LIMITS.tokens) {
      throw new Error("A expressão contém elementos demais.");
    }
  }

  return tokens;
}

function ensureSafeNumber(value) {
  if (!Number.isFinite(value) || Math.abs(value) > LIMITS.resultMagnitude) {
    throw new Error("O resultado ultrapassa o limite seguro de cálculo.");
  }
  return value;
}

function calculate(expression) {
  if (typeof expression !== "string" || !expression.trim() ||
      expression.length > LIMITS.expressionLength) {
    throw new Error("A expressão deve ter entre 1 e 200 caracteres.");
  }

  const tokens = tokenize(expression);
  if (!tokens.length) throw new Error("Informe uma expressão matemática.");

  let position = 0;
  let operations = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];

  const functions = {
    sqrt: Math.sqrt,
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    sin: value => Math.sin(value * Math.PI / 180),
    cos: value => Math.cos(value * Math.PI / 180),
    tan: value => Math.tan(value * Math.PI / 180),
    log: Math.log10,
    ln: Math.log
  };
  const constants = { pi: Math.PI, e: Math.E };

  function primary(depth) {
    if (depth > LIMITS.recursionDepth) {
      throw new Error("A expressão está aninhada demais.");
    }

    const token = take();
    if (!token) throw new Error("Expressão incompleta.");

    if (token.type === "number") return ensureSafeNumber(token.value);

    if (token.type === "+" || token.type === "-") {
      const value = expressionAt(4, depth + 1);
      return ensureSafeNumber(token.type === "-" ? -value : value);
    }

    if (token.type === "(") {
      const value = expressionAt(0, depth + 1);
      if (!peek() || take().type !== ")") {
        throw new Error("Falta fechar um parêntese.");
      }
      return value;
    }

    if (token.type === "identifier") {
      if (Object.prototype.hasOwnProperty.call(constants, token.value)) {
        return constants[token.value];
      }

      const fn = functions[token.value];
      if (!fn) throw new Error("Função ou constante desconhecida: " + token.value);
      if (!peek() || take().type !== "(") {
        throw new Error("Use " + token.value + "(valor).");
      }

      const argument = expressionAt(0, depth + 1);
      if (!peek() || take().type !== ")") {
        throw new Error("Falta fechar o parêntese da função.");
      }
      return ensureSafeNumber(fn(argument));
    }

    throw new Error("Expressão inválida.");
  }

  function expressionAt(minPrecedence, depth = 0) {
    if (depth > LIMITS.recursionDepth) {
      throw new Error("A expressão está aninhada demais.");
    }

    let left = primary(depth);
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };

    while (peek() && precedence[peek().type] !== undefined &&
           precedence[peek().type] >= minPrecedence) {
      operations++;
      if (operations > LIMITS.operations) {
        throw new Error("A expressão contém operações demais.");
      }

      const operator = take().type;
      const level = precedence[operator];
      const right = expressionAt(operator === "^" ? level : level + 1, depth + 1);

      if (operator === "+") left += right;
      else if (operator === "-") left -= right;
      else if (operator === "*") left *= right;
      else if (operator === "/") {
        if (right === 0) throw new Error("Não é possível dividir por zero.");
        left /= right;
      } else if (operator === "%") {
        if (right === 0) throw new Error("Não é possível calcular módulo por zero.");
        left %= right;
      } else {
        if (Math.abs(right) > LIMITS.exponentMagnitude) {
          throw new Error("O expoente ultrapassa o limite seguro.");
        }
        left = Math.pow(left, right);
      }

      ensureSafeNumber(left);
    }

    return left;
  }

  const result = expressionAt(0);
  if (position !== tokens.length) {
    throw new Error("Confira a expressão e os parênteses.");
  }
  return ensureSafeNumber(result);
}

function formatResult(value) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 10 }).format(value);
}

async function respond(target, expression, isInteraction = false) {
  if (isInteraction) await target.deferReply();

  let content;
  try {
    const result = calculate(expression);
    content =
      "🌸 **Resultado do cálculo**\n\n" +
      "୨୧ Expressão: `" + expression + "`\n" +
      "✧ Resultado: **`" + formatResult(result) + "`**\n\n" +
      "🌷 Cálculo realizado com sucesso! ♡";
  } catch (error) {
    content =
      "🫧 Não consegui calcular: " + error.message +
      "\nExemplo: `Ycalc (25+5)*2`";
  }

  const payload = { content, allowedMentions: { parse: [] } };
  return isInteraction ? target.editReply(payload) : target.reply(payload);
}

module.exports = {
  // Exportações usadas pelos testes automatizados; não alteram a interface do comando.
  calculate,
  formatResult,
  data: new SlashCommandBuilder()
    .setName("calcular")
    .setDescription("[Membros] calcular um valor matemático.")
    .setDMPermission(false)
    .addStringOption(option => option
      .setName("expressao")
      .setDescription("Exemplo: (25+5)*2")
      .setRequired(true)
      .setMaxLength(LIMITS.expressionLength)),

  aliases: [
    "calc", "calcular", "calculadora",
    "calculate", "計算", "keisan", "calculer", "berechnen"
  ],

  async execute(interaction) {
    return respond(
      interaction,
      interaction.options.getString("expressao", true),
      true
    );
  },

  async prefixExecute(message, args = []) {
    if (!args.length) {
      return message.reply({
        content: "🧮 Informe uma expressão. Exemplo: `Ycalc (25+5)*2`",
        allowedMentions: { parse: [] }
      });
    }

    return respond(message, args.join(" "));
  }
};
