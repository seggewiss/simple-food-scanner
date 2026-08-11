module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Drizzle's generated migrations bundle imports `.sql` files directly. This turns
    // those imports into inline strings so the migrations ship inside the JS bundle
    // instead of needing filesystem access at runtime.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
