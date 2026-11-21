export function errorHandler(error, req, res, next) {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  const status = Number(error.status) || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Ocurrió un error interno en el servidor.' : error.message,
    ...(process.env.NODE_ENV === 'development' ? { detail: error.message } : {})
  });
}
