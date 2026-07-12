/**
 * Wraps an async Express handler to catch errors and forward to error middleware.
 * Usage: router.get("/path", asyncHandler(myController.method))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
