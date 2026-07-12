/**
 * Creates a middleware that validates the request against a Zod schema.
 * @param {import("zod").ZodSchema} schema
 * @param {"body"|"query"|"params"} source - Which part of the request to validate
 */
function validate(schema, source = "body") {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const err = result.error;
      err.status = 400;
      return next(err);
    }
    req[source] = result.data; // Replace with parsed/cleaned data
    next();
  };
}

module.exports = validate;
