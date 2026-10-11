const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'economia.json');

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, '{}\n', 'utf8');
  }
}

function readData() {
  ensureStorage();

  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (error) {
    throw new Error('Não foi possível ler os dados da economia.');
  }
}

function writeData(data) {
  ensureStorage();
  fs.writeFileSync(dataFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function getBalance(userId) {
  const data = readData();

  if (!data[userId]) {
    data[userId] = {
      balance: 0,
    };
    writeData(data);
  }

  return data[userId].balance;
}

module.exports = {
  getBalance,
};
