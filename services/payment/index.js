const { parsePaymentInstruction } = require('./parser');
const { validateTransaction } = require('./validator');

function processPayment(requestData) {
  const { accounts, instruction } = requestData;

  const parsed = parsePaymentInstruction(instruction);

  if (parsed.error && !parsed.debitAccount && !parsed.creditAccount) {
    return {
      httpStatus: 400,
      response: {
        type: null,
        amount: null,
        currency: null,
        debit_account: null,
        credit_account: null,
        execute_by: null,
        status: 'failed',
        status_reason: parsed.error.reason,
        status_code: parsed.error.code,
        accounts: []
      }
    };
  }

  const validationError = validateTransaction(parsed, accounts);

  if (validationError) {
    const involvedAccounts = getInvolvedAccounts(accounts, parsed.debitAccount, parsed.creditAccount);
    return {
      httpStatus: 400,
      response: {
        type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency,
        debit_account: parsed.debitAccount,
        credit_account: parsed.creditAccount,
        execute_by: parsed.executeBy,
        status: 'failed',
        status_reason: validationError.reason,
        status_code: validationError.code,
        accounts: involvedAccounts.map(acc => ({
          id: acc.id,
          balance: acc.balance,
          balance_before: acc.balance,
          currency: acc.currency.toUpperCase()
        }))
      }
    };
  }

  const shouldExecute = shouldExecuteNow(parsed.executeBy);

  if (shouldExecute) {
    const updatedAccounts = executeTransaction(accounts, parsed);
    const involvedAccounts = getInvolvedAccounts(updatedAccounts, parsed.debitAccount, parsed.creditAccount);

    return {
      httpStatus: 200,
      response: {
        type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency,
        debit_account: parsed.debitAccount,
        credit_account: parsed.creditAccount,
        execute_by: parsed.executeBy,
        status: 'successful',
        status_reason: 'Transaction executed successfully',
        status_code: 'AP00',
        accounts: involvedAccounts
      }
    };
  } else {
    const involvedAccounts = getInvolvedAccounts(accounts, parsed.debitAccount, parsed.creditAccount);
    
    return {
      httpStatus: 200,
      response: {
        type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency,
        debit_account: parsed.debitAccount,
        credit_account: parsed.creditAccount,
        execute_by: parsed.executeBy,
        status: 'pending',
        status_reason: 'Transaction scheduled for future execution',
        status_code: 'AP02',
        accounts: involvedAccounts.map(acc => ({
          id: acc.id,
          balance: acc.balance,
          balance_before: acc.balance,
          currency: acc.currency.toUpperCase()
        }))
      }
    };
  }
}

function shouldExecuteNow(executeBy) {
  if (!executeBy) {
    return true;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const executionDate = new Date(executeBy + 'T00:00:00Z');

  return executionDate <= today;
}

function executeTransaction(accounts, parsed) {
  const updated = accounts.map(acc => {
    if (acc.id === parsed.debitAccount) {
      return {
        id: acc.id,
        balance: acc.balance - parsed.amount,
        balance_before: acc.balance,
        currency: acc.currency.toUpperCase()
      };
    } else if (acc.id === parsed.creditAccount) {
      return {
        id: acc.id,
        balance: acc.balance + parsed.amount,
        balance_before: acc.balance,
        currency: acc.currency.toUpperCase()
      };
    } else {
      return {
        id: acc.id,
        balance: acc.balance,
        balance_before: acc.balance,
        currency: acc.currency.toUpperCase()
      };
    }
  });

  return updated;
}

function getInvolvedAccounts(accounts, debitId, creditId) {
  const result = [];
  
  for (const acc of accounts) {
    if (acc.id === debitId || acc.id === creditId) {
      result.push({
        id: acc.id,
        balance: acc.balance,
        balance_before: acc.balance_before !== undefined ? acc.balance_before : acc.balance,
        currency: acc.currency.toUpperCase ? acc.currency.toUpperCase() : acc.currency
      });
    }
  }

  return result;
}

module.exports = processPayment;
