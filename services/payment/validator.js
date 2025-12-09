const { CURRENCIES } = require('./parser');

function validateTransaction(parsed, accounts) {
  if (parsed.error) {
    return parsed.error;
  }

  const debitAcc = accounts.find(a => a.id === parsed.debitAccount);
  const creditAcc = accounts.find(a => a.id === parsed.creditAccount);

  if (!debitAcc) {
    return { code: 'AC03', reason: `Account not found: ${parsed.debitAccount}` };
  }

  if (!creditAcc) {
    return { code: 'AC03', reason: `Account not found: ${parsed.creditAccount}` };
  }

  if (parsed.debitAccount === parsed.creditAccount) {
    return { code: 'AC02', reason: 'Debit and credit accounts cannot be the same' };
  }

  if (debitAcc.currency !== creditAcc.currency) {
    return { code: 'CU01', reason: `Account currency mismatch: ${debitAcc.id} has ${debitAcc.currency}, ${creditAcc.id} has ${creditAcc.currency}` };
  }

  const curr = parsed.currency.toUpperCase();
  if (!CURRENCIES.includes(curr)) {
    return { code: 'CU02', reason: `Unsupported currency. Only ${CURRENCIES.join(', ')} are supported` };
  }

  if (debitAcc.currency.toUpperCase() !== curr) {
    return { code: 'CU01', reason: `Currency mismatch: instruction specifies ${curr} but account ${debitAcc.id} has ${debitAcc.currency}` };
  }

  if (debitAcc.balance < parsed.amount) {
    return { code: 'AC01', reason: `Insufficient funds in account ${debitAcc.id}: has ${debitAcc.balance} ${debitAcc.currency}, needs ${parsed.amount} ${curr}` };
  }

  return null;
}

module.exports = { validateTransaction };
