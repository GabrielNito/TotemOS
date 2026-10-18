import Zeroconf from "react-native-zeroconf";

import {
  createKdsServicePublisher,
  type KdsServicePublisher,
} from "./publisher";

export function createNativeKdsServicePublisher(): KdsServicePublisher {
  return createKdsServicePublisher(new Zeroconf());
}
