const { createHandler } = require('@app-core/server');
const processPayment = require('@app/services/payment');

module.exports = createHandler({
  path: '/payment-instructions',
  method: 'post',
  middlewares: [],
  async handler(rc, helpers) {
    const result = processPayment(rc.body);
    
    const statusCode = result.httpStatus === 200 
      ? helpers.http_statuses.HTTP_200_OK 
      : helpers.http_statuses.HTTP_400_BAD_REQUEST;
    
    return {
      status: statusCode,
      data: result.response
    };
  }
});
