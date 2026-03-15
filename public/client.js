'use strict';

const displayEl = document.getElementById('display');
const statusEl = document.getElementById('status');
const historyListEl = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistory');

const STORAGE_KEY = 'node-calculator-history';
const VALID_NUMBER_REGEX = /^-?[0-9]+(?:\.[0-9]*)?(?:e-?\d+)?$/i;

let current = '0';
let pendingOperand = null;
let pendingOperator = null;
let waitingForOperand = false;

function init() {
  bindEvents();
  loadHistory();
  render();
}

function bindEvents() {
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', handleButtonClick);
  });

  clearHistoryBtn.addEventListener('click', () => {
    clearHistory();
    renderHistory();
  });

  document.addEventListener('keydown', handleKeyDown);
}

function handleButtonClick(event) {
  const button = event.currentTarget;
  const action = button.dataset.action;
  const value = button.dataset.value;

  switch (action) {
    case 'digit':
      appendDigit(value);
      break;
    case 'decimal':
      appendDecimal();
      break;
    case 'operator':
      setOperator(value);
      break;
    case 'equals':
      calculate();
      break;
    case 'clear':
      clearAll();
      break;
    case 'clear-entry':
      clearEntry();
      break;
    case 'backspace':
      backspace();
      break;
    default:
      break;
  }
}

function handleKeyDown(event) {
  if (event.target.tagName === 'INPUT' || event.target.isContentEditable) {
    return;
  }

  if (/^[0-9]$/.test(event.key)) {
    appendDigit(event.key);
  } else if (event.key === '.') {
    appendDecimal();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    calculate();
  } else if (event.key === 'Backspace') {
    backspace();
  } else if (event.key === 'Escape') {
    clearAll();
  } else if (['+', '-', '*', '/', '^', '%'].includes(event.key)) {
    setOperator(event.key);
  } else if (event.key.toLowerCase() === 'r') {
    setOperator('sqrt');
  }
}

function appendDigit(digit) {
  clearStatus();

  if (waitingForOperand) {
    current = digit;
    waitingForOperand = false;
    render();
    return;
  }

  if (current === '0') {
    current = digit;
  } else {
    current += digit;
  }

  render();
}

function appendDecimal() {
  clearStatus();

  if (waitingForOperand) {
    current = '0.';
    waitingForOperand = false;
    render();
    return;
  }

  if (!current.includes('.')) {
    current += '.';
    render();
  }
}

function backspace() {
  clearStatus();

  if (waitingForOperand) {
    return;
  }

  if (current.length <= 1) {
    current = '0';
  } else {
    current = current.slice(0, -1);
  }

  render();
}

function clearEntry() {
  clearStatus();
  current = '0';
  render();
}

function clearAll() {
  clearStatus();
  current = '0';
  pendingOperand = null;
  pendingOperator = null;
  waitingForOperand = false;
  render();
}

function setOperator(op) {
  clearStatus();

  const mappedOp = op === '%' ? 'mod' : op === '^' ? 'power' : op;

  // Unary operation (sqrt)
  if (mappedOp === 'sqrt') {
    executeOperation('sqrt', current);
    return;
  }

  if (pendingOperator && !waitingForOperand) {
    // Chain operations: compute and continue
    calculate();
  }

  pendingOperand = current;
  pendingOperator = mappedOp;
  waitingForOperand = true;
  render();
}

function calculate() {
  clearStatus();

  if (!pendingOperator) {
    return;
  }

  if (waitingForOperand) {
    setStatus('Enter second number', 'warning');
    return;
  }

  executeOperation(pendingOperator, pendingOperand, current);
  pendingOperator = null;
  pendingOperand = null;
  waitingForOperand = false;
}

function executeOperation(operation, operand1, operand2) {
  const uri = new URL('/arithmetic', location.origin);
  uri.searchParams.set('operation', operation);
  uri.searchParams.set('operand1', operand1);

  if (operand2 !== undefined) {
    uri.searchParams.set('operand2', operand2);
  }

  const isValid = validateNumber(operand1) && (operand2 === undefined || validateNumber(operand2));
  if (!isValid) {
    setStatus('Invalid number format');
    return;
  }

  setStatus('Calculating...', 'info');

  fetch(uri.toString())
    .then((res) => {
      if (!res.ok) {
        return res.text().then((text) => {
          try {
            const payload = JSON.parse(text);
            throw new Error(payload.error || 'Server error');
          } catch (parseErr) {
            throw new Error(`Server error (${res.status})`);
          }
        });
      }
      return res.text().then((text) => {
        try {
          return JSON.parse(text);
        } catch (parseErr) {
          throw new Error('Invalid server response');
        }
      });
    })
    .then((payload) => {
      current = String(payload.result);
      addHistoryEntry({ expression: buildExpression(operation, operand1, operand2), result: current });
      render();
      setStatus('');
    })
    .catch((err) => {
      setStatus(err.message || 'Unexpected error');
    });
}


function buildExpression(operation, a, b) {
  const opMap = {
    add: '+',
    subtract: '−',
    multiply: '×',
    divide: '÷',
    power: '^',
    mod: '%',
    sqrt: '√'
  };

  if (operation === 'sqrt') {
    return `√(${a})`;
  }

  return `${a} ${opMap[operation] || operation} ${b}`;
}

function validateNumber(value) {
  return typeof value === 'string' && VALID_NUMBER_REGEX.test(value);
}

function setStatus(message, type = 'error') {
  statusEl.textContent = message;
  statusEl.className = type ? `status status--${type}` : 'status';
}

function clearStatus() {
  setStatus('', '');
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      history = parsed;
    }
  } catch (err) {
    history = [];
  }
  renderHistory();
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history || []));
}

let history = [];

function addHistoryEntry(entry) {
  history = [entry].concat(history).slice(0, 20);
  renderHistory();
  saveHistory();
}

function renderHistory() {
  historyListEl.innerHTML = '';

  if (!history.length) {
    historyListEl.innerHTML = '<li class="history__empty">No calculations yet</li>';
    return;
  }

  history.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'history__item';

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'history__itemButton';
    label.textContent = `${entry.expression} = ${entry.result}`;
    label.addEventListener('click', () => {
      current = String(entry.result);
      pendingOperator = null;
      pendingOperand = null;
      waitingForOperand = false;
      render();
    });

    li.appendChild(label);
    historyListEl.appendChild(li);
  });
}

function clearHistory() {
  history = [];
  saveHistory();
}

function render() {
  displayEl.textContent = current;

  const equalsBtn = document.querySelector('[data-action="equals"]');
  if (equalsBtn) {
    equalsBtn.disabled = !pendingOperator || waitingForOperand;
  }
}

init();
