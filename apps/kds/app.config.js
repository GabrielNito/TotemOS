const isLanSpikeBuild = process.env.TOTEMOS_LAN_SPIKE === "1";

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    lanSpikeEnabled: isLanSpikeBuild,
  },
  plugins: [
    ...(config.plugins ?? []),
    ...(isLanSpikeBuild
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
