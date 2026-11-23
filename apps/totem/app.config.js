const isLanSpikeBuild = process.env.TOTEMOS_LAN_SPIKE === "1";

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    lanSpikeEnabled: isLanSpikeBuild,
  },
  plugins: [
    ...(config.plugins ?? []),
    ...(!config.plugins?.some?.((plugin) =>
      Array.isArray(plugin)
        ? plugin[0] === "expo-build-properties"
        : plugin === "expo-build-properties",
    )
      ? [
          [
            "expo-build-properties",
            {
              android: {
                usesCleartextTraffic: true,
              },
            },
          ],
        ]
      : []),
  ],
});
