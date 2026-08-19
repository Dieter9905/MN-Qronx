/**
 * Wraps an async route handler so thrown errors are forwarded to Express
 * error middleware automatically — no need for try/catch in every controller.
 *
 * @param {Function} fn  Async function (req, res, next) => Promise
 * @returns Express middleware
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

export default catchAsync
