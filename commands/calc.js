"use strict";

const { SlashCommandBuilder } = require("discord.js");

function tokenize(input) {
  const source = String(input || "").replace(/,(?=\d)/g, ".");
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue; }
    const rest = source.slice(i);
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) {
      tokens.push({ type: "number", value: Number(number[0]) });
      i += number[0].length;
      continue;
    }
    const identifier = rest.match(/^[a-zA-Z]+/);
    if (identifier) {
      tokens.push({ type: "identifier", value: identifier[0].toLowerCase() });
      i += identifier[0].length;
      continue;
    }
    if ("+-*/%^()".includes(source[i])) {
      tokens.push({ type: source[i], value: source[i] });
      i++;
      continue;
    }
    throw new Error("Caractere não reconhecido: " + source[i]);
  }
  return tokens;
}

function calculate(expression) {
  if (!expression || expression.length > 200) throw new Error("A expressão deve ter entre 1 e 200 caracteres.");
  const tokens = tokenize(expression);
  let position = 0;
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
    ln: Math.log,
  };
  const constants = { pi: Math.PI, e: Math.E };

  function primary() {
    const token = take();
    if (!token) throw new Error("Expressão incompleta.");
    if (token.type === "number") return token.value;
    if (token.type === "+" || token.type === "-") {
      const value = expressionAt(4);
      return token.type === "-" ? -value : value;
    }
    if (token.type === "(") {
      const value = expressionAt(0);
      if (!peek() || take().type !== ")") throw new Error("Falta fechar um parêntese.");
      return value;
    }
    if (token.type === "identifier") {
      if (Object.prototype.hasOwnProperty.call(constants, token.value)) return constants[token.value];
      const fn = functions[token.value];
      if (!fn) throw new Error("Função ou constante desconhecida: " + token.value);
      if (!peek() || take().type !== "(") throw new Error("Use " + token.value + "(valor).");
      const argument = expressionAt(0);
      if (!peek() || take().type !== ")") throw new Error("Falta fechar o parêntese da função.");
      return fn(argument);
    }
    throw new Error("Expressão inválida.");
  }

  function expressionAt(minPrecedence) {
    let left = primary();
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };
    while (peek() && precedence[peek().type] !== undefined && precedence[peek().type] >= minPrecedence) {
      const operator = take().type;
      const level = precedence[operator];
      const right = expressionAt(operator === "^" ? level : level + 1);
      if (operator === "+") left += right;
      else if (operator === "-") left -= right;
      else if (operator === "*") left *= right;
      else if (operator === "/") {
        if (right === 0) throw new Error("Não é possível dividir por zero.");
        left /= right;
      } else if (operator === "%") {
        if (right === 0) throw new Error("Não é possível calcular módulo por zero.");
        left %= right;
      } else left = Math.pow(left, right);
    }
    return left;
  }

  const result = expressionAt(0);
  if (position !== tokens.length) throw new Error("Confira a expressão e os parênteses.");
  if (!Number.isFinite(result)) throw new Error("O resultado não é um número válido.");
  return result;
}

function formatResult(value) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 10 }).format(value);
}

async function respond(target, expression) {
  try {
    const result = calculate(expression);
    return target.reply({
      content: "🧮 **Calculadora da Yukina**\n**Expressão:** `" + expression + "`\n**Resultado:** **" + formatResult(result) + "**",
      allowedMentions: { parse: [] }
    });
  } catch (error) {
    return target.reply("🫧 Não consegui calcular: " + error.message + "\nExemplo: `Ycalc (25 + 5) * 2`");
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("calc")
    .setDescription("Calcula uma expressão matemática.")
    .setDMPermission(false)
    .addStringOption(option => option
      .setName("expressao")
      .setDescription("Exemplo: (25 + 5) * 2")
      .setRequired(true)
      .setMaxLength(200)),
  aliases: ["calc", "calcular", "calculate", "計算", "keisan", "calculer", "berechnen"],
  async execute(interaction) {
    return respond(interaction, interaction.options.getString("expressao", true));
  },
  async prefixExecute(message, args = []) {
    if (!args.length) {
      return message.reply("🧮 Informe uma expressão. Exemplo: `Ycalc (25 + 5) * 2`");
    }
    return respond(message, args.join(" "));
  }
};
