import Zeroconf from "react-native-zeroconf";

import {
  createDiscoverySession,
  type DiscoveryBackend,
} from "./discovery-client";

export function createNativeDiscoveryBackend(): DiscoveryBackend {
  const zeroconf = new Zeroconf();

  return {
    subscribe(event, callback) {
      if (event === "resolved") {
        return zeroconf.subscribe("resolved", service => callback(service));
      }

      return zeroconf.subscribe("error", error => callback(error));
    },
    scan(options) {
      zeroconf.scan(options);
    },
    stop() {
      zeroconf.stop();
    },
    removeDeviceListeners() {
      zeroconf.removeDeviceListeners();
    },
  };
}

export { createDiscoverySession };
