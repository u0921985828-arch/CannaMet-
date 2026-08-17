module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // babel-preset-expo ya inyecta react-native-reanimated/plugin cuando
    // detecta la dependencia. No lo añadas a mano o Reanimated avisa de duplicado.
  };
};
