'use strict';

exports.calculate = function (req, res) {
  // Centralized error handler for this route
  req.app.use(function (err, _req, res, next) {
    if (res.headersSent) {
      return next(err);
    }

    res.status(400);
    res.json({ error: err.message });
  });

  var operations = {
    add: function (a, b) {
      return Number(a) + Number(b);
    },
    subtract: function (a, b) {
      return Number(a) - Number(b);
    },
    multiply: function (a, b) {
      return Number(a) * Number(b);
    },
    divide: function (a, b) {
      if (Number(b) === 0) {
        throw new Error('Cannot divide by zero');
      }
      return Number(a) / Number(b);
    },
    power: function (a, b) {
      return Math.pow(Number(a), Number(b));
    },
    mod: function (a, b) {
      if (Number(b) === 0) {
        throw new Error('Cannot modulo by zero');
      }
      return Number(a) % Number(b);
    },
    sqrt: function (a) {
      if (Number(a) < 0) {
        throw new Error('Cannot square root a negative number');
      }
      return Math.sqrt(Number(a));
    }
  };

  if (!req.query.operation) {
    throw new Error('Unspecified operation');
  }

  var operation = operations[req.query.operation];

  if (!operation) {
    throw new Error('Invalid operation: ' + req.query.operation);
  }

  var operand1 = req.query.operand1;
  var operand2 = req.query.operand2;

  function validateOperand(name, value) {
    if (!value ||
      !value.match(/^(-)?[0-9\.]+(e(-)?[0-9]+)?$/) ||
      value.replace(/[-0-9e]/g, '').length > 1) {
      throw new Error('Invalid ' + name + ': ' + value);
    }
  }

  validateOperand('operand1', operand1);

  // Some operations are unary (e.g., sqrt)
  if (req.query.operation !== 'sqrt') {
    validateOperand('operand2', operand2);
  }

  // For unary ops, only pass operand1; for binary ops, pass both
  var result = (req.query.operation === 'sqrt')
    ? operation(operand1)
    : operation(operand1, operand2);

  // Avoid common floating point artifacts (0.1 + 0.2 -> 0.30000000000000004)
  if (typeof result === 'number' && Number.isFinite(result)) {
    // Keep up to 12 significant digits (safe for typical calculator use)
    result = Number(result.toPrecision(12));
  }

  res.json({ result: result });
};
