const CURRENCIES = ['NGN', 'USD', 'GBP', 'GHS'];

function parsePaymentInstruction(instruction) {
  const trimmed = instruction.trim().replace(/\s+/g, ' ');
  const upperCase = trimmed.toUpperCase();

  let instructionType = null;
  if (upperCase.startsWith('DEBIT')) {
    instructionType = 'DEBIT';
  } else if (upperCase.startsWith('CREDIT')) {
    instructionType = 'CREDIT';
  } else {
    return errorResult('SY01', 'Missing required keyword: DEBIT or CREDIT');
  }

  if (instructionType === 'DEBIT') {
    return parseDebit(trimmed, upperCase);
  } else {
    return parseCredit(trimmed, upperCase);
  }
}

function parseDebit(text, upper) {
  const data = {
    type: 'DEBIT',
    amount: null,
    currency: null,
    debitAccount: null,
    creditAccount: null,
    executeBy: null,
    error: null
  };

  const fromIdx = upper.indexOf('FROM ACCOUNT');
  const forIdx = upper.indexOf('FOR CREDIT TO ACCOUNT');
  const onIdx = upper.indexOf(' ON ');

  if (fromIdx === -1) {
    return errorResult('SY01', 'Missing required keyword: FROM ACCOUNT');
  }
  if (forIdx === -1) {
    return errorResult('SY01', 'Missing required keyword: FOR CREDIT TO ACCOUNT');
  }
  if (fromIdx >= forIdx) {
    return errorResult('SY02', 'Invalid keyword order');
  }

  const amountPart = text.substring(5, fromIdx).trim();
  const amtResult = getAmountAndCurrency(amountPart);
  if (amtResult.error) return amtResult;
  
  data.amount = amtResult.amount;
  data.currency = amtResult.currency;

  data.debitAccount = text.substring(fromIdx + 12, forIdx).trim();
  const debitCheck = checkAccountId(data.debitAccount);
  if (debitCheck.error) return debitCheck;

  const creditStart = forIdx + 21;
  let creditEnd = text.length;
  if (onIdx !== -1 && onIdx > forIdx) {
    creditEnd = onIdx;
  }
  data.creditAccount = text.substring(creditStart, creditEnd).trim();
  const creditCheck = checkAccountId(data.creditAccount);
  if (creditCheck.error) return creditCheck;

  if (onIdx !== -1 && onIdx > forIdx) {
    const dateText = text.substring(onIdx + 4).trim();
    const dateCheck = checkDate(dateText);
    if (dateCheck.error) return dateCheck;
    data.executeBy = dateText;
  }

  return data;
}

function parseCredit(text, upper) {
  const data = {
    type: 'CREDIT',
    amount: null,
    currency: null,
    debitAccount: null,
    creditAccount: null,
    executeBy: null,
    error: null
  };

  const toIdx = upper.indexOf('TO ACCOUNT');
  const forIdx = upper.indexOf('FOR DEBIT FROM ACCOUNT');
  const onIdx = upper.indexOf(' ON ');

  if (toIdx === -1) {
    return errorResult('SY01', 'Missing required keyword: TO ACCOUNT');
  }
  if (forIdx === -1) {
    return errorResult('SY01', 'Missing required keyword: FOR DEBIT FROM ACCOUNT');
  }
  if (toIdx >= forIdx) {
    return errorResult('SY02', 'Invalid keyword order');
  }

  const amountPart = text.substring(6, toIdx).trim();
  const amtResult = getAmountAndCurrency(amountPart);
  if (amtResult.error) return amtResult;
  
  data.amount = amtResult.amount;
  data.currency = amtResult.currency;

  data.creditAccount = text.substring(toIdx + 10, forIdx).trim();
  const creditCheck = checkAccountId(data.creditAccount);
  if (creditCheck.error) return creditCheck;

  const debitStart = forIdx + 22;
  let debitEnd = text.length;
  if (onIdx !== -1 && onIdx > forIdx) {
    debitEnd = onIdx;
  }
  data.debitAccount = text.substring(debitStart, debitEnd).trim();
  const debitCheck = checkAccountId(data.debitAccount);
  if (debitCheck.error) return debitCheck;

  if (onIdx !== -1 && onIdx > forIdx) {
    const dateText = text.substring(onIdx + 4).trim();
    const dateCheck = checkDate(dateText);
    if (dateCheck.error) return dateCheck;
    data.executeBy = dateText;
  }

  return data;
}

function getAmountAndCurrency(text) {
  const parts = text.trim().split(' ');
  
  if (parts.length < 2) {
    return errorResult('SY03', 'Malformed instruction: unable to parse amount and currency');
  }

  const amtStr = parts[0];
  const curr = parts[parts.length - 1].toUpperCase();

  if (amtStr.indexOf('.') !== -1) {
    return errorResult('AM01', 'Amount must be a positive integer (no decimals)');
  }
  if (amtStr.indexOf('-') !== -1) {
    return errorResult('AM01', 'Amount must be a positive integer (no negatives)');
  }

  const amt = parseInt(amtStr, 10);
  if (isNaN(amt) || amt <= 0) {
    return errorResult('AM01', 'Amount must be a positive integer');
  }

  if (!CURRENCIES.includes(curr)) {
    return errorResult('CU02', 'Unsupported currency. Only NGN, USD, GBP, and GHS are supported');
  }

  return { amount: amt, currency: curr, error: null };
}

function checkAccountId(id) {
  if (!id || id.length === 0) {
    return errorResult('SY03', 'Account ID cannot be empty');
  }

  for (let i = 0; i < id.length; i++) {
    const c = id.charAt(i);
    const isLetter = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    const isNum = c >= '0' && c <= '9';
    const ok = c === '-' || c === '.' || c === '@';

    if (!isLetter && !isNum && !ok) {
      return errorResult('AC04', 'Invalid account ID format: contains invalid character');
    }
  }

  return { error: null };
}

function checkDate(date) {
  if (!date || date.length !== 10) {
    return errorResult('DT01', 'Invalid date format. Expected YYYY-MM-DD');
  }

  if (date.charAt(4) !== '-' || date.charAt(7) !== '-') {
    return errorResult('DT01', 'Invalid date format. Expected YYYY-MM-DD');
  }

  const y = parseInt(date.substring(0, 4), 10);
  const m = parseInt(date.substring(5, 7), 10);
  const d = parseInt(date.substring(8, 10), 10);

  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    return errorResult('DT01', 'Invalid date format. Expected YYYY-MM-DD');
  }

  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return errorResult('DT01', 'Invalid date format. Date values out of range');
  }

  return { error: null };
}

function errorResult(code, msg) {
  return {
    type: null,
    amount: null,
    currency: null,
    debitAccount: null,
    creditAccount: null,
    executeBy: null,
    error: { code, reason: msg }
  };
}

module.exports = { parsePaymentInstruction, CURRENCIES };
