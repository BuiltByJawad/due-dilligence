function runAsync(callback) {
  setImmediate(async () => {
    try {
      await callback();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Async task failed", error);
    }
  });
}

module.exports = {
  runAsync,
};
