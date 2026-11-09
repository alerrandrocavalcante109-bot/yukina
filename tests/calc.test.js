"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const calculator = require("../commands/calc");

test("accepts compact operators without spaces", () => {
  assert.equal(calculator.calculate("10+5"), 15);
  assert.equal(calculator.calculate("20×3"), 60);
  assert.equal(calculator.calculate("50-15"), 35);
  assert.equal(calculator.calculate("100/4"), 25);
  assert.equal(calculator.calculate("10*5"), 50);
});

test("preserves existing mathematical functions and constants", () => {
  assert.equal(calculator.calculate("sqrt(81)"), 9);
  assert.equal(calculator.calculate("abs(-7)"), 7);
  assert.equal(calculator.calculate("round(2.6)"), 3);
  assert.equal(calculator.calculate("floor(2.9)"), 2);
  assert.equal(calculator.calculate("ceil(2.1)"), 3);
  assert.ok(Math.abs(calculator.calculate("sin(30)") - 0.5) < 1e-12);
  assert.ok(Math.abs(calculator.calculate("cos(60)") - 0.5) < 1e-12);
  assert.equal(calculator.calculate("log(100)"), 2);
  assert.ok(Math.abs(calculator.calculate("pi") - Math.PI) < 1e-12);
});

test("rejects unsafe and malformed expressions", () => {
  for (const expression of [
    "1/0",
    "sqrt(-1)",
    "2**3",
    "process.exit()",
    "1+",
    "(1+2",
    "1;2",
    "9".repeat(201),
    "2^1001"
  ]) {
    assert.throws(() => calculator.calculate(expression), undefined, expression);
  }
});

test("handles 100 independent calculations concurrently", async () => {
  const expressions = Array.from({ length: 100 }, (_, index) => ({
    expression: (index + 1) + "+" + (index + 2),
    expected: (index + 1) + (index + 2)
  }));

  const results = await Promise.all(expressions.map(async item => ({
    expression: item.expression,
    result: calculator.calculate(item.expression)
  })));

  assert.equal(results.length, 100);
  for (let index = 0; index < results.length; index++) {
    assert.equal(results[index].result, expressions[index].expected);
  }
});

test("keeps each simultaneous prefix response isolated", async () => {
  const requests = Array.from({ length: 50 }, (_, index) => {
    const expression = (index + 1) + "*2";
    const replies = [];
    const message = {
      reply: async payload => {
        replies.push(typeof payload === "string" ? payload : payload.content);
        return true;
      }
    };
    return { expression, replies, run: () => calculator.prefixExecute(message, [expression]) };
  });

  await Promise.all(requests.map(request => request.run()));

  for (let index = 0; index < requests.length; index++) {
    assert.equal(requests[index].replies.length, 1);
    assert.ok(requests[index].replies[0].includes("Resultado: **`" + ((index + 1) * 2) + "`**"));
  }
});

test("uses the requested slash command name and prefix aliases", () => {
  assert.equal(calculator.data.name, "calcular");
  assert.ok(["calc", "calcular", "calculadora"].every(alias =>
    calculator.aliases.includes(alias)
  ));
});

test("keeps 50 simultaneous slash replies isolated", async () => {
  const interactions = Array.from({ length: 50 }, (_, index) => {
    const expression = (index + 1) + "+100";
    const replies = [];
    return {
      expression,
      replies,
      interaction: {
        options: { getString: () => expression },
        deferReply: async () => true,
        editReply: async payload => {
          replies.push(payload.content);
          return true;
        }
      }
    };
  });

  await Promise.all(interactions.map(item => calculator.execute(item.interaction)));

  for (let index = 0; index < interactions.length; index++) {
    assert.equal(interactions[index].replies.length, 1);
    assert.ok(interactions[index].replies[0].includes(
      "Resultado: **`" + (index + 101) + "`**"
    ));
  }
});
